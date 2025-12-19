import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { env } from "~/env";
import { PrivateConfigKeys } from "~/lib/config";
import { db, schema } from "~/server/db";
import { and, eq } from "drizzle-orm";

export const emailRouter = createTRPCRouter({
  sendEmail: publicProcedure
    .input(
      z.object({
        to: z.string(),
        token: z.array(z.tuple([z.number(), z.string()])),
        price: z.number(),
        coin: z.string().optional().nullable(),
        client: z.string(),
        local: z.string(),
        address: z.string(),
        nReserve: z.number(),
        from: z.string(),
        until: z.string(),
        entityId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email_sender_config: PrivateConfigKeys = "email_sender";
      let email_sender: string | undefined = (
        await db.query.privateConfig.findFirst({
          where: and(
            eq(schema.privateConfig.key, email_sender_config),
            eq(schema.privateConfig.entidadId, input.entityId),
          ),
        })
      )?.value;

      if (email_sender?.trim() === "") {
        email_sender = undefined;
      }

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
          input.token.map(async (token, index) => {
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
          }),
        );
        const sgMail = require("@sendgrid/mail");
        sgMail.setApiKey(env.SENDGRID_API_KEY);
        const msg = {
          to: input.to,
          from: `${email_sender ?? env.MAIL_SENDER}`,
          subject: `PICKPACK: Confirmación de reserva de locker`,
          html: `
         
          <body>
          <p>Estimado/a ${input.client},</p>
          <p>Nos complace confirmar que tu reserva en ${input.local} en ${input.address} ha sido exitosamente procesada. </p>


          <p><strong>N° Reserva</strong></p>
          <p><strong>${input.nReserve}</strong></p>


          <p><strong>Período</strong></p>
          <p>Entrega desde              ${input.from}</p>
          <p>Recogida hasta             ${input.until}</p>
        
          <p><strong>Códigos de acceso (Tokens)</strong></p>

          <p>
            ${input.token
              .map((x) => {
                return `El código de acceso (token) para guardar su paquete es <strong>${x[0]} (${x[1]})</strong><br>`;
              })
              .join("")}
          </p>

          <hr>

          <p><strong>Precio Total</strong>         ${input.coin ?? ""} ${input.price}</p>

          
          <p>Atentamente,</p>
				  <p>el equipo de <strong>PickPack</strong></p>
          
          
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
      } catch (error: any) {
        console.log(error);
      }
    }),
});
