"use client"
import { type Transaction } from "@libsql/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
/* import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"; */
import { type Client } from "~/server/api/routers/clients";
import { type Coin } from "~/server/api/routers/coin";
import { type Cupon } from "~/server/api/routers/cupones";
import { type Reserve } from "~/server/api/routers/lockerReserveRouter";
import { type Size } from "~/server/api/routers/sizes";
import { type Store } from "~/server/api/routers/store";
import { api } from "~/trpc/react";
import { PublicConfigMetodoPago } from "~/lib/config";
import { loadMercadoPago } from "@mercadopago/sdk-js";
import type { Translations } from "~/translations";

declare global {
  interface Window {
    MobbexEmbed: {
      close: () => void;
      render: (a: unknown, b: string) => void;
      init: (a: unknown) => {
        open: () => void;
      };
    };
  }
}

export default function Payment({ t, ...props }: {
  checkoutNumber: string;
  setLoadingPay: (loadingPay: boolean) => void;
  reserves: Reserve[];
  sizes: Size[];
  client: Client;
  coin: Coin;
  total: number;
  nReserve: number;
  store: Store;
  startDate: string;
  endDate: string;
  setReserves: ((reserves: Reserve[]) => void) | null;
  setPagoOk: (pagoOk: boolean) => void;
  cupon: Cupon | null | undefined;
  isExt: boolean;
  t: Translations;
}) {
  const { mutateAsync: confirmarBox } =
    api.lockerReserve.confirmBox.useMutation();
  const { mutateAsync: createReserve } = api.reserve.create.useMutation();
  const { mutateAsync: getReserves } = api.reserve.getByidTransactionsMut.useMutation();
  const { mutateAsync: useCupon } = api.cupones.useCupon.useMutation();
  const { mutateAsync: createTransaction } =
    api.transaction.create.useMutation();
  const [transaction, setTransaction] = useState<Transaction>();
  const { mutateAsync: sendEmail } = api.email.sendEmail.useMutation();
  const { mutateAsync: mpPreferenceGet } = api.mp.getPreference.useMutation();
  const { data: medioPagoRes } = api.config.getKey.useQuery({ key: 'metodo_pago', entityId: props.store.entidadId ?? "" });
  const { data: mpPublicKey } = api.config.getKey.useQuery({ key: 'mercadopago_public_key', entityId: props.store.entidadId ?? "" });
  const { mutateAsync: isPagadoMp } = api.mp.areReservesPaid.useMutation();
  const [medioConfigurado, setMedioConfigurado] = useState<PublicConfigMetodoPago | null>(null);
  const [mpClavePrimeraCarga, setMpClavePrimeraCarga] = useState<string | null>(null);
  // const [mpPreference, setMpPreference] = useState("");

  const idTransactions = useMemo(() => props.reserves
    .map(v => v.IdTransaction)
    .filter(v => {
      if (typeof v !== 'number') {
        console.error("reserva sin IdTransaction");
        return false;
      } else {
        return true;
      }
    }) as number[], [props.reserves]);

  // solo define mpClavePrimeraCarga si
  // mpPublicKey existe y no se había definido antes
  useEffect(() => {
    if (mpPublicKey && !mpClavePrimeraCarga) {
      setMpClavePrimeraCarga(mpPublicKey.value);
    }
  }, [mpPublicKey, mpClavePrimeraCarga]);

  useEffect(() => {
    if (medioConfigurado === null && medioPagoRes) {
      if (Object.values(PublicConfigMetodoPago).includes(medioPagoRes.value as PublicConfigMetodoPago)) {
        setMedioConfigurado(medioPagoRes.value as PublicConfigMetodoPago);
      } else {
        console.error('medioPagoRes es inválido:', medioPagoRes);
      }
    }
  }, [medioPagoRes]);

  useEffect(() => {
    if (medioConfigurado === PublicConfigMetodoPago.mercadopago && mpClavePrimeraCarga) {
      (async () => {
        await loadMercadoPago();

        const mp = new window.MercadoPago(mpClavePrimeraCarga, {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          locale: "es-AR" as unknown as never,
        });
  
        const bricks = mp.bricks();
        await bricks.create("wallet", "mp-container", {
          callbacks: {
            onSubmit: async () => {
              const res = await mpPreferenceGet({
                price: props.total,
                productName: "Reserva de locker",
                quantity: 1,
                IdTransactions: idTransactions,
                meta: {
                  client_email: props.client.email!,
                  client_name: props.client.name ?? "",
                  client_surname: props.client.surname ?? "",
                  coin_description: props.coin.description,
                  cupon_id: props.cupon?.identifier,
                  end_date: props.endDate,
                  start_date: props.startDate,
                  is_ext: props.isExt,
                  n_reserve: props.nReserve,
                  store_address: props.store.address ?? "",
                  store_name: props.store.name,
                  total: props.total,
                  entidad_id: props.store.entidadId ?? "",
                },
                href: window.location.href,
                entityId: props.store.entidadId ?? "",
              });

              return res.preferenceId;
            }
          },
          initialization: {
            redirectMode: 'blank',
          }
        });

        const interval = setInterval(() => {
          isPagadoMp({
            IdTransactions: idTransactions,
            entityId: props.store.entidadId ?? "",
          }).then(e => {
            console.log('isPagadoMp', e);
            if (e) {
              success()
                .then(console.log)
                .catch(console.error);
              clearInterval(interval);
            }
          }).catch(e => {
            console.error("isPagadoMp error", e);
          })
        }, 1000)
      })()
        .then(console.log)
        .catch(console.error);
    }
  }, [medioConfigurado, mpClavePrimeraCarga]);

  function formatDateToTextDate(dateString: string): string {
    const date = new Date(dateString);
    const formattedDate = format(date, "eee dd MMMM HH:mm", { locale: es });
    return formattedDate;
  }

  // const [mpPaymentId, setMpPaymentId] = useState("");

  async function success() {
    if (medioConfigurado === PublicConfigMetodoPago.mercadopago) {
      const reserves = await getReserves({
        idTransactions: idTransactions,
        entityId: props.store.entidadId ?? "",
      });

      if (props.setReserves) {
        props.setReserves(reserves.map(r => ({
          ...r,
          Cantidad: typeof r.Cantidad !== 'number' ? undefined : r.Cantidad,
          IdTransaction: typeof r.IdTransaction !== 'number' ? undefined : r.IdTransaction,
        })));
      }

      props.setLoadingPay(false);
      props.setPagoOk(true);
      return;
    }

    try {
      props.setLoadingPay(true);
      const token: [number, string][] = [];
      const updatedReserves = await Promise.all(
        props.reserves.map(async (reserve) => {
          if (!reserve.IdTransaction) {
            return reserve;
          }

          //si no es extension, el idtransaction es con el que se confirma el box. si es extension, el idtransaction es el de mobbex
          let response = await confirmarBox({
            idToken: reserve.IdTransaction!,
            nReserve: props.nReserve,
            entityId: props.store.entidadId ?? "",
          });

          if (response) {
            if (props.isExt) {
              token.push([
                reserve.Token1!,
                props.sizes.find((x) => x.id === reserve.IdSize)?.nombre! ?? "",
              ]);
              
              const updatedReserve = await createReserve({
                Contador: reserve.Contador,
                FechaCreacion: reserve.FechaCreacion,
                FechaInicio: props.startDate,
                FechaFin: props.endDate,
                IdFisico: reserve.IdFisico,
                IdBox: reserve.IdBox,
                IdSize: reserve.IdSize,
                NroSerie: reserve.NroSerie!,
                Token1: reserve.Token1,
                Cantidad: reserve.Cantidad,
                client: reserve.client,
                Confirmado: reserve.Confirmado,
                IdLocker: reserve.IdLocker,
                IdTransaction: reserve.IdTransaction,
                Modo: reserve.Modo,
                nReserve: props.nReserve,
                entityId: props.store.entidadId ?? "",
              });

              if (props.setReserves) {
                props.setReserves([updatedReserve!]);
              }
            } else {
              token.push([
                response,
                props.sizes.find((x) => x.id === reserve.IdSize)?.nombre! ?? "",
              ]);
            }

            await createTransaction({
              ...transaction,
              client: reserve.client,
              amount: props.total,
              nReserve: props.nReserve,
              entityId: props.store.entidadId ?? "",
            });

            if (props.cupon) {
              await useCupon({ identifier: props.cupon.identifier, entityId: props.store.entidadId ?? "", });
            }
          }

          return {
            ...reserve,
            Token1: props.isExt ? reserve.Token1 : response,
            idToken: reserve.IdTransaction,
            nReserve: props.nReserve,
          };
        }),
      );

      if (props.setReserves) props.setReserves(updatedReserves);
      await sendEmail({
        to: props.client.email!,
        token,
        client: props.client.name ?? "",
        price: props.total,
        coin: props.coin.description,
        local: props.store!.name!,
        address: props.store!.address ?? "",
        nReserve: props.nReserve,
        from: formatDateToTextDate(props.startDate!),
        until: formatDateToTextDate(props.endDate!),
        entityId: props.store.entidadId ?? "",
      });

      props.setLoadingPay(false);
      props.setPagoOk(true);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    if (medioConfigurado === PublicConfigMetodoPago.mobbex) {
      let statusCode = 0;
      if (props.checkoutNumber) {
        const options = {
          id: props.checkoutNumber,
          type: "checkout",
          onResult: (data: any) => {
            // OnResult es llamado cuando se toca el Botón Cerrar
            window.MobbexEmbed.close();
          },
          onPayment: async (data: any) => {
            statusCode = parseInt(data.data.status.code);
            if (statusCode == 200) {
              await success();
            } else {
              // location.reload();
            }
          },
          onOpen: () => {
            console.info("Pago iniciado.");
          },
          onError: (error: any) => {
            console.error("ERROR: ", error);
          },
          onClose: (error: any) => {
            if (statusCode != 200) {
              location.reload();
            }
          },
        };

        function renderMobbexButton() {
          window.MobbexEmbed.render(options, "#mbbx-button");
        }

        function initMobbexPayment() {
          const mbbxButton = window.MobbexEmbed.init(options);
          mbbxButton.open();
        }

        const script = document.createElement("script");
        script.src = `https://res.mobbex.com/js/embed/mobbex.embed@1.0.23.js?t=${Date.now()}`;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.addEventListener("load", () => {
          initMobbexPayment(); // Abre inmediatamente el modal de pago
        });
        document.body.appendChild(script);

        return () => {
          document.body.removeChild(script);
        };
      }
    } else if (medioConfigurado === PublicConfigMetodoPago.sinpago) {
      setTimeout(() => {
        success();
      }, 500);
    }
  }, [props.checkoutNumber]);

  return (
    <>
      <>
        <div id="mp-container" />
        {medioConfigurado === PublicConfigMetodoPago.mobbex && <>
          <Script
            src="https://res.mobbex.com/js/sdk/mobbex@1.1.0.js"
            integrity="sha384-7CIQ1hldcQc/91ZpdRclg9KVlvtXBldQmZJRD1plEIrieHNcYvlQa2s2Bj+dlLzQ"
            crossOrigin="anonymous"
          />
          <div id="mbbx-container"></div>{" "}
        </>}
      </>
    </>
  );
}
