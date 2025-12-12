import dayjs from "dayjs";
import { and, eq, like, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { PrivateConfigKeys } from "~/lib/config";
import { dcmCreateToken1, dcmGetLockerSizes, dcmGetToken, DCMv2TokenCreate } from "~/lib/dcm";
import { sticEvtWebhookConfirmedOrderSchema, SticOrder } from "~/lib/stic/models";
import { createId } from "~/lib/utils";
import { sizesList } from "~/server/api/routers/sizes";
import { db, schema } from "~/server/db";
import utc from "dayjs/plugin/utc";
import { tiendastic } from "~/lib/stic/requests";

dayjs.extend(utc);

export async function sticProcessOrder({
  entityId,
  entidad,
  body,
}: {
  entityId: string,
  entidad: typeof schema.companies.$inferSelect,
  body: typeof sticEvtWebhookConfirmedOrderSchema._output,
}) {
  const client = await getHookClientByEmail(body.CustomerName, body.CustomerEmail, entityId);

  const [newReservaToClient] = await db
    .insert(schema.reservasToClients)
    .values({
      clientId: client.identifier,
    })
    .returning();

  const reservaToClient = newReservaToClient!;
  const nReserve = reservaToClient.identifier;

  const tokenEmpresa = await getTokenEmpresa(entityId);
  if (!tokenEmpresa) {
    console.error(`[${entityId}] stic ord-confirm no token empresa for dcm`);
    await db.insert(schema.errorLogs).values({ text: `(entidad ID: ${entityId}) Webhook Stic: sin token empresa` });
    return NextResponse.json(null, { status: 500 });
  }

  let tiendaStic;
  try {
    tiendaStic = await tiendastic();
  } catch (e) {
    console.error("tiendastic error:", e);
    await db.insert(schema.errorLogs).values({ text: `(entidad ID: ${entityId}) Webhook Stic: sin clave de API o error de configuración` });
    return NextResponse.json(null, { status: 500 });
  }

  let sticOrder;
  try {
    sticOrder = await tiendaStic.getOrder(body.OrderId);
  } catch (e) {
    console.error("tiendastic order error:", e, "for order", body.OrderId);
    await db.insert(schema.errorLogs).values({ text: `(entidad ID: ${entityId}) Webhook Stic: error al levantar pedido de tiendastic ${body.OrderId}` });
    return NextResponse.json(null, { status: 500 });
  }

  if (!sticOrder.shipping?.pickup_point_id) {
    await db.insert(schema.errorLogs).values({ text: `(entidad ID: ${entityId}) Webhook Stic: pedido sin pickup point: ${body.OrderId}` });
    return NextResponse.json(null, { status: 200 }); // no es un error per se
  }

  const { store, locker, size } = await findStoreAndLocker(entityId, tokenEmpresa, sticOrder);
  if (!store) {
    console.error(`[${entityId}] stic ord-confirm no store available`, store, 'para pickup point id', sticOrder.shipping?.pickup_point_id);
    await db.insert(schema.errorLogs).values({ text: `(entidad ID: ${entityId}) Webhook Stic: no se encontró local para pickup point ${sticOrder.shipping?.pickup_point_id}` });
    return NextResponse.json(null, { status: 500 });
  }

  if (!locker) {
    console.error(`[${entityId}] stic ord-confirm no locker available`, locker, 'para store', store);
    await db.insert(schema.errorLogs).values({ text: `(entidad ID: ${entityId}) Webhook Stic: no se encontró locker para local "${store.name}" para pickup point ${sticOrder.shipping?.pickup_point_id}` });
    return NextResponse.json(null, { status: 500 });
  }

  if (!size) {
    console.error(`[${entityId}] stic ord-confirm no size available`, size, 'para locker', locker, 'en store', store);
    await db.insert(schema.errorLogs).values({ text: `(entidad ID: ${entityId}) Webhook Stic: no se encontró tamaño de locker "${locker.serieLocker}" para local "${store.name}" para pickup point ${sticOrder.shipping?.pickup_point_id}` });
    return NextResponse.json(null, { status: 500 });
  }

  const reserveData: DCMv2TokenCreate = {
    idSize: size.id,
    // fechaInicio: new Date().toISOString(),
    confirmado: true,
    cantidad: 1,
  };

  const token1 = await dcmCreateToken1(locker.serieLocker, reserveData, tokenEmpresa);
  const tokenData = await dcmGetToken(locker.serieLocker, token1, tokenEmpresa);

  const newReserveId = createId();
  const [reserve] = await db.insert(schema.reservas)
    .values({
      identifier: newReserveId,
      NroSerie: locker.serieLocker,
      IdSize: size.id,
      IdBox: tokenData?.idBox,
      IdFisico: tokenData?.idBox,
      Token1: Number(token1), // ASUMO token numérico!!
      FechaCreacion: tokenData?.fechaCreacion ?? new Date().toISOString(),
      FechaInicio: tokenData?.fechaInicio ?? reserveData.fechaInicio,
      FechaFin: tokenData?.fechaFin ?? reserveData.fechaFin,
      Contador: reserveData.contador,
      Confirmado: reserveData.confirmado,
      Modo: reserveData.modo,
      Cantidad: reserveData.cantidad,
      IdTransaction: null, // sin API de reservas
      client: body.CustomerEmail,
      nReserve,
      entidadId: entityId,
      status: "pendiente_ubic",
      mode: "takeAway",
      externalNReserve: String(body.OrderId),
    })
    .returning();

  const [tx] = await db.insert(schema.transactions)
    .values({
      amount: body.TotalAmount,
      client: String(client.identifier),
      confirm: true,
      entidadId: entityId,
      nReserve: nReserve,
    })
    .returning();

  const transaction = tx!;
  const tokensYTamaños: [string, string][] = [
    [token1, size.nombre ?? ""]
  ];

  const storeName = sticOrder.shipping?.pickup_point_name ?? store.name; // <-- para el mail
  const storeAddress = store.address;
  const fechaInicio = reserve?.FechaInicio ?? "-";
  const fechaFin = reserve?.FechaFin ?? "-";
  const transactionAmount = transaction.amount ?? "";
  const coin = "";
  const backofficeEmail = store.backofficeEmail;

  const email_sender_config: PrivateConfigKeys = "email_sender";
  let email_sender: string | undefined = (
    await db.query.privateConfig.findFirst({
      where: and(
        eq(schema.privateConfig.key, email_sender_config),
        eq(schema.privateConfig.entidadId, entityId),
      ),
    })
  )?.value;

  if (email_sender?.trim() === "") {
    email_sender = undefined;
  }

  await sendBackofficeEmail({ sticOrderId: sticOrder.id, sender: email_sender, tokensYTamaños, backofficeEmail, storeName, storeAddress, nReserve, fechaInicio, fechaFin, coin, transactionAmount, entityId });
  return NextResponse.json(null, { status: 200 });
}

async function sendBackofficeEmail({
  tokensYTamaños,
  backofficeEmail,
  storeName,
  storeAddress,
  nReserve,
  fechaInicio,
  fechaFin,
  coin,
  transactionAmount,
  entityId,
  sender,
  sticOrderId,
}: {
  tokensYTamaños: [string, string][];
  backofficeEmail: string | null;
  storeName: string;
  storeAddress: string | null;
  nReserve: number;
  fechaInicio: string;
  fechaFin: string;
  coin: string;
  transactionAmount: string | number;
  entityId: string;
  sender?: string;
  sticOrderId: number;
}) {
  try {
    var QRCode = require("qrcode");
    const attachments: {
      filename: string;
      content: any;
      type: string;
      disposition: string;
      contentId: string;
    }[] = [];
    await Promise.all(
      tokensYTamaños.map(async (token, index) => {
        const img = await QRCode.toDataURL(token[0]!.toString(), {
          type: "png",
        });

        const qrCode = img.split(";base64,").pop();
        if (qrCode) {
          attachments.push({
            filename: `QR_${token[0]}_${token[1]}.png`,
            content: qrCode,
            type: "image/png",
            disposition: "attachment",
            contentId: `qr_code_${index}`,
          });
        }
      })
    );

    if (!backofficeEmail || !backofficeEmail.includes("@")) {
      console.error(`[${entityId}] stic ord-confirm sin backoffice email para store`, storeName, backofficeEmail);
      return;
    }

    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(env.SENDGRID_API_KEY);

    const msg = {
      to: backofficeEmail,
      from: `${sender ?? env.MAIL_SENDER}`,
      subject: `Farmacias y Perfumerías Global: Confirmación de reserva de locker`,
      html: `

      <body>
      <p>Estimado/a Backoffice,</p>
      <p>Nos complace confirmar que tu reserva en ${storeName} en ${storeAddress} ha sido exitosamente procesada. </p>


      <p><strong>N° Reserva</strong></p>
      <p><strong>${nReserve}</strong></p>

      <p><strong>N° Pedido</strong></p>
      <p><strong>${sticOrderId}</strong></p>

      <p><strong>Período</strong></p>
      <p>Entrega desde              ${fechaInicio}</p>
      <p>Recogida hasta             ${fechaFin}</p>

      <p><strong>Códigos de acceso (Tokens)</strong></p>

      <p>
        ${tokensYTamaños
          .map((x) => {
            return `El código de acceso (token) para guardar su paquete es <strong>${x[0]} (${x[1]})</strong><br>`;
          })
          .join("")}
      </p>
      <hr>
      <p><strong>Precio Total</strong>         ${coin} ${transactionAmount}</p>

      <p>Atentamente,</p>
      <p>el equipo de <strong>Farmacias y Perfumerías Global</strong></p>


    </body>`,
      attachments: attachments,
    };
    sgMail
      .send(msg)
      .then(() => {
        console.log("Email sent");
      })
      .catch((e: any) => {
        console.log(e);
      });
  } catch (error) {
    console.error(`[${entityId}] stic ord-confirm error`, error);
  }
}

async function getTokenEmpresa(entityId: string) {
  const tk: PrivateConfigKeys = 'token_empresa';
  const tkValue = await db.query.privateConfig.findFirst({
    where: and(
      eq(schema.privateConfig.key, tk),
      eq(schema.privateConfig.entidadId, entityId)
    )
  });

  const token = tkValue?.value ?? null;
  return token;
}

async function getHookClientByEmail(name: string, email: string, entityId: string) {
  let client = await db.query.clients.findFirst({
    where: and(
      like(sql`UPPER(${schema.clients.email})`, email.toUpperCase()),
      eq(schema.clients.entidadId, entityId)
    )
  });

  if (!client) {
    const [newClient] = await db.insert(schema.clients)
      .values({
        email: email,
        name: name,
        entidadId: entityId,
      }).returning();

    client = newClient!;
  }
  return client;
}

async function findStoreAndLocker(entityId: string, bearerToken: string, sticOrder: SticOrder) {
  const possiblePickupStores = await db.query.stores.findMany({
    where: and(
      eq(schema.stores.entidadId, entityId),
      eq(schema.stores.stic_pickup_point_id, String(sticOrder.shipping!.pickup_point_id!))
    ),
    with: {
      lockers: true,
    },
    columns: {
      address: true,
      name: true,
      cityId: true,
      description: true,
      entidadId: true,
      identifier: true,
      backofficeEmail: true,
      stic_pickup_point_id: true,
      stic_pickup_point_name: true,
    }
  });

  let store = null, locker = null, size = null;
  for (const possibleStore of possiblePickupStores) {
    const anyLocker = await db.query.storesLockers.findFirst({
      where: eq(schema.storesLockers.storeId, possibleStore.identifier)
    });

    if (!anyLocker) {
      continue;
    }

    const allPossibleSizes = await dcmGetLockerSizes(anyLocker.serieLocker, bearerToken);
    if (allPossibleSizes.length === 0) {
      continue;
    }

    size = allPossibleSizes.at(0)!;
    store = possibleStore;
    locker = anyLocker;
    break;
  }

  if (store && sticOrder.shipping?.pickup_point_name) {
    await db.update(schema.stores)
      .set({ stic_pickup_point_name: sticOrder.shipping.pickup_point_name })
      .where(eq(schema.stores.identifier, store.identifier));
  }

  return { store, locker, lockerSerial: locker?.serieLocker ?? null, size };
}
