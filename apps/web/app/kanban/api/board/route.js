import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { ECONOMICS_STORAGE_BUCKET, writeEconomicsAudit } from "@/lib/economics-db";
import { ECONOMICS_CSRF_COOKIE } from "@/lib/economics-session";
import { economicsJson, requireEconomicsContext } from "@/app/economics/api/_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOARD_FILE = "kanban/board.json";
const COLUMNS = new Set(["todo", "doing", "done"]);
const OWNERS = new Set(["Sem dono", "Vitor", "Nathalie", "Ambos"]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const REMINDERS = new Set(["none", "same_day", "one_day", "three_days", "one_week"]);
const SHEET_IMPORT_KEY = "home_tasks_google_sheet_2026_07_12";
const TRAVEL_GROUP_MIGRATION_KEY = "travel_group_2026_08_01";
const TRAVEL_GROUP = "Viagem";
const OLD_SEED_IDS = new Set(["seed-prioridades", "seed-pendencias", "seed-economics"]);
const SHEET_CARDS = [
  { id: "sheet-01-papel-de-parede", title: "Papel de parede", group: "🖥️ Escritório" },
  { id: "sheet-02-montar-bureau-da-luiza", title: "Montar bureau da Luiza", group: "🖥️ Escritório" },
  { id: "sheet-03-trocar-comoda-da-luiza", title: "Trocar cômoda da Luiza", group: "🖥️ Escritório" },
  { id: "sheet-04-vender-sofa-cama", title: "Vender sofá cama", group: "🖥️ Escritório" },
  { id: "sheet-05-vender-mesa", title: "Vender mesa", group: "🖥️ Escritório" },
  { id: "sheet-06-fechar-nichos-escritorio", title: "Fechar nichos escritório", group: "🖥️ Escritório" },
  { id: "sheet-07-cortina", title: "Cortina", group: "🖥️ Escritório" },
  { id: "sheet-08-comprar-bicama", title: "Comprar bicama", group: "🌸 Quarto Luiza" },
  { id: "sheet-09-remontar-mover-comoda", title: "Remontar / Mover cômoda", group: "🌸 Quarto Luiza" },
  { id: "sheet-10-comprar-luzes-da-cabeceira", title: "Comprar luzes da cabeceira", group: "🌸 Quarto Luiza" },
  { id: "sheet-11-avaliar-cor-da-cama", title: "Avaliar cor da cama", group: "🌸 Quarto Luiza" },
  { id: "sheet-12-pendurar-cama-luiza", title: "Pendurar cama Luiza", group: "🌸 Quarto Luiza" },
  { id: "sheet-13-instalar-tv", title: "Instalar TV", group: "🌸 Quarto Luiza" },
  { id: "sheet-14-eliminar-da-gaveta-armario", title: "Eliminar da gaveta armário", group: "🌸 Quarto Luiza" },
  { id: "sheet-15-consertar-gaveta", title: "Consertar gaveta", group: "🌸 Quarto Luiza" },
  { id: "sheet-16-mudar-fotos-e-retratos", title: "Mudar fotos e retratos", group: "🌸 Quarto Luiza" },
  { id: "sheet-17-armario-de-ferramentas", title: "Armário de ferramentas", group: "🌸 Quarto Luiza" },
  { id: "sheet-18-cortina-quarto-luiza", title: "Cortina quarto Luiza", group: "🌸 Quarto Luiza" },
  { id: "sheet-19-hall-pintar", title: "Hall: Pintar", group: "🚪 Hall" },
  { id: "sheet-20-colar-perfil-de-led-do-hall", title: "Colar perfil de LED do hall", group: "🚪 Hall" },
  { id: "sheet-21-lavabo-armario", title: "Lavabo: Armário", group: "🚿 Lavabo" },
  { id: "sheet-22-banco-da-liz", title: "Banco da Liz", group: "🚿 Lavabo" },
  { id: "sheet-23-trocar-foto-para-retratos", title: "Trocar foto para retratos", group: "🛋️ Sala" },
  { id: "sheet-24-arrumar-soundbar", title: "Arrumar soundbar", group: "🛋️ Sala" },
  { id: "sheet-25-decoracao-prateleira-da-alexa", title: "Decoração prateleira da Alexa", group: "🛋️ Sala" },
  { id: "sheet-26-comprar-suporte-da-luminaria-da-mesa-de-jantar", title: "Comprar suporte da luminária da mesa de jantar", group: "🛋️ Sala" },
  { id: "sheet-27-agendar-lavagem-sofa-e-poltrona", title: "Agendar lavagem sofá e poltrona", group: "🛋️ Sala" },
  { id: "sheet-28-colocar-tapete-do-lounge", title: "Colocar tapete do lounge", group: "🛋️ Sala" },
  { id: "sheet-29-consertar-elevador-de-maos", title: "Consertar elevador de mãos", group: "🛋️ Sala" },
  { id: "sheet-30-ajustar-rodape-com-marcos", title: "Ajustar rodapé com Marcos", group: "🛋️ Sala" },
  { id: "sheet-31-comprar-vaso-de-planta-no-lounge", title: "Comprar vaso de planta no lounge", group: "🛋️ Sala" },
  { id: "sheet-32-comprar-quadro-loissonie", title: "Comprar quadro Loissonié", group: "🛋️ Sala" },
  { id: "sheet-33-decoracao-dos-nichos-do-roupeiro", title: "Decoração dos nichos do roupeiro", group: "🛋️ Sala" },
  { id: "sheet-34-puxador-cristaleira-consertar", title: "Puxador cristaleira — consertar", group: "🛋️ Sala" },
  { id: "sheet-35-instalar-pedra-e-espelho-na-cristaleira", title: "Instalar pedra e espelho na cristaleira", group: "🛋️ Sala" },
  { id: "sheet-36-arrumar-led-da-sala", title: "Arrumar LED da sala", group: "🛋️ Sala" },
  { id: "sheet-37-instalar-pratos-decorativos", title: "Instalar pratos decorativos", group: "🛋️ Sala" }
].map((card) => ({
  ...card,
  owner: "Sem dono",
  priority: "medium",
  dueDate: "",
  reminder: "none",
  column: "todo",
  createdBy: "Google Sheets",
  createdAt: "2026-07-12T00:00:00.000Z"
}));

export async function GET() {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: "Sessao Kanban ausente ou expirada." }, context.status);

  const board = await readBoard(context);
  return economicsJson({ ok: true, board });
}

