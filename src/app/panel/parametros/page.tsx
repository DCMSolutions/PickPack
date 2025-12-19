"use client";

import LayoutContainer from "~/components/layout-container";
import { api } from "~/trpc/react";

import { PublicConfigMetodoPago, type PublicConfigMetodoPagoKeys } from "~/lib/config";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { useEffect, useState } from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Loader2Icon, PlusCircleIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { FormPrivateGeneric } from "./util";

function FormMetodoPago({ invalidate }: { invalidate: () => void }) {
  const [open, setOpen] = useState(false);
  const [metodo, setMetodo] = useState<PublicConfigMetodoPagoKeys>("mercadopago");
  const [clave1, setClave1] = useState("");
  const [clave2, setClave2] = useState("");
  const [clave3, setClave3] = useState("");
  const [clave4, setClave4] = useState("");
  const { mutateAsync: setPrivateKey, isLoading: isLoadingPrivate } = api.config.setPrivateKeyAdmin.useMutation();
  const { mutateAsync: setPublicKey, isLoading: isLoadingPublic } = api.config.setPublicKeyAdmin.useMutation();
  const { data: claveOriginalMetodo, refetch: refetch1 } = api.config.getKeyProt.useQuery({ key: 'metodo_pago' });
  const { data: claveOriginalPublicaMp, refetch: refetch2 } = api.config.getKeyProt.useQuery({ key: 'mercadopago_public_key' });
  const { data: claveOriginalPrivadaMp, refetch: refetch3 } = api.config.getPrivateKey.useQuery({ key: 'mercadopago_private_key' });
  const { data: claveOriginalWhMp, refetch: refetch4 } = api.config.getPrivateKey.useQuery({ key: 'mercadopago_webhook_key' });
  const { data: claveOriginalWhUrl, refetch: refetch5 } = api.config.getPrivateKey.useQuery({ key: 'mercadopago_webhook_url' });
  const { data: claveMobbexApi, refetch: refetch6 } = api.config.getPrivateKey.useQuery({ key: 'mobbex_api_key' });
  const { data: claveMobbexToken, refetch: refetch7 } = api.config.getPrivateKey.useQuery({ key: 'mobbex_access_token' });

  const isLoading = isLoadingPrivate || isLoadingPublic;

  useEffect(() => {
    if (open) {
      setMetodo((claveOriginalMetodo?.value ?? "mercadopago") as PublicConfigMetodoPagoKeys);
    }
  }, [open]);

  useEffect(() => {
    if (metodo === 'mercadopago' && claveOriginalPublicaMp) {
      setClave1(claveOriginalPublicaMp.value);
    } else if (metodo === 'mercadopago') {
      setClave1("");
    }

    if (metodo === 'mercadopago' && claveOriginalPrivadaMp) {
      setClave2(claveOriginalPrivadaMp.value);
    } else if (metodo === 'mercadopago') {
      setClave2("");
    }

    if (metodo === 'mercadopago' && claveOriginalWhMp) {
      setClave3(claveOriginalWhMp.value);
    }

    if (metodo === 'mercadopago' && claveOriginalWhUrl) {
      setClave4(claveOriginalWhUrl.value);
    }

    if (metodo === 'mobbex' && claveMobbexApi) {
      setClave1(claveMobbexApi.value);
    } else if (metodo === 'mobbex') {
      setClave1("");
    }

    if (metodo === 'mobbex' && claveMobbexToken) {
      setClave2(claveMobbexToken.value);
    } else if (metodo === 'mobbex') {
      setClave2("");
    }
  }, [metodo, claveOriginalPublicaMp, claveOriginalPrivadaMp, claveMobbexApi, claveMobbexToken, claveOriginalMetodo, claveOriginalWhUrl, claveOriginalWhMp]);

  async function handle() {
    await setPublicKey({ key: 'metodo_pago', value: metodo });

    if (metodo === 'mobbex') {
      await setPrivateKey({ key: 'mobbex_api_key', value: clave1 });
      await setPrivateKey({ key: 'mobbex_access_token', value: clave2 });
    } else if (metodo === 'mercadopago') {
      await setPublicKey({ key: 'mercadopago_public_key', value: clave1 });
      await setPrivateKey({ key: 'mercadopago_private_key', value: clave2 });
      await setPrivateKey({ key: 'mercadopago_webhook_key', value: clave3 });
      await setPrivateKey({ key: 'mercadopago_webhook_url', value: clave4 });
    }

    // no furula api.useUtils()
    await refetch1();
    await refetch2();
    await refetch3();
    await refetch4();
    await refetch5();
    await refetch6();
    await refetch7();

    invalidate();
    setOpen(false);
  }

  return <div className="m-2">
    <Button onClick={() => setOpen(true)} className="rounded-full gap-1 px-4 py-5 text-base text-[#3E3E3E] bg-[#d0d0d0] hover:bg-[#ffffff]">
      {isLoading ? (
        <Loader2Icon className="h-4 mr-1 animate-spin" size={20} />
      ) : (
        <PlusCircleIcon className="h-5 mr-1 stroke-1" />
      )}
      Configurar método de pago
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configurar método de pago</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col">
            <Label htmlFor="valor" className="mb-2">Método de pago</Label>
            <Select onValueChange={v => setMetodo(v as PublicConfigMetodoPagoKeys)} value={metodo}>
              <SelectTrigger className="font-bold">
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(PublicConfigMetodoPago).map(v => 
                  <SelectItem key={`mp-id-${v}`} value={v}>{PublicConfigMetodoPago[v as PublicConfigMetodoPagoKeys]}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {(metodo === 'mercadopago' || metodo === 'mobbex') && <div className="font-bold">
            <Label htmlFor="clave1">{metodo === 'mercadopago' ? "Clave pública de Mercado Pago" : 'Clave API de Mobbex'}</Label>
            <Input
              id="clave1"
              value={clave1}
              onChange={(e) => setClave1(e.target.value)}
              required
            />
          </div>}

          {(metodo === 'mercadopago' || metodo === 'mobbex') && <div className="font-bold">
            <Label htmlFor="clave2">{metodo === 'mercadopago' ? "Clave privada de Mercado Pago" : 'Token de acceso de Mobbex'}</Label>
            <Input
              id="clave2"
              value={clave2}
              onChange={(e) => setClave2(e.target.value)}
              required
            />
          </div>}

          {metodo === 'mercadopago' && <div className="font-bold">
            <Label htmlFor="clave3">Clave secreta de Webhook de Mercado Pago</Label>
            <Input
              id="clave3"
              value={clave3}
              onChange={(e) => setClave3(e.target.value)}
              required
            />
          </div>}

          {metodo === 'mercadopago' && <div className="font-bold">
            <Label htmlFor="clave4">URL de Webhook de Mercado Pago</Label>
            <Input
              id="clave4"
              value={clave4}
              onChange={(e) => setClave4(e.target.value)}
              required
            />
          </div>}
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            disabled={isLoading}
            onClick={handle}
            className="flex rounded-full w-fit justify-self-center text-[#3E3E3E] bg-[#d0d0d0] hover:bg-[#ffffff]"
          >
            {isLoading ? (
              <Loader2Icon className="h-4 mr-1 animate-spin" size={20} />
            ) : (
              <PlusCircleIcon className="h-4 mr-1 stroke-1" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}

function FormPlazoReserva({ invalidate }: { invalidate: () => void }) {
  const [open, setOpen] = useState(false);
  const [isHabilitado, setIsHabilitado] = useState(false);
  const { mutateAsync: setPublicKey, isLoading: isLoadingPublic } = api.config.setPublicKeyAdmin.useMutation();
  const { data: claveOriginal, refetch: refetch1 } = api.config.getKeyProt.useQuery({ key: 'reserve_from_now' });
  const isLoading = isLoadingPublic;

  useEffect(() => {
    if (open) {
      setIsHabilitado((claveOriginal?.value.trim().toLowerCase() ?? "false") === "true");
    }
  }, [open]);

  useEffect(() => {
    if (claveOriginal) {
      setIsHabilitado(claveOriginal.value.trim().toLowerCase() === "true");
    } else {
      setIsHabilitado(false);
    }
  }, [claveOriginal]);

  async function handle() {
    await setPublicKey({ key: 'reserve_from_now', value: String(isHabilitado) });
    await refetch1();
    invalidate();
    setOpen(false);
  }

  return <div className="m-2">
    <Button onClick={() => setOpen(true)} className="rounded-full gap-1 px-4 py-5 text-base text-[#3E3E3E] bg-[#d0d0d0] hover:bg-[#ffffff]">
      {isLoading ? (
        <Loader2Icon className="h-4 mr-1 animate-spin" size={20} />
      ) : (
        <PlusCircleIcon className="h-5 mr-1 stroke-1" />
      )}
      Configurar plazo de reserva
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configurar plazo de reserva</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col">
            <Label htmlFor="valor" className="mb-2">Plazo de reserva</Label>
            <Select onValueChange={v => setIsHabilitado(v === "true")} value={isHabilitado ? "true" : "false"}>
              <SelectTrigger className="font-bold">
                <SelectValue placeholder="Plazo de reserva" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={"false"}>Hacer reservas desde 00:00hs a 23:59hs</SelectItem>
                <SelectItem value={"true"}>Hacer reservas desde ahora</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            disabled={isLoading}
            onClick={handle}
            className="flex rounded-full w-fit justify-self-center text-[#3E3E3E] bg-[#d0d0d0] hover:bg-[#ffffff]"
          >
            {isLoading ? (
              <Loader2Icon className="h-4 mr-1 animate-spin" size={20} />
            ) : (
              <PlusCircleIcon className="h-4 mr-1 stroke-1" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}

export default function LockerOcupationPage() {
  // Consulta de datos con fechas seleccionadas
  const { data: timeOut } = api.params.getTimeOut.useQuery();
  const { data: privateConfigs, refetch: refetchPrivate } = api.config.listPrivateAdmin.useQuery();
  const { data: publicConfigs, refetch: refetchPublic } = api.config.listPublicAdmin.useQuery();
  const { data: currentEntityId } = api.companies.current.useQuery();

  async function invalidate() {
    await refetchPrivate();
    await refetchPublic();
  }

  return (
    <LayoutContainer>
      <div className="w-full flex flex-col justify-between">
        <h2 className="text-2xl font-semibold mb-3">Parámetros</h2>
        <div className="grid grid-cols-2">
          <FormMetodoPago invalidate={invalidate} />
          <FormPlazoReserva invalidate={invalidate} />
          <FormPrivateGeneric invalidate={invalidate} keyName="token_empresa" label="Token" title="Configurar token de empresa" />
          <FormPrivateGeneric invalidate={invalidate} keyName="entidad_lockers_privados_key" label="Entidad Lockers" title="Configurar clave de entidad" />
          <FormPrivateGeneric invalidate={invalidate} keyName="batitienda_key" label="API Key batitienda" title="Token API de Batitienda" />
          <FormPrivateGeneric invalidate={invalidate} keyName="email_sender" label="Correo electrónico remitente" title="Correo electrónico remitente" />
        </div>
      </div>
      <section className="space-y-2">
        <div>(Servidor) TimeOut Mobbex: {timeOut}</div>
        <div>ID de entidad: {currentEntityId}</div>
      </section>
    </LayoutContainer>
  );
}
