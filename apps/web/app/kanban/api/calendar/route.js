import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { ECONOMICS_STORAGE_BUCKET, writeEconomicsAudit } from "@/lib/economics-db";
import { ECONOMICS_CSRF_COOKIE } from "@/lib/economics-session";
import { economicsJson, requireEconomicsContext } from "@/app/economics/api/_lib/auth";
import {
  getCalendarConnection,
  getGoogleCalendarAccessToken,
  googleCalendarRequest,
  hasGoogleCalendarOAuthConfig,
  normalizeCalendarIds,
  updateCalendarSelection
} from "@/lib/kanban-google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOARD_FILE = "kanban/board.json";
const COLUMNS = new Set(["todo", "doing", "done"]);
const OWNERS = new Set(["Sem dono", "Vitor", "Nathalie", "Ambos"]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const REMINDERS = new Set(["none", "same_day", "one_day", "three_days", "one_week"]);
const TIME_ZONE = "America/Sao_Paulo";
const UPCOMING_CALENDAR_LIMIT = 10;
const UPCOMING_EVENT_LIMIT = 12;
const UPCOMING_EVENTS_PER_CALENDAR = 12;

export async function GET() {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: "Sessao Kanban ausente ou expirada." }, context.status);

  const connection = await getCalendarConnection(context);
  if (!connection.connected) {
    return economicsJson({
      ok: true,
      connected: false,
      configured: hasGoogleCalendarOAuthConfig(),
      calendars: [],
      selectedCalendarIds: [],
      syncCalendarId: "primary",
      events: []
    });
  }

  const token = await getGoogleCalendarAccessToken(context);
  if (!token.ok) {
    return economicsJson({
      ok: true,
      connected: true,
      needsReconnect: true,
      configured: hasGoogleCalendarOAuthConfig(),
      calendars: [],
      selectedCalendarIds: connection.selectedCalendarIds,
      syncCalendarId: connection.syncCalendarId,
      events: [],
      message: token.message
    });
  }

  const calendars = await listCalendars(token.accessToken);
  const selectedCalendarIds = selectedCalendars(connection, calendars);
  const events = await listUpcomingEvents(token.accessToken, selectedCalendarIds);

  return economicsJson({
    ok: true,
    connected: true,
    configured: hasGoogleCalendarOAuthConfig(),
    calendars,
    selectedCalendarIds,
    selectionMode: connection.selectionMode,
    syncCalendarId: connection.syncCalendarId || selectedCalendarIds[0] || "primary",
    events
  });
}

export async function POST(request) {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: "Sessao Kanban ausente ou expirada." }, context.status);
  if (!(await hasValidCsrf(request))) return economicsJson({ ok: false, message: "Sessao expirada. Entre novamente no Kanban." }, 403);

  const body = await request.json().catch(() => ({}));
  const action = clean(body.action);

  if (action === "select_calendars") {
    const result = await updateCalendarSelection(context, {
      selectedCalendarIds: body.selectedCalendarIds,
      syncCalendarId: body.syncCalendarId
    });
    if (!result.ok) return economicsJson({ ok: false, message: result.message }, result.status || 400);
    return economicsJson({ ok: true, ...result });
  }

  if (action === "sync_card") {
    const result = await syncCard(context, clean(body.cardId));
    return economicsJson(result, result.ok ? 200 : result.status || 400);
  }

  return economicsJson({ ok: false, message: "Acao invalida." }, 400);
}