export async function POST(request) {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: "Sessao Kanban ausente ou expirada." }, context.status);
  if (!(await hasValidCsrf(request))) return economicsJson({ ok: false, message: "Sessao expirada. Entre novamente no Kanban." }, 403);

  const body = await request.json().catch(() => ({}));
  const board = normalizeBoard(body?.board);
  const saved = await persistBoard(context, board);
  if (!saved) return economicsJson({ ok: false, message: "Falha ao salvar o Kanban." }, 500);

  await writeEconomicsAudit(context.supabase, {
    householdId: context.householdId,
    actorEmail: context.member.email,
    eventType: "kanban.saved",
    entityType: "kanban_board",
    entityId: "board",
    metadata: {
      cards: board.cards.length
    }
  });

  return economicsJson({ ok: true, board });
}

async function readBoard(context) {
  const { data, error } = await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).download(boardPath(context.householdId));
  if (error || !data) return seedBoard();

  const text = await data.text().catch(() => "");
  const parsed = parseJson(text);
  const board = normalizeBoard(parsed);
  const migratedBoard = migrateBoard(board);

  if (JSON.stringify(board) !== JSON.stringify(migratedBoard)) {
    await persistBoard(context, migratedBoard);
  }

  return migratedBoard;
}

async function persistBoard(context, board) {
  const storagePath = boardPath(context.householdId);
  await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).remove([storagePath]);

  const upload = await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).upload(storagePath, JSON.stringify(board, null, 2), {
    cacheControl: "0",
    contentType: "application/json",
    upsert: true
  });

  return !upload.error;
}

