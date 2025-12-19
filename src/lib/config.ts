export const PublicConfigClaves = {
  "metodo_pago": "Configuración de método de pago",
  "mercadopago_public_key": "Clave pública de Mercado Pago",
  "reserve_from_now": "Reservas desde ahora",
  "tyc_link": "URL a Términos y Condiciones",
}

export enum PublicConfigMetodoPago {
  mercadopago = "mercadopago",
  mobbex = "mobbex",
  sinpago = "sinpago",
}

export type PublicConfigMetodoPagoKeys = keyof typeof PublicConfigMetodoPago;
export type PublicConfigKeys = keyof typeof PublicConfigClaves;

export const PrivateConfigClaves = {
  "mercadopago_private_key": "Clave privada de Mercado Pago",
  "mercadopago_webhook_key": "Clave secreta de Webhook de Mercado Pago",
  "mercadopago_webhook_url": "URL de Webhook de Mercado Pago",
  "mobbex_api_key": "Clave API de Mobbex",
  "mobbex_access_token": "Token de acceso de Mobbex",
  "token_empresa": "Token Empresa",
  "entidad_lockers_privados_key": "Clave para acceso de entidad particular",
  "batitienda_key": "API Key batitienda",
  "email_sender": "Correo electrónico remitente"
}

export type PrivateConfigKeys = keyof typeof PrivateConfigClaves;
