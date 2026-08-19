import { getWebhooksByEvent, updateWebhookStatus } from "@/lib/db";

export async function fireWebhook(event, payload) {
  try {
    const webhooks = await getWebhooksByEvent(event);
    
    if (webhooks.length === 0) {
      return { fired: 0, errors: [] };
    }

    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        try {
          const body = JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            payload,
          });

          const headers = {
            "Content-Type": "application/json",
            "User-Agent": "9Router-CRM/1.0",
          };

          if (webhook.secret) {
            const crypto = await import("crypto");
            const signature = crypto
              .createHmac("sha256", webhook.secret)
              .update(body)
              .digest("hex");
            headers["X-Webhook-Signature"] = signature;
          }

          const response = await fetch(webhook.url, {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          await updateWebhookStatus(webhook.id, {
            lastFiredAt: new Date().toISOString(),
            failCount: 0,
          });

          return { id: webhook.id, success: true };
        } catch (error) {
          const newFailCount = (webhook.failCount || 0) + 1;
          await updateWebhookStatus(webhook.id, {
            failCount: newFailCount,
            isActive: newFailCount < 10,
          });

          throw error;
        }
      })
    );

    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason.message);

    return {
      fired: results.filter((r) => r.status === "fulfilled").length,
      errors,
    };
  } catch (error) {
    console.error("fireWebhook error:", error);
    return { fired: 0, errors: [error.message] };
  }
}

export const WEBHOOK_EVENTS = {
  CONTACT_CREATED: "contact.created",
  CONTACT_UPDATED: "contact.updated",
  CONTACT_DELETED: "contact.deleted",
  DEAL_CREATED: "deal.created",
  DEAL_UPDATED: "deal.updated",
  DEAL_STAGE_CHANGED: "deal.stage_changed",
  DEAL_DELETED: "deal.deleted",
  DEAL_CLOSE_APPROACHING: "deal.close_approaching",
  ALERT_CREATED: "alert.created",
  USAGE_THRESHOLD: "usage.threshold",
  BALANCE_LOW: "balance.low",
};
