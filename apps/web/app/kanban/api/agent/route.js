import { randomUUID, timingSafeEqual } from "node:crypto";
import { ECONOMICS_HOUSEHOLD_SLUG, ECONOMICS_STORAGE_BUCKET, getEconomicsClient, writeEconomicsAudit } from "@/lib/economics-db";
import { getGoogleCalendarAccessToken, googleCalendarRequest } from "@/lib/kanban-google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOARD_FILE = "kanban/board.json";
const COLUMNS = new Set(["todo", "doing", "done"]);
const OWNERS = new Set(["Sem dono", "Vitor", "Nathalie", "Ambos"]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const REMINDERS = new Set(["none", "same_day", "one_day", "three_days", "one_week"]);
const ACTIONS = new Set(["summary", "list_cards", "create_card", "move_card", "update_card", "delete_card"]);
const GOOGLE_SYNC_EMAIL = "cvitorestevao@gmail.com";
const TIME_ZONE = "America/Sao_Paulo";

export async function POST(request) {
  const auth = validateAgentSecret(request);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);

  const body = await request.json().catch(() => ({}));
  const action = inferAction(body);
  if (!ACTIONS.has(action)) {
    return json({ ok: false, message: `Acao invalida. Use: ${Array.from(ACTIONS).join(", ")}.` }, 400);
  }

  const context = await getAgentContext();
  if (!context.ok) return json({ ok: false, message: context.message }, context.status);

  const board = await readBoard(context);

  if (action === "summary") {
    return json({ ok: true, action, summary: summarizeBoard(board), cards: priorityCards(board) });
  }

  if (action === "list_cards") {
    return json({ ok: true, action, cards: filterCards(board, body), summary: summarizeBoard(board) });
  }

  if (action === "create_card") {
    const title = clean(body.title).slice(0, 160);
    if (!title) return json({ ok: false, message: "Informe o titulo da tarefa." }, 400);

    const card = {
      id: randomUUID(),
      title,
      group: clean(body.group || "Geral").slice(0, 80) || "Geral",
      owner: normalizeOwner(body.owner),
      priority: normalizePriority(body.priority),
      dueDate: normalizeDate(body.dueDate || body.due_date || body.deadline),
      dueTime: normalizeTime(body.dueTime || body.due_time || body.time || ""),
      reminder: normalizeReminder(body.reminder),
      column: normalizeColumn(body.column || "todo"),
      googleCalendar: null,
      createdBy: "Agente Kanban",
      createdAt: new Date().toISOString()
    };
    const nextBoard = normalizeBoard({ ...board, cards: [card, ...board.cards] });
    await writeBoard(context, nextBoard, "kanban.agent.created", card.id);
    const synced = await autoSyncCard(context, nextBoard, card.id);
    return json({ ok: true, action, card: synced.card || card, calendar: synced.calendar, summary: summarizeBoard(synced.board || nextBoard) });
  }

  if (action === "move_card") {
    const match = findCard(board, body);
    if (!match.card) return json({ ok: false, message: match.message }, 404);

    const column = normalizeColumn(body.column || body.to || body.status);
    const movedCard = { ...match.card, column };
    const nextBoard = normalizeBoard({
      ...board,
      cards: moveCardToColumnTop(board.cards, movedCard)
    });
    await writeBoard(context, nextBoard, "kanban.agent.moved", match.card.id);
    const synced = await autoSyncCard(context, nextBoard, match.card.id);
    return json({ ok: true, action, card: synced.card || nextBoard.cards.find((card) => card.id === match.card.id), calendar: synced.calendar, summary: summarizeBoard(synced.board || nextBoard) });
  }

  if (action === "delete_card") {
    const match = findCard(board, body);
    if (!match.card) return json({ ok: false, message: match.message }, 404);

    const nextBoard = normalizeBoard({
      ...board,
      cards: board.cards.filter((card) => card.id !== match.card.id)
    });
    await writeBoard(context, nextBoard, "kanban.agent.deleted", match.card.id);
    return json({ ok: true, action, deleted: match.card, summary: summarizeBoard(nextBoard) });
  }

  const match = findCard(board, body);
  if (!match.card) return json({ ok: false, message: match.message }, 404);

  let editedCard = null;
  const mappedCards = board.cards.map((card) => {
      if (card.id !== match.card.id) return card;
      const titleFallback = body.current_title || body.currentTitle ? card.title : body.title;
      const nextTitle = clean(body.new_title || body.newTitle || titleFallback || card.title).slice(0, 160) || card.title;
      editedCard = {
        ...card,
        title: nextTitle,
        group: clean(body.group || card.group).slice(0, 80) || card.group,
        owner: body.owner ? normalizeOwner(body.owner) : card.owner,
        priority: body.priority ? normalizePriority(body.priority) : card.priority,
        dueDate: body.dueDate || body.due_date || body.deadline ? normalizeDate(body.dueDate || body.due_date || body.deadline) : card.dueDate,
        dueTime: body.dueTime || body.due_time || body.time ? normalizeTime(body.dueTime || body.due_time || body.time) : card.dueTime,
        reminder: body.reminder ? normalizeReminder(body.reminder) : card.reminder,
        column: body.column || body.status ? normalizeColumn(body.column || body.status) : card.column
      };
      return editedCard;
    });
  const nextBoard = normalizeBoard({
    ...board,
    cards: editedCard && editedCard.column !== match.card.column ? moveCardToColumnTop(board.cards, editedCard) : mappedCards
  });
  await writeBoard(context, nextBoard, "kanban.agent.updated", match.card.id);
  const synced = await autoSyncCard(context, nextBoard, match.card.id);
  return json({ ok: true, action, card: synced.card || nextBoard.cards.find((card) => card.id === match.card.id), calendar: synced.calendar, summary: summarizeBoard(synced.board || nextBoard) });
}

