import { google } from "googleapis";
import { config } from "../config.js";
import { getGoogleTokens, saveGoogleTokens } from "../db/db.js";

// OAuth2 client — persistente ao carregar tokens do DB
function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  const stored = getGoogleTokens();
  if (stored) {
    client.setCredentials({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
      expiry_date: stored.expires_at ? new Date(stored.expires_at).getTime() : undefined,
      scope: stored.scope,
    });
    // Sempre que houver refresh, salva no DB
    client.on("tokens", (tokens) => {
      saveGoogleTokens({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || stored.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scope: tokens.scope || stored.scope,
      });
    });
  }
  return client;
}

// ============================================================
// URL de autorização (chamada pelo /setup/google no server)
// ============================================================
export function getAuthUrl(state) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",  // força retornar refresh_token
    scope: ["https://www.googleapis.com/auth/calendar"],
    ...(state ? { state } : {}),
  });
}

// ============================================================
// Trocar code por tokens no callback
// ============================================================
export async function exchangeCodeForTokens(code) {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
  const { tokens } = await client.getToken(code);
  saveGoogleTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    scope: tokens.scope,
  });
  return { success: true };
}

// ============================================================
// FreeBusy — slots ocupados num range
// ============================================================
export async function listBusySlots({ startISO, endISO }) {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: startISO,
      timeMax: endISO,
      items: [{ id: config.google.calendarId }],
    },
  });
  return data.calendars[config.google.calendarId]?.busy || [];
}

// ============================================================
// Criar evento
// ============================================================
export async function createCalendarEvent({ summary, description, startISO, durationMinutes = 30 }) {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const { data } = await calendar.events.insert({
    calendarId: config.google.calendarId,
    requestBody: {
      summary,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 24 * 60 },
        ],
      },
    },
  });
  return { id: data.id, htmlLink: data.htmlLink };
}
