import * as stripe from "./stripe.js";
// future: import * as mercadopago from "./mercadopago.js";
// future: import * as paypal from "./paypal.js";
// future: import * as nowpayments from "./nowpayments.js";

const DRIVERS = { stripe };
const NAMES = Object.keys(DRIVERS);

export function listGateways() {
  return NAMES;
}

export function getGateway(name) {
  const n = String(name).toLowerCase();
  if (!DRIVERS[n]) throw new Error(`Unsupported billing gateway: ${name}`);
  return DRIVERS[n];
}

export function isGatewaySupported(name) {
  return NAMES.includes(String(name).toLowerCase());
}
