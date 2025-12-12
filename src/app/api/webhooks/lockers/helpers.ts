import {
  LockerWebhook,
  TokenRequestCreationBody,
  TokenRequestEditionBody,
} from "./types";
import sendgrid from "@sendgrid/mail";
import { Html, render } from "@react-email/components";
import { db } from "~/server/db";
import { env } from "~/env";
import { stores, storesLockers } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { basename } from "node:path";

const base_url = `${env.SERVER_URL}/api/v2/token`;

export async function addTokenToServer(
  token: TokenRequestCreationBody,
  lockerSerial: string,
  bearerToken: string,
) {
  const response = await fetch(`${base_url}/${lockerSerial}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(token),
  });
  return response;
}

export async function editTokenToServer(
  token: TokenRequestEditionBody,
  lockerSerial: string,
  bearerToken: string,
) {
  const response = await fetch(`${base_url}/${lockerSerial}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(token),
  });

  return response;
}


export async function sendPackageAvailableTakeAwayEmail({
  to,
  lockerAddress,
  storeName,
  checkoutTime,
  userToken,
  sender,
}: {
  to: string;
  lockerAddress: string;
  storeName: string;
  checkoutTime: string | null;
  userToken: string;
  sender?: string;
}) {
  var QRCode = require("qrcode");
  // Generar data URL del QR
  const dataUrl: string = await QRCode.toDataURL(userToken, { type: "png" });
  // Extraer solo el Base64 (sin el prefijo "data:image/png;base64,")
  const base64 = dataUrl.split(";base64,").pop()!;
  const fechaFin = checkoutTime ? checkoutTime.split("T")[0] : null;
  const horaFin = checkoutTime ? checkoutTime.split("T")[1] : null;
  sendgrid.setApiKey(env.SENDGRID_API_KEY);
  const msg = {
    to,
    from: sender ?? env.MAIL_SENDER,
    subject: "Farmacias y Perfumerías Global: Paquete listo para ser recogido!",
    html: `
			<body>
				<p>El paquete destinado a su locker reservado en ${storeName} en ${lockerAddress} fue entregado. ${checkoutTime !== null ? `Le recordamos que el tiempo límite para pasarlo a buscar es ${horaFin} del ${fechaFin}` : ""}</p>
				<p><strong>Su código de acceso (Token) para retirar su paquete es ${userToken}</strong></p>
				<p>Atentamente,</p>
				<p>el equipo de <strong>Farmacias y Perfumerías Global</strong></p>
			</body>`,
    attachments: [
      {
        filename: `QR_${userToken}.png`,
        content: base64,
        type: "image/png",
        disposition: "attachment",
        contentId: "qr_code_delivery",
      },
    ],
  };

  try {
    console.log("ANTES DE MAIL TA DE PAQUETE LISTO");
    console.time("MAIL TA DE AVISO DE PAQUETE LISTO");
    await sendgrid.send(msg);
    console.timeEnd("MAIL TA DE AVISO DE PAQUETE LISTO");
  } catch (error) {
    console.log("Hubo un problema al enviar el mail takeaway. El error fue:", error);
  }
}

export async function sendPackageAvailablePickPackEmail({
  to,
  lockerAddress,
  storeName,
  checkoutTime,
  userToken,
  sender,
}: {
  to: string;
  lockerAddress: string;
  storeName: string;
  checkoutTime: string | null;
  userToken: string;
  sender?: string;
}) {
  var QRCode = require("qrcode");
  // Generar data URL del QR
  const dataUrl: string = await QRCode.toDataURL(userToken, { type: "png" });
  // Extraer solo el Base64 (sin el prefijo "data:image/png;base64,")
  const base64 = dataUrl.split(";base64,").pop()!;
  const fechaFin = checkoutTime ? checkoutTime.split("T")[0] : null;
  const horaFin = checkoutTime ? checkoutTime.split("T")[1] : null;
  sendgrid.setApiKey(env.SENDGRID_API_KEY);
  const msg = {
    to,
    from: sender ?? env.MAIL_SENDER,
    subject: "PICKPACK: Paquete listo para ser recogido",
    html: `
			<body>
				<p>El paquete destinado a su locker reservado en ${storeName} en ${lockerAddress} fue entregado. ${checkoutTime !== null ? `Le recordamos que el tiempo límite para pasarlo a buscar es ${horaFin} del ${fechaFin}` : ""}</p>
				<p><strong>Su código de acceso (Token) para retirar su paquete es ${userToken}</strong></p>
				<p>Atentamente,</p>
				<p>el equipo de <strong>PickPack</strong></p>
			</body>`,
    attachments: [
      {
        filename: `QR_${userToken}.png`,
        content: base64,
        type: "image/png",
        disposition: "attachment",
        contentId: "qr_code_delivery",
      },
    ],
  };

  try {
    console.log("ANTES DE MAIL PP DE PAQUETE LISTO");
    console.time("MAIL PP DE AVISO DE PAQUETE LISTO");
    await sendgrid.send(msg);
    console.timeEnd("MAIL PP DE AVISO DE PAQUETE LISTO");
  } catch (error) {
    console.log("Hubo un problema al enviar el mail pickpack. El error fue:", error);
  }
}