function normalizeBoard(value) {
  const cards = Array.isArray(value?.cards) ? value.cards : [];
  return {
    imports: typeof value?.imports === "object" && value.imports ? value.imports : {},
    cards: cards
      .map((card) => ({
        id: String(card?.id || randomUUID()),
        title: String(card?.title || "").trim().slice(0, 160),
        group: String(card?.group || "Geral").trim().slice(0, 80),
        owner: normalizeOwner(card),
        priority: PRIORITIES.has(card?.priority) ? card.priority : "medium",
        dueDate: normalizeDate(card?.dueDate),
        dueTime: normalizeTime(card?.dueTime),
        reminder: REMINDERS.has(card?.reminder) ? card.reminder : "none",
        column: COLUMNS.has(card?.column) ? card.column : "todo",
        googleCalendar: normalizeGoogleCalendar(card?.googleCalendar),
        createdBy: String(card?.createdBy || "Familia").slice(0, 80),
        createdAt: String(card?.createdAt || new Date().toISOString())
      }))
      .filter((card) => card.title)
      .slice(0, 120)
  };
}

function normalizeOwner(card) {
  if (OWNERS.has(card?.owner)) {
    if (card.owner === "Ambos" && card.createdBy === "Google Sheets") return "Sem dono";
    return card.owner;
  }
  return "Sem dono";
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : "";
}

function normalizeGoogleCalendar(value) {
  if (!value || typeof value !== "object") return null;
  const eventId = String(value.eventId || "").trim();
  if (!eventId) return null;
  return {
    eventId,
    calendarId: String(value.calendarId || "primary").trim() || "primary",
    htmlLink: String(value.htmlLink || "").trim(),
    syncedAt: String(value.syncedAt || "").trim(),
    sourceHash: String(value.sourceHash || "").trim()
  };
}

function migrateBoard(board) {
  let migratedBoard = board;

  if (!migratedBoard.imports?.[SHEET_IMPORT_KEY]) {
    const existingIds = new Set(migratedBoard.cards.map((card) => card.id));
    const importedCards = SHEET_CARDS.filter((card) => !existingIds.has(card.id));
    const currentCards = migratedBoard.cards.filter((card) => !OLD_SEED_IDS.has(card.id));

    migratedBoard = normalizeBoard({
      ...migratedBoard,
      imports: {
        ...migratedBoard.imports,
        [SHEET_IMPORT_KEY]: true
      },
      cards: [...currentCards, ...importedCards]
    });
  }

  if (migratedBoard.imports?.[TRAVEL_GROUP_MIGRATION_KEY]) return migratedBoard;

  return normalizeBoard({
    ...migratedBoard,
    imports: {
      ...migratedBoard.imports,
      [TRAVEL_GROUP_MIGRATION_KEY]: true
    },
    cards: migratedBoard.cards.map((card) => (
      isTravelCard(card) ? { ...card, group: TRAVEL_GROUP } : card
    ))
  });
}

function isTravelCard(card) {
  const text = `${card?.title || ""} ${card?.group || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /\b(viagem|orlando|disney|universal|epic universe|magic kingdom|hollywood studios|animal kingdom|epcot|sea world|seaworld|florida|miami|mco|gru|voo|passagem|embarque|aeroporto|hotel|hospedagem|check-?in|check-?out|voucher|ingresso|parque|passaporte|visto|seguro viagem|mala|bagagem|aluguel de carro|carro alugado|hertz|dolar|cambio|arc)\b/.test(text);
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function seedBoard() {
  return {
    imports: {
      [SHEET_IMPORT_KEY]: true
    },
    cards: SHEET_CARDS
  };
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