export async function GET(request) {
  const auth = validateAgentSecret(request);
  if (!auth.ok) return json({ ok: false, message: auth.message }, auth.status);

  return json({
    ok: true,
    endpoint: "/kanban/api/agent",
    actions: Array.from(ACTIONS),
    columns: Array.from(COLUMNS),
    owners: Array.from(OWNERS)
  });
}

async function getAgentContext() {
  const supabase = getEconomicsClient();
  if (!supabase) return { ok: false, status: 503, message: "Supabase nao configurado no servidor." };

  const householdSlug = clean(process.env.KANBAN_AGENT_HOUSEHOLD_SLUG || ECONOMICS_HOUSEHOLD_SLUG);
  const { data, error } = await supabase.from("economics_households").select("id, name, slug").eq("slug", householdSlug).maybeSingle();
  if (error) return { ok: false, status: 500, message: "Falha ao localizar household do Kanban." };
  if (!data?.id) return { ok: false, status: 404, message: "Household do Kanban nao encontrado." };

  return { ok: true, supabase, householdId: data.id, household: data, member: { email: clean(process.env.KANBAN_AGENT_GOOGLE_EMAIL) || GOOGLE_SYNC_EMAIL } };
}

async function readBoard(context) {
  const { data, error } = await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).download(boardPath(context.householdId));
  if (error || !data) return { imports: {}, cards: [] };

  const text = await data.text().catch(() => "");
  return normalizeBoard(parseJson(text));
}

async function writeBoard(context, board, eventType, entityId) {
  const storagePath = boardPath(context.householdId);
  await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).remove([storagePath]);

  const upload = await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).upload(storagePath, JSON.stringify(board, null, 2), {
    cacheControl: "0",
    contentType: "application/json",
    upsert: true
  });
  if (upload.error) throw new Error("Falha ao salvar o Kanban.");

  await writeEconomicsAudit(context.supabase, {
    householdId: context.householdId,
    actorEmail: "elevenlabs-kanban-agent",
    eventType,
    entityType: "kanban_card",
    entityId,
    metadata: { cards: board.cards.length }
  });
}