export async function sendGoodbyePickPackEmail({ to, sender }: { to: string, sender?: string }) {
  sendgrid.setApiKey(env.SENDGRID_API_KEY);
  const msg = {
    to,
    from: sender ?? env.MAIL_SENDER,
    subject: "PICKPACK: paquete recogido",
    html: `
			<body>
				<p>Gracias por confiar en <strong>PickPack</strong>, esperamos que nuestro servicio haya sido de su agrado.</p>
				<p>Atentamente,</p>
				<p>el equipo de <strong>PickPack</strong></p>
			</body>`,
  };
  try {
    console.log("ANTES DE MAIL PP DE DESPEDIDA");
    console.time("MAIL PP DE DESPEDIDA");
    await sendgrid.send(msg);
    console.timeEnd("MAIL PP DE DESPEDIDA");
  } catch (error) {
    console.log("Hubo un problema al enviar el mail pickpack despedida. El error fue:", error);
  }
}

export async function sendGoodbyeTakeAwayEmail({ to, sender }: { to: string, sender?: string }) {
  sendgrid.setApiKey(env.SENDGRID_API_KEY);
  const msg = {
    to,
    from: sender ?? env.MAIL_SENDER,
    subject: "Farmacias y Perfumerías Global: Paquete recogido!",
    html: `
			<body>
				<p>Gracias por confiar en <strong>Farmacias y Perfumerías Global</strong>, esperamos que nuestro servicio haya sido de su agrado.</p>
				<p>Atentamente,</p>
				<p>el equipo de <strong>Farmacias y Perfumerías Global</strong></p>
			</body>`,
  };
  try {
    console.log("ANTES DE MAIL TA DE DESPEDIDA");
    console.time("MAIL TA DE DESPEDIDA");
    await sendgrid.send(msg);
    console.timeEnd("MAIL TA DE DESPEDIDA");
  } catch (error) {
    console.log("Hubo un problema al enviar el mail takeaway despedida. El error fue:", error);
  }
}

export function isWithinDates(start: string, end?: string | null) {
  const now = new Date(Date.now());
  const startDate = new Date(start);
  if (!end) {
    return startDate <= now;
  }

  const endDate = new Date(end);
  return startDate <= now && now <= endDate;
}

export function addMinutes(base: string, toAdd: number): string {
  const baseDate = new Date(base);
  baseDate.setMinutes(baseDate.getMinutes() + toAdd - 60 * 3); //GMT-3
  return baseDate.toISOString().split(".")[0]!;
}

export async function getTokenUseExtraTime(lockerSerial: string) {
  const tokenUseExtraTimeDbResult = await db
    .select({ tokenUseExtraTime: stores.firstTokenUseTime })
    .from(stores)
    .innerJoin(storesLockers, eq(stores.identifier, storesLockers.storeId))
    .where(eq(storesLockers.serieLocker, lockerSerial));
  const { tokenUseExtraTime } = tokenUseExtraTimeDbResult[0]!;
  return tokenUseExtraTime;
}

export async function editTokenToServerWithStoreExtraTime(
  token: string,
  webhook: LockerWebhook,
  bearerToken: string,
) {
  const tokenUseExtraTime = await getTokenUseExtraTime(webhook.nroSerieLocker);

  const tokenEndDate = addMinutes(webhook.fechaCreacion, tokenUseExtraTime!);

  const tokenEditBody: TokenRequestEditionBody = {
    token1: token,
    fechaFin: tokenEndDate,
    idBox: -1, //Necesita este valor para que mantenga el box que ya tenía asignado
  };

  console.log(
    "Petición al servidor para editar con el siguiente body:",
    tokenEditBody,
  );

  const editDeliveryTokenResponse = await editTokenToServer(
    tokenEditBody,
    webhook.nroSerieLocker,
    bearerToken,
  );

  return editDeliveryTokenResponse;
}

export async function getLockerAddressForEmail(lockerSerial: string) {
  const lockerAddressDbResult = await db
    .select({
      lockerAddress: stores.address,
      storeName: stores.name,
      storeNameStic: stores.stic_pickup_point_name
    })
    .from(stores)
    .innerJoin(storesLockers, eq(stores.identifier, storesLockers.storeId))
    .where(eq(storesLockers.serieLocker, lockerSerial));

  return lockerAddressDbResult[0]!;
}
