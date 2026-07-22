// Google Calendar — CRUD real via googleapis.
const { google } = require("googleapis");
const { getAuthorizedClient } = require("./oauth");

function client() {
  const auth = getAuthorizedClient();
  return google.calendar({ version: "v3", auth });
}

/**
 * Lista eventos de HOJE no calendário `primary` por padrão.
 */
async function listTodayEvents({ calendarId = "primary" } = {}) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return listEvents({ calendarId, timeMin: start.toISOString(), timeMax: end.toISOString() });
}

/**
 * Lista eventos numa janela — timeMin/timeMax em ISO. Aceita `q` (busca full-text).
 */
async function listEvents({ calendarId = "primary", timeMin, timeMax, q, maxResults = 20 } = {}) {
  const cal = client();
  const res = await cal.events.list({
    calendarId,
    timeMin: timeMin || new Date().toISOString(),
    timeMax,
    q,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: Math.max(1, Math.min(250, Number(maxResults) || 20)),
  });
  return (res.data.items || []).map(normalizeEvent);
}

function normalizeEvent(e) {
  return {
    id: e.id,
    calendarId: e.organizer?.email || null,
    title: e.summary || "(sem título)",
    description: e.description || null,
    location: e.location || null,
    start: e.start?.dateTime || e.start?.date || null,
    end: e.end?.dateTime || e.end?.date || null,
    allDay: !!e.start?.date && !e.start?.dateTime,
    attendees: (e.attendees || []).map((a) => ({ email: a.email, name: a.displayName, responseStatus: a.responseStatus })),
    htmlLink: e.htmlLink,
    status: e.status,
  };
}

/**
 * Cria evento. Requer `start`, `end` (ISO ou {date:'YYYY-MM-DD'} para all-day).
 * `attendees` opcional (array de emails).
 */
async function createEvent({ title, description, location, start, end, attendees, calendarId = "primary", sendUpdates = "none" }) {
  if (!title) throw new Error("title obrigatório");
  if (!start || !end) throw new Error("start e end obrigatórios (ISO 8601)");
  const cal = client();
  const requestBody = {
    summary: title,
    description: description || undefined,
    location: location || undefined,
    start: isAllDayDate(start) ? { date: start } : { dateTime: start },
    end: isAllDayDate(end) ? { date: end } : { dateTime: end },
    attendees: (attendees || []).map((e) => (typeof e === "string" ? { email: e } : e)),
  };
  const res = await cal.events.insert({ calendarId, requestBody, sendUpdates });
  return normalizeEvent(res.data);
}

async function updateEvent(eventId, patch, { calendarId = "primary", sendUpdates = "none" } = {}) {
  const cal = client();
  const requestBody = {};
  if (patch.title !== undefined) requestBody.summary = patch.title;
  if (patch.description !== undefined) requestBody.description = patch.description;
  if (patch.location !== undefined) requestBody.location = patch.location;
  if (patch.start) requestBody.start = isAllDayDate(patch.start) ? { date: patch.start } : { dateTime: patch.start };
  if (patch.end) requestBody.end = isAllDayDate(patch.end) ? { date: patch.end } : { dateTime: patch.end };
  if (patch.attendees) requestBody.attendees = patch.attendees.map((e) => (typeof e === "string" ? { email: e } : e));
  const res = await cal.events.patch({ calendarId, eventId, requestBody, sendUpdates });
  return normalizeEvent(res.data);
}

async function deleteEvent(eventId, { calendarId = "primary", sendUpdates = "none" } = {}) {
  const cal = client();
  await cal.events.delete({ calendarId, eventId, sendUpdates });
  return { ok: true, id: eventId };
}

/**
 * Sugere primeiro slot livre entre `from` e `to` com duração `durationMin`,
 * usando freebusy.query. Trabalha em blocos de `stepMin` minutos.
 */
async function suggestFirstFreeSlot({ from, to, durationMin = 60, stepMin = 30, calendarId = "primary" }) {
  const cal = client();
  const fb = await cal.freebusy.query({
    requestBody: { timeMin: from, timeMax: to, items: [{ id: calendarId }] },
  });
  const busy = (fb.data.calendars?.[calendarId]?.busy || []).map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));
  const startMs = new Date(from).getTime();
  const endMs = new Date(to).getTime();
  const durMs = durationMin * 60 * 1000;
  const stepMs = stepMin * 60 * 1000;
  for (let t = startMs; t + durMs <= endMs; t += stepMs) {
    const slotEnd = t + durMs;
    const conflict = busy.some((b) => t < b.end && slotEnd > b.start);
    if (!conflict) return { start: new Date(t).toISOString(), end: new Date(slotEnd).toISOString() };
  }
  return null;
}

function isAllDayDate(value) {
  // "YYYY-MM-DD" (10 chars, sem 'T')
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

module.exports = {
  listTodayEvents,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  suggestFirstFreeSlot,
};
