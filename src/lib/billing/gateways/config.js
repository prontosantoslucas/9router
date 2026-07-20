import { getGatewayConfig } from "@/lib/billing/gatewayConfigRepo.js";

const ENV_MAP = {
  stripe:       { secret: "STRIPE_SECRET_KEY",       webhook: "STRIPE_WEBHOOK_SECRET" },
  mercadopago:  { accessToken: "MERCADOPAGO_ACCESS_TOKEN",  webhook: "MERCADOPAGO_WEBHOOK_SECRET" },
  paypal:       { clientId: "PAYPAL_CLIENT_ID",       secret: "PAYPAL_SECRET",       webhookId: "PAYPAL_WEBHOOK_ID",       baseUrl: "PAYPAL_BASE_URL" },
  nowpayments:  { apiKey: "NOWPAYMENTS_API_KEY",      ipnSecret: "NOWPAYMENTS_IPN_SECRET",      email: "NOWPAYMENTS_EMAIL",      password: "NOWPAYMENTS_PASSWORD" },
};

export async function loadGatewayConfig(gateway) {
  const dbConfig = await getGatewayConfig(gateway);
  const envMap = ENV_MAP[gateway] || {};
  if (dbConfig?.enabled && dbConfig?.data) {
    const merged = { ...dbConfig.data };
    for (const [key, envVar] of Object.entries(envMap)) {
      if (process.env[envVar] && !merged[key]) merged[key] = process.env[envVar];
    }
    return merged;
  }
  return null;
}