async function syncCard(context, cardId) {
  if (!cardId) return { ok: false, status: 400, message: "Card nao informado." };
  const board = await readBoard(context);
  const card = board.cards.find((item) => item.id === cardId);
  if (!card) return { ok: false, status: 404, message: "Card nao encontrado." };
  if (!card.dueDate) return { ok: false, status: 400, message: "Defina uma data limite antes de sincronizar." };

  const token = await getGoogleCalendarAccessToken(context);
  if (!token.ok) return { ok: false, status: 401, needsReconnect: true, message: token.message };

  const calendarId = card.googleCalendar?.calendarId || token.connection?.syncCalendarId || token.connection?.selectedCalendarIds?.[0] || "primary";
  const eventBody = buildEventBody(card);
  const eventId = clean(card.googleCalendar?.eventId);
  let response = null;

  if (eventId) {
    response = await googleCalendarRequest(token.accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: eventBody
    });
  }

  if (!response?.ok) {
    const existing = await findExistingEvent(token.accessToken, calendarId, card.id);
    if (existing?.id) {
      response = await googleCalendarRequest(token.accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing.id)}`, {
        method: "PATCH",
        body: eventBody
      });
    } else {
      response = await googleCalendarRequest(token.accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: "POST",
        body: eventBody
      });
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status === 401 ? 401 : 502,
      needsReconnect: response.status === 401,
      message: response.status === 401 ? "Reconecte o Google Calendar." : response.message
    };
  }

  const event = response.payload;
  const syncedBoard = normalizeBoard({
    ...board,
    cards: board.cards.map((item) => (
      item.id === card.id
        ? {
            ...item,
            googleCalendar: {
              eventId: event.id,
              calendarId,
              htmlLink: event.htmlLink || "",
              syncedAt: new Date().toISOString(),
              sourceHash: cardSyncHash(item)
            }
          }
        : item
    ))
  });
  await writeBoard(context, syncedBoard);

  await writeEconomicsAudit(context.supabase, {
    householdId: context.householdId,
    actorEmail: context.member.email,
    eventType: "kanban.calendar.synced",
    entityType: "kanban_card",
    entityId: card.id,
    metadata: { calendarId, eventId: event.id }
  });

  return {
    ok: true,
    card: syncedBoard.cards.find((item) => item.id === card.id),
    event: {
      id: event.id,
      htmlLink: event.htmlLink || "",
      summary: event.summary || card.title
    }
  };
}

async function listCalendars(accessToken) {
  const response = await googleCalendarRequest(accessToken, "/users/me/calendarList?minAccessRole=reader");
  if (!response.ok) return [];
  return (response.payload.items || [])
    .filter((calendar) => !calendar.deleted)
    .map((calendar) => ({
      id: calendar.id,
      summary: calendar.summaryOverride || calendar.summary || calendar.id,
      primary: Boolean(calendar.primary),
      selected: Boolean(calendar.selected),
      accessRole: calendar.accessRole || "reader",
      backgroundColor: calendar.backgroundColor || "#2563eb"
    }))
    .sort(calendarSort)
    .slice(0, 30);
}

async function listUpcomingEvents(accessToken, calendarIds) {
  const ids = normalizeCalendarIds(calendarIds).length ? normalizeCalendarIds(calendarIds) : ["primary"];
  const timeMin = startOfLocalDay(new Date()).toISOString();
  const timeMax = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
  const allEvents = [];

  for (const calendarId of ids.slice(0, UPCOMING_CALENDAR_LIMIT)) {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      timeMax,
      timeZone: TIME_ZONE,
      maxResults: String(UPCOMING_EVENTS_PER_CALENDAR)
    });
    const response = await googleCalendarRequest(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
    if (!response.ok) continue;
    for (const event of response.payload.items || []) {
      if (event.status === "cancelled") continue;
      allEvents.push({
        id: event.id,
        calendarId,
        title: event.summary || "Sem titulo",
        start: event.start?.dateTime || event.start?.date || "",
        end: event.end?.dateTime || event.end?.date || "",
        allDay: Boolean(event.start?.date),
        htmlLink: event.htmlLink || ""
      });
    }
  }

  return allEvents
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, UPCOMING_EVENT_LIMIT);
}

function selectedCalendars(connection, calendars) {
  const saved = normalizeCalendarIds(connection?.selectedCalendarIds);
  if (connection?.selectionMode === "manual" && saved.length) return saved;

  const recommended = recommendedCalendarIds(calendars);
  const merged = normalizeCalendarIds([...saved, ...recommended]);
  if (merged.length) return merged;

  const primary = calendars.find((calendar) => calendar.primary)?.id;
  return [primary || "primary"];
}

function recommendedCalendarIds(calendars) {
  const ids = [];
  for (const calendar of calendars) {
    if (calendar.primary) ids.push(calendar.id);
  }
  for (const calendar of calendars) {
    if (!calendar.primary && isBirthdayCalendar(calendar)) ids.push(calendar.id);
  }
  for (const calendar of calendars) {
    if (!calendar.primary && !isBirthdayCalendar(calendar) && calendar.selected) {
      ids.push(calendar.id);
    }
  }
  return normalizeCalendarIds(ids).slice(0, UPCOMING_CALENDAR_LIMIT);
}

function isBirthdayCalendar(calendar) {
  const text = `${calendar?.id || ""} ${calendar?.summary || ""}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /birthday|birthdays|aniversario|aniversarios|contacts/.test(text);
}

function calendarSort(a, b) {
  if (a.primary !== b.primary) return a.primary ? -1 : 1;
  if (a.selected !== b.selected) return a.selected ? -1 : 1;
  if (isBirthdayCalendar(a) !== isBirthdayCalendar(b)) return isBirthdayCalendar(a) ? -1 : 1;
  return clean(a.summary).localeCompare(clean(b.summary), "pt-BR");
}

function startOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function findExistingEvent(accessToken, calendarId, cardId) {
  const params = new URLSearchParams({
    privateExtendedProperty: `kanbanCardId=${cardId}`,
    singleEvents: "true",
    maxResults: "1"
  });
  const response = await googleCalendarRequest(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
  if (!response.ok) return null;
  return (response.payload.items || []).find((event) => event.status !== "cancelled") || null;
}

function buildEventBody(card) {
  const dueTime = normalizeTime(card.dueTime);
  const base = {
    summary: `Kanban: ${card.title}`,
    description: [
      `Tarefa do Kanban da familia.`,
      `Grupo: ${card.group}`,
      `Dono: ${card.owner}`,
      `Prioridade: ${card.priority}`
    ].join("\n"),
    extendedProperties: {
      private: {
        kanbanCardId: card.id,
        kanbanSource: "claudiocode-family-kanban"
      }
    }
  };

  if (dueTime) {
    const start = `${card.dueDate}T${dueTime}:00`;
    const end = addMinutesToLocalDateTime(card.dueDate, dueTime, 45);
    return {
      ...base,
      start: { dateTime: start, timeZone: TIME_ZONE },
      end: { dateTime: end, timeZone: TIME_ZONE }
    };
  }

  return {
    ...base,
    start: { date: card.dueDate },
    end: { date: nextDate(card.dueDate) }
  };
}

async function readBoard(context) {
  const { data, error } = await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).download(boardPath(context.householdId));
  if (error || !data) return { imports: {}, cards: [] };
  const text = await data.text().catch(() => "");
  return normalizeBoard(parseJson(text));
}

async function writeBoard(context, board) {
  const storagePath = boardPath(context.householdId);
  await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).remove([storagePath]);
  const upload = await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).upload(storagePath, JSON.stringify(board, null, 2), {
    cacheControl: "0",
    contentType: "application/json",
    upsert: true
  });
  if (upload.error) throw new Error("Falha ao salvar o Kanban.");
}

function normalizeBoard(value) {
  const cards = Array.isArray(value?.cards) ? value.cards : [];
  return {
    imports: typeof value?.imports === "object" && value.imports ? value.imports : {},
    cards: cards
      .map((card) => ({
        id: clean(card?.id || randomUUID()),
        title: clean(card?.title).slice(0, 160),
        group: clean(card?.group || "Geral").slice(0, 80) || "Geral",
        owner: OWNERS.has(card?.owner) ? card.owner : "Sem dono",
        priority: PRIORITIES.has(card?.priority) ? card.priority : "medium",
        dueDate: normalizeDate(card?.dueDate),
        dueTime: normalizeTime(card?.dueTime),
        reminder: REMINDERS.has(card?.reminder) ? card.reminder : "none",
        column: COLUMNS.has(card?.column) ? card.column : "todo",
        googleCalendar: normalizeGoogleCalendar(card?.googleCalendar),
        createdBy: clean(card?.createdBy || "Familia").slice(0, 80),
        createdAt: clean(card?.createdAt || new Date().toISOString())
      }))
      .filter((card) => card.title)
      .slice(0, 120)
  };
}

function normalizeGoogleCalendar(value) {
  if (!value || typeof value !== "object") return null;
  const eventId = clean(value.eventId);
  if (!eventId) return null;
  return {
    eventId,
    calendarId: clean(value.calendarId) || "primary",
    htmlLink: clean(value.htmlLink),
    syncedAt: clean(value.syncedAt),
    sourceHash: clean(value.sourceHash)
  };
}

function cardSyncHash(card) {
  return JSON.stringify([card.title, card.dueDate, normalizeTime(card.dueTime)]);
}

function normalizeDate(value) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizeTime(value) {
  const text = clean(value);
  return /^\d{2}:\d{2}$/.test(text) ? text : "";
}

function nextDate(value) {
  const [year, month, day] = normalizeDate(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function addMinutesToLocalDateTime(date, time, minutes) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hour, minute, 0, 0);
  start.setHours(hour, minute + minutes, 0, 0);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}T${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}:00`;
}

function boardPath(householdId) {
  return `${householdId}/${BOARD_FILE}`;
}

async function hasValidCsrf(request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ECONOMICS_CSRF_COOKIE)?.value || "";
  const headerToken = request.headers.get("x-economics-csrf") || "";
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function clean(value) {
  return String(value ?? "").trim();
}