async function autoSyncCard(context, board, cardId) {
  const card = board.cards.find((item) => item.id === cardId);
  if (!card?.dueDate || !needsGoogleSync(card)) return { board, card, calendar: { synced: false, reason: "no_due_date_or_clean" } };

  try {
    const token = await getGoogleCalendarAccessToken(context);
    if (!token.ok) return { board, card, calendar: { synced: false, reason: token.message || "not_connected" } };

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
      response = existing?.id
        ? await googleCalendarRequest(token.accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing.id)}`, { method: "PATCH", body: eventBody })
        : await googleCalendarRequest(token.accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: eventBody });
    }

    if (!response.ok) return { board, card, calendar: { synced: false, reason: response.message || "google_error" } };

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

    await writeBoard(context, syncedBoard, "kanban.agent.calendar_synced", card.id);
    return {
      board: syncedBoard,
      card: syncedBoard.cards.find((item) => item.id === card.id),
      calendar: { synced: true, calendarId, eventId: event.id, htmlLink: event.htmlLink || "" }
    };
  } catch (error) {
    return { board, card, calendar: { synced: false, reason: error.message || "sync_failed" } };
  }
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
      "Tarefa do Kanban da familia.",
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
    return {
      ...base,
      start: { dateTime: start, timeZone: TIME_ZONE },
      end: { dateTime: addMinutesToLocalDateTime(card.dueDate, dueTime, 45), timeZone: TIME_ZONE }
    };
  }

  return {
    ...base,
    start: { date: card.dueDate },
    end: { date: nextDate(card.dueDate) }
  };
}

function needsGoogleSync(card) {
  return Boolean(card.dueDate && (!card.googleCalendar?.eventId || card.googleCalendar?.sourceHash !== cardSyncHash(card)));
}

function cardSyncHash(card) {
  return JSON.stringify([card.title, card.dueDate, normalizeTime(card.dueTime)]);
}

function moveCardToColumnTop(cards, movedCard) {
  const remaining = cards.filter((card) => card.id !== movedCard.id);
  const next = [];
  let inserted = false;

  for (const card of remaining) {
    if (!inserted && card.column === movedCard.column) {
      next.push(movedCard);
      inserted = true;
    }
    next.push(card);
  }

  if (!inserted) next.unshift(movedCard);
  return next;
}

function filterCards(board, body) {
  const query = normalizeText(body.query || body.search || "");
  const column = clean(body.column || body.status || "");
  const owner = clean(body.owner || "");
  const priority = clean(body.priority || "");
  const group = normalizeText(body.group || "");
  const limit = clampNumber(body.limit, 1, 40, 20);

  return board.cards
    .filter((card) => (!column || card.column === normalizeColumn(column)))
    .filter((card) => (!owner || card.owner === normalizeOwner(owner)))
    .filter((card) => (!priority || card.priority === normalizePriority(priority)))
    .filter((card) => (!group || normalizeText(card.group).includes(group)))
    .filter((card) => (!query || normalizeText(`${card.title} ${card.group} ${card.owner} ${card.priority} ${card.column}`).includes(query)))
    .slice(0, limit);
}

function inferAction(body) {
  const explicit = clean(body.action || body.operation);
  if (explicit) return explicit;
  if (body.current_title || body.currentTitle || body.new_title || body.newTitle) return "update_card";
  if (body.title || body.cardTitle) return "create_card";
  if (body.query || body.search || body.owner || body.column || body.status || body.group) return "list_cards";
  return "summary";
}

function findCard(board, body) {
  const cardId = clean(body.cardId || body.id || "");
  if (cardId) {
    const card = board.cards.find((item) => item.id === cardId);
    return card ? { card } : { card: null, message: "Tarefa nao encontrada pelo id informado." };
  }

  const title = normalizeText(body.current_title || body.currentTitle || body.cardTitle || body.query || body.title || "");
  if (!title) return { card: null, message: "Informe cardId ou title para localizar a tarefa." };

  const exact = board.cards.find((card) => normalizeText(card.title) === title);
  if (exact) return { card: exact };

  const matches = board.cards.filter((card) => normalizeText(card.title).includes(title));
  if (matches.length === 1) return { card: matches[0] };
  if (matches.length > 1) return { card: null, message: `Encontrei ${matches.length} tarefas parecidas. Peca o id antes de alterar.` };
  return { card: null, message: "Tarefa nao encontrada pelo titulo informado." };
}

function summarizeBoard(board) {
  const counts = { todo: 0, doing: 0, done: 0 };
  for (const card of board.cards) counts[card.column] += 1;
  const deadlineCounts = summarizeDeadlines(board.cards);
  return {
    total: board.cards.length,
    columns: counts,
    deadlines: deadlineCounts,
    priorities: Array.from(PRIORITIES).map((priority) => ({
      priority,
      total: board.cards.filter((card) => card.priority === priority).length
    })),
    owners: Array.from(OWNERS).map((owner) => ({
      owner,
      total: board.cards.filter((card) => card.owner === owner).length
    }))
  };
}

function summarizeDeadlines(cards) {
  const today = localDateStart(new Date());
  const soonLimit = addDays(today, 7);
  const counts = { overdue: 0, today: 0, next7Days: 0 };

  for (const card of cards) {
    if (card.column === "done" || !card.dueDate) continue;
    const due = parseLocalDate(card.dueDate);
    if (!due) continue;
    if (due < today) counts.overdue += 1;
    else if (sameDay(due, today)) counts.today += 1;
    else if (due <= soonLimit) counts.next7Days += 1;
  }

  return counts;
}

function priorityCards(board) {
  return board.cards.filter((card) => card.column !== "done").slice(0, 12);
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
        owner: normalizeCardOwner(card),
        priority: normalizePriority(card?.priority),
        dueDate: normalizeDate(card?.dueDate),
        dueTime: normalizeTime(card?.dueTime),
        reminder: normalizeReminder(card?.reminder),
        column: normalizeColumn(card?.column),
        googleCalendar: normalizeGoogleCalendar(card?.googleCalendar),
        createdBy: clean(card?.createdBy || "Familia").slice(0, 80),
        createdAt: clean(card?.createdAt || new Date().toISOString())
      }))
      .filter((card) => card.title)
      .slice(0, 120)
  };
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

function parseLocalDate(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function normalizeReminder(value) {
  const reminder = clean(value).toLowerCase();
  if (reminder === "no dia" || reminder === "same day" || reminder === "same_day") return "same_day";
  if (reminder === "1 dia antes" || reminder === "um dia antes" || reminder === "one_day") return "one_day";
  if (reminder === "3 dias antes" || reminder === "tres dias antes" || reminder === "três dias antes" || reminder === "three_days") return "three_days";
  if (reminder === "1 semana antes" || reminder === "uma semana antes" || reminder === "one_week") return "one_week";
  return REMINDERS.has(reminder) ? reminder : "none";
}

function normalizePriority(value) {
  const priority = clean(value).toLowerCase();
  if (priority === "baixa" || priority === "baixo" || priority === "low") return "low";
  if (priority === "media" || priority === "média" || priority === "medio" || priority === "médio" || priority === "medium") return "medium";
  if (priority === "alta" || priority === "alto" || priority === "high") return "high";
  if (priority === "urgente" || priority === "urgent" || priority === "critica" || priority === "crítica") return "urgent";
  return PRIORITIES.has(priority) ? priority : "medium";
}

function normalizeColumn(value) {
  const column = clean(value).toLowerCase();
  if (column === "fazendo" || column === "andamento" || column === "em andamento") return "doing";
  if (column === "feito" || column === "concluido" || column === "concluida" || column === "done") return "done";
  return COLUMNS.has(column) ? column : "todo";
}

function normalizeOwner(value) {
  const owner = clean(value);
  const normalized = normalizeText(owner);
  if (normalized.includes("vitor")) return "Vitor";
  if (normalized.includes("nathalie") || normalized.includes("natalie")) return "Nathalie";
  if (normalized.includes("ambos") || normalized.includes("todos") || normalized.includes("casal")) return "Ambos";
  if (normalized.includes("sem dono") || normalized.includes("sem responsavel") || normalized.includes("sem responsável")) return "Sem dono";
  return OWNERS.has(owner) ? owner : "Sem dono";
}

function normalizeCardOwner(card) {
  if (card?.owner === "Ambos" && card?.createdBy === "Google Sheets") return "Sem dono";
  return normalizeOwner(card?.owner);
}

function validateAgentSecret(request) {
  const expected = clean(process.env.ELEVENLABS_KANBAN_WEBHOOK_SECRET || process.env.KANBAN_AGENT_WEBHOOK_SECRET);
  if (!expected) return { ok: false, status: 503, message: "Segredo do agente Kanban nao configurado." };

  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  const provided = clean(bearer || request.headers.get("x-kanban-agent-secret"));
  if (!provided || !constantTimeEqual(provided, expected)) return { ok: false, status: 401, message: "Acesso negado." };
  return { ok: true };
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function boardPath(householdId) {
  return `${householdId}/${BOARD_FILE}`;
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function normalizeText(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function clean(value) {
  return String(value ?? "").trim();
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
