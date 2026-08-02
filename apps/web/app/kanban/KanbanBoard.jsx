"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarPlus, Check, GripVertical, Pencil, Plane, Plus, RefreshCw, SlidersHorizontal, Trash2, X } from "lucide-react";

const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" }
];

const OWNERS = ["Sem dono", "Vitor", "Nathalie", "Ambos"];
const OWNER_TAGS = {
  "Sem dono": "Sem dono",
  Vitor: "VE",
  Nathalie: "NB",
  Ambos: "Ambos"
};
const OWNER_CLASSES = {
  "Sem dono": "sem-dono",
  Vitor: "ve",
  Nathalie: "nb",
  Ambos: "ambos"
};
const PRIORITIES = [
  { id: "low", label: "Baixa" },
  { id: "medium", label: "Média" },
  { id: "high", label: "Alta" },
  { id: "urgent", label: "Urgente" }
];
const BASE_GROUPS = ["Geral", "Escritório", "Quarto Luiza", "Hall", "Lavabo", "Sala"];
const TRAVEL_GROUP = "Viagem";
const ALL_FILTER = "all";
const EMPTY_FILTERS = {
  owner: ALL_FILTER,
  group: ALL_FILTER,
  priority: ALL_FILTER,
  due: ALL_FILTER
};
const DUE_FILTERS = [
  { id: ALL_FILTER, label: "Todos os prazos" },
  { id: "overdue", label: "Atrasados" },
  { id: "today", label: "Hoje" },
  { id: "next7", label: "Próximos 7 dias" }
];

const EMPTY_FORM = {
  title: "",
  group: "Geral",
  owner: "Sem dono",
  priority: "medium",
  column: "todo",
  dueDate: "",
  dueTime: "",
  reminder: "none"
};

const AGENT_SYNC_INTERVAL_MS = 4000;
const REMINDERS = [
  { id: "none", label: "Sem lembrete" },
  { id: "same_day", label: "No dia" },
  { id: "one_day", label: "1 dia antes" },
  { id: "three_days", label: "3 dias antes" },
  { id: "one_week", label: "1 semana antes" }
];

export default function KanbanBoard({ csrfToken, calendarNotice, kanbanAgentId, user }) {
  const [board, setBoard] = useState({ imports: {}, cards: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [editingForm, setEditingForm] = useState(EMPTY_FORM);
  const [calendar, setCalendar] = useState({ connected: false, configured: true, calendars: [], selectedCalendarIds: [], syncCalendarId: "primary", events: [] });
  const [calendarStatus, setCalendarStatus] = useState({ type: "idle", text: "" });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [syncingCardId, setSyncingCardId] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const [notice, setNotice] = useState(null);
  const [status, setStatus] = useState({ type: "idle", text: "" });
  const boardRef = useRef(board);
  const calendarRef = useRef(calendar);
  const dragOverRef = useRef(null);
  const dragSessionRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const statusRef = useRef(status);
  const autoSyncingRef = useRef(new Set());
  const initialCalendarSyncRef = useRef(false);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    calendarRef.current = calendar;
  }, [calendar]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
  }, []);

  useEffect(() => {
    const message = calendarNoticeMessage(calendarNotice);
    if (!message) return;

    setCalendarStatus({ type: message.type, text: message.text });
    showNotice(message.toast || message.text, message.type);

    const url = new URL(window.location.href);
    url.searchParams.delete("calendar");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [calendarNotice]);

  useEffect(() => {
    if (!kanbanAgentId || customElements.get("elevenlabs-convai")) return;
    const existing = document.querySelector("script[data-elevenlabs-convai]");
    if (existing) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    script.type = "text/javascript";
    script.dataset.elevenlabsConvai = "true";
    document.body.appendChild(script);
  }, [kanbanAgentId]);

  useEffect(() => {
    let active = true;

    async function loadBoard() {
      setStatus({ type: "loading", text: "Carregando quadro..." });
      const payload = await fetchBoard();
      if (!active) return;

      if (payload.ok) {
        const nextBoard = normalizeBoard(payload.board);
        boardRef.current = nextBoard;
        setBoard(nextBoard);
        setStatus({ type: "idle", text: "" });
        maybeRunInitialCalendarSync(nextBoard, calendarRef.current);
      } else {
        setStatus({ type: "error", text: payload.message || "Não consegui carregar o Kanban." });
      }
    }

    loadBoard();
    loadCalendar();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function syncBoard() {
      if (editingId || draggingId || statusRef.current.type === "saving") return;

      const payload = await fetchBoard();
      if (!active || !payload.ok) return;

      const nextBoard = normalizeBoard(payload.board);
      const currentBoard = boardRef.current;
      const currentIds = new Set(currentBoard.cards.map((card) => card.id));
      const addedCards = nextBoard.cards.filter((card) => !currentIds.has(card.id));
      const changed = boardSignature(currentBoard) !== boardSignature(nextBoard);

      if (!changed) return;

      boardRef.current = nextBoard;
      setBoard(nextBoard);
      if (addedCards.length === 1) {
        showNotice(`Card adicionado: ${addedCards[0].title}`);
      } else if (addedCards.length > 1) {
        showNotice(`${addedCards.length} cards adicionados pelo agente.`);
      } else {
        showNotice("Kanban atualizado pelo agente.");
      }
    }

    const interval = window.setInterval(syncBoard, AGENT_SYNC_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [draggingId, editingId]);

  async function loadCalendar() {
    const payload = await fetchCalendar();
    if (!payload.ok) {
      setCalendarStatus({ type: "error", text: payload.message || "Nao consegui carregar agenda." });
      return;
    }
    const nextCalendar = {
      connected: Boolean(payload.connected),
      configured: payload.configured !== false,
      needsReconnect: Boolean(payload.needsReconnect),
      calendars: payload.calendars || [],
      selectedCalendarIds: payload.selectedCalendarIds || [],
      selectionMode: payload.selectionMode || "",
      syncCalendarId: payload.syncCalendarId || "primary",
      events: payload.events || []
    };
    calendarRef.current = nextCalendar;
    setCalendar(nextCalendar);
    setCalendarStatus({ type: payload.needsReconnect ? "error" : "idle", text: payload.message || "" });
    maybeRunInitialCalendarSync(boardRef.current, nextCalendar);
  }

  const groupOptions = useMemo(() => {
    return uniqueGroupOptions([
      ...BASE_GROUPS,
      TRAVEL_GROUP,
      ...board.cards.map((card) => card.group || "Geral"),
      form.group,
      editingForm.group
    ]);
  }, [board.cards, editingForm.group, form.group]);

  const groupFilterOptions = useMemo(() => (
    groupOptions.map((group) => ({
      key: groupKey(group),
      label: group
    }))
  ), [groupOptions]);

  const baseFilteredCards = useMemo(() => (
    board.cards.filter((card) => matchesBaseFilters(card, filters))
  ), [board.cards, filters]);

  const filteredCards = useMemo(() => (
    baseFilteredCards.filter((card) => matchesDueFilter(card, filters.due))
  ), [baseFilteredCards, filters.due]);

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(COLUMNS.map((column) => [column.id, []]));
    for (const card of filteredCards) {
      groups[card.column]?.push(card);
    }
    return groups;
  }, [filteredCards]);

  const activeFilterCount = useMemo(() => (
    Object.values(filters).filter((value) => value !== ALL_FILTER).length
  ), [filters]);

  const travelCardCount = useMemo(() => (
    board.cards.filter((card) => groupKey(card.group) === groupKey(TRAVEL_GROUP)).length
  ), [board.cards]);

  const ownerTotals = useMemo(() => (
    OWNERS.map((owner) => ({
      owner,
      tag: OWNER_TAGS[owner],
      className: OWNER_CLASSES[owner],
      total: board.cards.filter((card) => card.owner === owner).length
    }))
  ), [board.cards]);

  const deadlineSummary = useMemo(() => {
    const openCards = baseFilteredCards.filter((card) => card.column !== "done" && card.dueDate);
    const today = localDateStart(new Date());
    const soonLimit = addDays(today, 7);
    const overdue = [];
    const todayCards = [];
    const soon = [];

    for (const card of openCards) {
      const due = parseLocalDate(card.dueDate);
      if (!due) continue;
      if (due < today) overdue.push(card);
      else if (sameDay(due, today)) todayCards.push(card);
      else if (due <= soonLimit) soon.push(card);
    }

    return { overdue, today: todayCards, soon };
  }, [baseFilteredCards]);

  async function persist(nextBoard) {
    const normalized = normalizeBoard(nextBoard);
    setBoard(normalized);
    setStatus({ type: "saving", text: "Salvando..." });

    const response = await fetch("/kanban/api/board", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-economics-csrf": csrfToken
      },
      body: JSON.stringify({ board: normalized })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.ok) {
      setStatus({ type: "error", text: payload.message || "Não consegui salvar." });
      return;
    }

    const savedBoard = normalizeBoard(payload.board || normalized);
    boardRef.current = savedBoard;
    setBoard(savedBoard);
    setStatus({ type: "success", text: "Salvo." });
    window.setTimeout(() => setStatus({ type: "idle", text: "" }), 1400);
  }

  function showNotice(text, type = "success") {
    setNotice({ text, type });
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3600);
  }

  function addCard(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    setForm(EMPTY_FORM);
    persist({
      ...board,
      cards: [
        {
          id: crypto.randomUUID(),
          title,
          group: form.group,
          owner: form.owner,
          priority: form.priority,
          dueDate: form.dueDate,
          dueTime: form.dueTime,
          reminder: form.reminder,
          column: "todo",
          createdBy: user?.name || "Família",
          createdAt: new Date().toISOString()
        },
        ...board.cards
      ]
    });
  }

  function moveCard(cardId, column, position = null) {
    const currentBoard = boardRef.current;
    const currentCard = currentBoard.cards.find((card) => card.id === cardId);
    if (!currentCard) return;

    const movedCard = { ...currentCard, column };
    const remaining = currentBoard.cards.filter((card) => card.id !== cardId);
    const cardsByColumn = Object.fromEntries(COLUMNS.map((item) => [item.id, []]));
    for (const card of remaining) cardsByColumn[card.column]?.push(card);

    const targetCards = cardsByColumn[column] || [];
    const sourceCards = currentBoard.cards.filter((card) => card.column === currentCard.column);
    const sourceIndex = sourceCards.findIndex((card) => card.id === cardId);
    const isCrossColumn = currentCard.column !== column;
    const adjustedPosition = !isCrossColumn && sourceIndex >= 0 && sourceIndex < position ? position - 1 : position;
    const nextIndex = isCrossColumn ? 0 : (Number.isInteger(adjustedPosition) ? Math.max(0, Math.min(adjustedPosition, targetCards.length)) : 0);
    targetCards.splice(nextIndex, 0, movedCard);

    const cards = COLUMNS.flatMap((item) => cardsByColumn[item.id]);
    persist({ ...currentBoard, cards });
  }

  function deleteCard(cardId) {
    persist({
      ...board,
      cards: board.cards.filter((card) => card.id !== cardId)
    });
  }

  function startEditing(card) {
    setEditingId(card.id);
    setEditingForm({ title: card.title, group: canonicalGroupLabel(card.group, groupOptions), owner: card.owner, priority: card.priority, column: card.column, dueDate: card.dueDate || "", dueTime: card.dueTime || "", reminder: card.reminder || "none" });
  }

  function cancelEditing() {
    setEditingId("");
    setEditingForm(EMPTY_FORM);
  }

  function saveEditing(cardId) {
    const title = editingForm.title.trim();
    if (!title) return;

    const currentCard = board.cards.find((card) => card.id === cardId);
    const editedCard = currentCard
      ? { ...currentCard, title, group: editingForm.group, owner: editingForm.owner, priority: editingForm.priority, column: editingForm.column, dueDate: editingForm.dueDate, dueTime: editingForm.dueTime, reminder: editingForm.reminder }
      : null;
    if (!editedCard) return;

    persist({
      ...board,
      cards: editedCard.column !== currentCard.column
        ? moveCardToColumnTop(board.cards, editedCard)
        : board.cards.map((card) => (card.id === cardId ? editedCard : card))
    });
    cancelEditing();
  }

  async function selectCalendar(calendarId) {
    const current = new Set(calendar.selectedCalendarIds);
    if (current.has(calendarId)) current.delete(calendarId);
    else current.add(calendarId);
    const selectedCalendarIds = Array.from(current);
    if (!selectedCalendarIds.length) selectedCalendarIds.push(calendarId);

    setCalendar((value) => ({ ...value, selectedCalendarIds }));
    const response = await fetch("/kanban/api/calendar", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-economics-csrf": csrfToken
      },
      body: JSON.stringify({
        action: "select_calendars",
        selectedCalendarIds,
        syncCalendarId: selectedCalendarIds.includes(calendar.syncCalendarId) ? calendar.syncCalendarId : selectedCalendarIds[0]
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      setCalendarStatus({ type: "error", text: payload.message || "Nao consegui salvar calendarios." });
      return;
    }
    await loadCalendar();
  }

  async function syncCardToGoogle(cardId, options = {}) {
    const automatic = Boolean(options.automatic);
    if (!calendarRef.current.connected || calendarRef.current.needsReconnect) return false;

    setSyncingCardId(cardId);
    setCalendarStatus({ type: "loading", text: automatic ? "Atualizando Google automaticamente..." : "Sincronizando Google..." });

    const response = await fetch("/kanban/api/calendar", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-economics-csrf": csrfToken
      },
      body: JSON.stringify({ action: "sync_card", cardId })
    });
    const payload = await response.json().catch(() => ({}));
    setSyncingCardId("");

    if (!response.ok || !payload.ok) {
      if (automatic && response.status === 404) {
        setCalendarStatus({ type: "idle", text: "" });
        return false;
      }
      setCalendarStatus(automatic ? { type: "idle", text: "" } : { type: "error", text: payload.message || "Nao consegui sincronizar." });
      if (!automatic) showNotice(payload.message || "Nao consegui sincronizar com Google.", "error");
      return false;
    }

    if (payload.card) {
      setBoard((current) => {
        const nextBoard = normalizeBoard({
          ...current,
          cards: current.cards.map((card) => (card.id === payload.card.id ? payload.card : card))
        });
        boardRef.current = nextBoard;
        return nextBoard;
      });
    }
    if (!automatic) showNotice("Card sincronizado com Google Calendar.");
    if (!automatic) await loadCalendar();
    else setCalendarStatus({ type: "idle", text: "" });
    return true;
  }

  function maybeRunInitialCalendarSync(sourceBoard = boardRef.current, sourceCalendar = calendarRef.current) {
    if (initialCalendarSyncRef.current) return;
    if (!sourceCalendar.connected || sourceCalendar.needsReconnect) return;
    if (!Array.isArray(sourceBoard.cards) || !sourceBoard.cards.length) return;
    initialCalendarSyncRef.current = true;
    autoSyncDueCards(sourceBoard);
  }

  async function autoSyncDueCards(sourceBoard) {
    const currentCalendar = calendarRef.current;
    if (!currentCalendar.connected || currentCalendar.needsReconnect) return;

    const dirtyCards = (sourceBoard.cards || []).filter((card) => card.dueDate && needsGoogleSync(card));
    for (const card of dirtyCards.slice(0, 6)) {
      if (autoSyncingRef.current.has(card.id)) continue;
      autoSyncingRef.current.add(card.id);
      try {
        await syncCardToGoogle(card.id, { automatic: true });
      } finally {
        autoSyncingRef.current.delete(card.id);
      }
    }
  }

  function setDragTarget(next) {
    dragOverRef.current = next;
    setDragOver((current) => (
      current?.column === next?.column && current?.position === next?.position ? current : next
    ));
  }

  function startPointerDrag(event, cardId, isEditing) {
    if (isEditing || isInteractiveTarget(event.target) || (event.pointerType === "mouse" && event.button !== 0)) return;
    dragSessionRef.current = {
      active: false,
      cardId,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function updatePointerDrag(event) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const moved = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.active && moved < 7) return;

    if (!session.active) {
      session.active = true;
      setDraggingId(session.cardId);
    }

    event.preventDefault();
    const target = getPointerDropTarget(event.clientX, event.clientY, session.cardId);
    setDragTarget(target);
  }

  function finishPointerDrag(event) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    if (session.active && dragOverRef.current) {
      const currentCard = boardRef.current.cards.find((card) => card.id === session.cardId);
      const movedAcrossColumns = currentCard?.column && currentCard.column !== dragOverRef.current.column;
      const touchMoveToNewColumn = session.pointerType !== "mouse" && movedAcrossColumns;
      moveCard(session.cardId, dragOverRef.current.column, touchMoveToNewColumn ? 0 : dragOverRef.current.position);
    }

    dragSessionRef.current = null;
    setDraggingId("");
    setDragTarget(null);
  }

  function cancelPointerDrag() {
    dragSessionRef.current = null;
    setDraggingId("");
    setDragTarget(null);
  }

  function getPointerDropTarget(clientX, clientY, cardId) {
    const element = document.elementFromPoint(clientX, clientY);
    const columnElement = element?.closest?.("[data-kanban-column]");
    if (!columnElement) return null;

    const columnId = columnElement.dataset.kanbanColumn;
    const columnCards = boardRef.current.cards.filter((card) => card.column === columnId);
    const cardElement = element.closest?.("[data-kanban-card-id]");
    if (cardElement && columnElement.contains(cardElement)) {
      const targetCardId = cardElement.dataset.kanbanCardId;
      const targetIndex = columnCards.findIndex((card) => card.id === targetCardId);
      if (targetIndex >= 0) {
        if (targetCardId === cardId) return { column: columnId, position: targetIndex };
        const rect = cardElement.getBoundingClientRect();
        return { column: columnId, position: targetIndex + (clientY > rect.top + rect.height / 2 ? 1 : 0) };
      }
    }

    return { column: columnId, position: columnCards.length };
  }

  return (
    <section className="kanban-shell">
      {notice ? <div className={`kanban-toast is-${notice.type}`} role="status">{notice.text}</div> : null}
      {kanbanAgentId ? (
        <aside className="kanban-voice-agent" aria-label="Agente Kanban por voz">
          <elevenlabs-convai agent-id={kanbanAgentId}></elevenlabs-convai>
        </aside>
      ) : null}
      <div className="kanban-hero">
        <div>
          <span className="ui-badge">Organização da família</span>
          <h1>Kanban</h1>
          <div className="kanban-owner-summary" aria-label="Total por responsável">
            {ownerTotals.map((item) => (
              <span className={`kanban-owner-total owner-${item.className}`} key={item.owner}>
                <b>{item.tag}</b>
                {item.total} cards
              </span>
            ))}
          </div>
        </div>
        <form className="kanban-compose" onSubmit={addCard}>
          <label className="kanban-compose-title">
            <span>Nova tarefa</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ex.: pagar conta, ligar para escola..."
              value={form.title}
            />
          </label>
          <div className="kanban-compose-controls">
            <label>
              <span>Grupo</span>
              <select onChange={(event) => setForm((current) => ({ ...current, group: event.target.value }))} value={form.group}>
                {groupOptions.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Dono</span>
              <select onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} value={form.owner}>
                {OWNERS.map((owner) => (
                  <option key={owner} value={owner}>{owner}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Prioridade</span>
              <select onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} value={form.priority}>
                {PRIORITIES.map((priority) => (
                  <option key={priority.id} value={priority.id}>{priority.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Data limite</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                type="date"
                value={form.dueDate}
              />
            </label>
            <label>
              <span>Horário</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, dueTime: event.target.value }))}
                type="time"
                value={form.dueTime}
              />
            </label>
            <label>
              <span>Lembrete</span>
              <select onChange={(event) => setForm((current) => ({ ...current, reminder: event.target.value }))} value={form.reminder}>
                {REMINDERS.map((reminder) => (
                  <option key={reminder.id} value={reminder.id}>{reminder.label}</option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit">
            <Plus size={17} />
            Adicionar
          </button>
        </form>
      </div>

      <CalendarStrip
        calendar={calendar}
        calendarStatus={calendarStatus}
        onRefresh={loadCalendar}
        onSelectCalendar={selectCalendar}
      />

      <section className="kanban-filters" aria-label="Filtros do Kanban">
        <div className="kanban-filters-title">
          <SlidersHorizontal size={16} />
          <span>Filtros</span>
          <button
            aria-pressed={filters.group === groupKey(TRAVEL_GROUP)}
            className={`kanban-travel-filter${filters.group === groupKey(TRAVEL_GROUP) ? " is-active" : ""}`}
            onClick={() => setFilters((current) => ({
              ...current,
              group: current.group === groupKey(TRAVEL_GROUP) ? ALL_FILTER : groupKey(TRAVEL_GROUP)
            }))}
            type="button"
          >
            <Plane size={14} />
            Viagem
            <span>{travelCardCount}</span>
          </button>
        </div>
        <label>
          <span>Responsável</span>
          <select onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))} value={filters.owner}>
            <option value={ALL_FILTER}>Todos</option>
            {OWNERS.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Grupo</span>
          <select onChange={(event) => setFilters((current) => ({ ...current, group: event.target.value }))} value={filters.group}>
            <option value={ALL_FILTER}>Todos</option>
            {groupFilterOptions.map((group) => (
              <option key={group.key} value={group.key}>{group.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Prioridade</span>
          <select onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))} value={filters.priority}>
            <option value={ALL_FILTER}>Todas</option>
            {PRIORITIES.map((priority) => (
              <option key={priority.id} value={priority.id}>{priority.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Prazo</span>
          <select onChange={(event) => setFilters((current) => ({ ...current, due: event.target.value }))} value={filters.due}>
            {DUE_FILTERS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <button
          className="kanban-filter-reset"
          disabled={!activeFilterCount}
          onClick={() => setFilters(EMPTY_FILTERS)}
          type="button"
        >
          <X size={15} />
          Limpar
        </button>
      </section>

      <div className="kanban-meta" aria-live="polite">
        {status.text ? (
          <span className={`is-${status.type}`}>{status.text}</span>
        ) : (
          <span>{activeFilterCount ? `${filteredCards.length} de ${board.cards.length} tarefas exibidas` : `${board.cards.length} tarefas no quadro`}</span>
        )}
      </div>

      <section className="kanban-deadlines" aria-label="Resumo de prazos">
        <DeadlinePill
          label="Atrasados"
          cards={deadlineSummary.overdue}
          onClick={() => setFilters((current) => ({ ...current, due: current.due === "overdue" ? ALL_FILTER : "overdue" }))}
          selected={filters.due === "overdue"}
          tone="danger"
        />
        <DeadlinePill
          label="Hoje"
          cards={deadlineSummary.today}
          onClick={() => setFilters((current) => ({ ...current, due: current.due === "today" ? ALL_FILTER : "today" }))}
          selected={filters.due === "today"}
          tone="today"
        />
        <DeadlinePill
          label="Próximos 7 dias"
          cards={deadlineSummary.soon}
          onClick={() => setFilters((current) => ({ ...current, due: current.due === "next7" ? ALL_FILTER : "next7" }))}
          selected={filters.due === "next7"}
          tone="soon"
        />
      </section>

      <div className="kanban-board">
        {COLUMNS.map((column) => (
          <section
            className={`kanban-column ${dragOver?.column === column.id ? "is-drop-target" : ""}`}
            data-kanban-column={column.id}
            key={column.id}
          >
            <header>
              <div>
                <h2>{column.title}</h2>
                <small>{grouped[column.id].length} cards</small>
              </div>
              <span>{grouped[column.id].length}</span>
            </header>
            <div className="kanban-card-list">
              {grouped[column.id].map((card) => {
                const isEditing = editingId === card.id;
                const ownerTag = OWNER_TAGS[card.owner] || "Sem dono";
                const ownerClass = OWNER_CLASSES[card.owner] || "sem-dono";
                const priorityMeta = PRIORITIES.find((item) => item.id === card.priority) || PRIORITIES[1];
                const allColumnCards = board.cards.filter((item) => item.column === column.id);
                const position = allColumnCards.findIndex((item) => item.id === card.id);

                return (
                  <div
                    className={`kanban-card-stack ${dragOver?.column === column.id && dragOver?.position === position ? "is-drop-before" : ""} ${dragOver?.column === column.id && dragOver?.position === position + 1 ? "is-drop-after" : ""}`}
                    key={card.id}
                  >
                    <article
                      className={`kanban-card priority-${card.priority} ${draggingId === card.id ? "is-dragging" : ""} ${isEditing ? "is-editing" : ""}`}
                      data-kanban-card-id={card.id}
                      onPointerCancel={cancelPointerDrag}
                      onPointerDown={(event) => startPointerDrag(event, card.id, isEditing)}
                      onPointerMove={updatePointerDrag}
                      onPointerUp={finishPointerDrag}
                    >
                      <div className="kanban-card-grip" aria-hidden="true">
                        <GripVertical size={17} />
                      </div>

                      {isEditing ? (
                        <div className="kanban-card-edit">
                          <label>
                            Tarefa
                            <input
                              autoFocus
                              onChange={(event) => setEditingForm((current) => ({ ...current, title: event.target.value }))}
                              value={editingForm.title}
                            />
                          </label>
                          <label>
                            Grupo
                            <select onChange={(event) => setEditingForm((current) => ({ ...current, group: event.target.value }))} value={editingForm.group}>
                              {groupOptions.map((group) => (
                                <option key={group} value={group}>{group}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Dono
                            <select onChange={(event) => setEditingForm((current) => ({ ...current, owner: event.target.value }))} value={editingForm.owner}>
                              {OWNERS.map((owner) => (
                                <option key={owner} value={owner}>{owner}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Prioridade
                            <select onChange={(event) => setEditingForm((current) => ({ ...current, priority: event.target.value }))} value={editingForm.priority}>
                              {PRIORITIES.map((item) => (
                                <option key={item.id} value={item.id}>{item.label}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Status
                            <select onChange={(event) => setEditingForm((current) => ({ ...current, column: event.target.value }))} value={editingForm.column}>
                              {COLUMNS.map((item) => (
                                <option key={item.id} value={item.id}>{item.title}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Data limite
                            <input
                              onChange={(event) => setEditingForm((current) => ({ ...current, dueDate: event.target.value }))}
                              type="date"
                              value={editingForm.dueDate}
                            />
                          </label>
                          <label>
                            Horário
                            <input
                              onChange={(event) => setEditingForm((current) => ({ ...current, dueTime: event.target.value }))}
                              type="time"
                              value={editingForm.dueTime}
                            />
                          </label>
                          <label>
                            Lembrete
                            <select onChange={(event) => setEditingForm((current) => ({ ...current, reminder: event.target.value }))} value={editingForm.reminder}>
                              {REMINDERS.map((item) => (
                                <option key={item.id} value={item.id}>{item.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : (
                        <div>
                          <div className="kanban-card-topline">
                            <span className="kanban-card-group">{canonicalGroupLabel(card.group, groupOptions)}</span>
                            <span className={`kanban-owner-tag owner-${ownerClass}`}>{ownerTag}</span>
                          </div>
                          <h3>{card.title}</h3>
                          <div className="kanban-card-badges">
                            <span className={`kanban-priority priority-${card.priority}`}>{priorityMeta.label}</span>
                            {card.dueDate ? <span className={`kanban-due ${dueTone(card.dueDate, card.column)}`}>{formatDueDate(card.dueDate)}{card.dueTime ? ` ${card.dueTime}` : ""}</span> : null}
                            {card.googleCalendar?.eventId ? <span className="kanban-google-synced">Google</span> : null}
                          </div>
                        </div>
                      )}

                      <div className="kanban-card-actions">
                        {isEditing ? (
                          <>
                            <button aria-label="Salvar edicao" onClick={() => saveEditing(card.id)} type="button">
                              <Check size={15} />
                            </button>
                            <button aria-label="Cancelar edicao" onClick={cancelEditing} type="button">
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              aria-label={card.googleCalendar?.eventId ? "Atualizar evento no Google Calendar" : "Criar evento no Google Calendar"}
                              className="kanban-sync-button"
                              disabled={!calendar.connected || !card.dueDate || syncingCardId === card.id}
                              onClick={() => syncCardToGoogle(card.id)}
                              title={card.googleCalendar?.eventId ? "Atualizar Google" : "Sync Google"}
                              type="button"
                            >
                              {syncingCardId === card.id ? <RefreshCw size={15} /> : card.googleCalendar?.eventId ? <CalendarCheck size={15} /> : <CalendarPlus size={15} />}
                            </button>
                            <button aria-label="Editar tarefa" onClick={() => startEditing(card)} type="button">
                              <Pencil size={15} />
                            </button>
                            <button aria-label="Remover tarefa" onClick={() => deleteCard(card.id)} type="button">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  </div>
                );
              })}
              {!grouped[column.id].length ? <div className="kanban-empty">Sem tarefas aqui.</div> : null}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function DeadlinePill({ cards, label, onClick, selected, tone }) {
  const preview = cards.slice(0, 3).map((card) => card.title).join(", ");
  return (
    <button
      aria-pressed={selected}
      className={`kanban-deadline-pill tone-${tone} ${selected ? "is-selected" : ""}`}
      onClick={onClick}
      title={preview || "Nada por aqui"}
      type="button"
    >
      <span>{label}</span>
      <b>{cards.length}</b>
    </button>
  );
}

function CalendarStrip({ calendar, calendarStatus, onRefresh, onSelectCalendar }) {
  if (!calendar.configured) {
    return (
      <section className="kanban-calendar-strip">
        <div>
          <span className="kanban-calendar-kicker">Google Calendar</span>
          <strong>Credenciais Google pendentes</strong>
        </div>
        <span className="kanban-calendar-note">Defina GOOGLE_CALENDAR_CLIENT_ID e GOOGLE_CALENDAR_CLIENT_SECRET no Vercel.</span>
      </section>
    );
  }

  if (!calendar.connected || calendar.needsReconnect) {
    return (
      <section className="kanban-calendar-strip">
        <div>
          <span className="kanban-calendar-kicker">Google Calendar</span>
          <strong>{calendar.needsReconnect ? "Reconectar agenda" : "Agenda da família"}</strong>
          {calendarStatus.text ? <small className={`is-${calendarStatus.type}`}>{calendarStatus.text}</small> : null}
        </div>
        <a className="kanban-calendar-connect" href="/kanban/auth/google-calendar">
          {calendar.needsReconnect ? "Reconectar" : "Conectar"}
        </a>
      </section>
    );
  }

  return (
    <section className="kanban-calendar-strip">
      <div className="kanban-calendar-head">
        <div>
          <span className="kanban-calendar-kicker">Próximos compromissos</span>
          <strong>Agenda da família</strong>
          {calendarStatus.text ? <small className={`is-${calendarStatus.type}`}>{calendarStatus.text}</small> : null}
        </div>
        <button aria-label="Atualizar agenda" onClick={onRefresh} type="button">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="kanban-calendar-events">
        {calendar.events?.length ? calendar.events.map((event) => (
          <a className="kanban-calendar-event" href={event.htmlLink || "#"} key={`${event.calendarId}-${event.id}`} rel="noreferrer" target="_blank">
            <time>{formatCalendarEventTime(event)}</time>
            <span>{event.title}</span>
          </a>
        )) : <span className="kanban-calendar-empty">Nenhum compromisso próximo.</span>}
      </div>
      {calendar.calendars?.length > 1 ? (
        <div className="kanban-calendar-chips" aria-label="Calendários exibidos">
          {calendarChipOptions(calendar).map((item) => {
            const selected = calendar.selectedCalendarIds.includes(item.id);
            return (
              <button
                className={selected ? "is-selected" : ""}
                key={item.id}
                onClick={() => onSelectCalendar(item.id)}
                type="button"
              >
                <span style={{ background: item.backgroundColor }} />
                {item.summary}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.("a, button, input, select, textarea, [role='button']"));
}

function calendarChipOptions(calendar) {
  const selectedIds = new Set(calendar.selectedCalendarIds || []);
  return [...(calendar.calendars || [])]
    .sort((a, b) => {
      const selectedDiff = Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id));
      if (selectedDiff) return selectedDiff;
      const primaryDiff = Number(Boolean(b.primary)) - Number(Boolean(a.primary));
      if (primaryDiff) return primaryDiff;
      const birthdayDiff = Number(Boolean(isBirthdayCalendar(b))) - Number(Boolean(isBirthdayCalendar(a)));
      if (birthdayDiff) return birthdayDiff;
      return String(a.summary || "").localeCompare(String(b.summary || ""), "pt-BR");
    })
    .slice(0, 10);
}

function isBirthdayCalendar(calendar) {
  return `${calendar?.id || ""} ${calendar?.summary || ""}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/birthday|birthdays|aniversario|aniversarios|contacts/);
}

function calendarNoticeMessage(code) {
  const normalized = String(code || "").trim();
  const messages = {
    connected: {
      type: "success",
      text: "Agenda conectada ao Kanban.",
      toast: "Google Calendar conectado."
    },
    missing_config: {
      type: "error",
      text: "Configure o OAuth do Google Calendar no servidor."
    },
    missing_google_oauth: {
      type: "error",
      text: "Configure GOOGLE_CALENDAR_CLIENT_ID e GOOGLE_CALENDAR_CLIENT_SECRET no Vercel."
    },
    google_denied: {
      type: "error",
      text: "Permissao do Google Calendar cancelada."
    },
    email_mismatch: {
      type: "error",
      text: "Use a mesma conta Google liberada no Kanban."
    },
    state_error: {
      type: "error",
      text: "Sessao de conexao expirada. Tente conectar novamente."
    },
    session_error: {
      type: "error",
      text: "Sessao do Kanban expirada. Entre novamente."
    },
    storage_error: {
      type: "error",
      text: "Nao consegui salvar a conexao da agenda."
    },
    google_error: {
      type: "error",
      text: "Nao consegui concluir a conexao com o Google Calendar."
    }
  };
  return messages[normalized] || null;
}

async function fetchBoard() {
  const response = await fetch(`/kanban/api/board?ts=${Date.now()}`, { cache: "no-store" }).catch(() => null);
  if (!response) return { ok: false, message: "Não consegui carregar o Kanban." };
  const payload = await response.json().catch(() => ({}));
  return response.ok ? payload : { ok: false, message: payload.message || "Não consegui carregar o Kanban." };
}

async function fetchCalendar() {
  const response = await fetch(`/kanban/api/calendar?ts=${Date.now()}`, { cache: "no-store" }).catch(() => null);
  if (!response) return { ok: false, message: "Não consegui carregar a agenda." };
  const payload = await response.json().catch(() => ({}));
  return response.ok ? payload : { ok: false, message: payload.message || "Não consegui carregar a agenda." };
}

function boardSignature(board) {
  return JSON.stringify((board.cards || []).map((card) => [
    card.id,
    card.title,
    card.group,
    card.owner,
    card.priority,
    card.column,
    card.dueDate,
    card.dueTime,
    card.reminder,
    card.googleCalendar?.eventId,
    card.googleCalendar?.syncedAt
  ]));
}

function cardSyncHash(card) {
  return JSON.stringify([card.title, card.dueDate, normalizeTime(card.dueTime)]);
}

function needsGoogleSync(card) {
  if (!card.dueDate) return false;
  return !card.googleCalendar?.eventId || card.googleCalendar?.sourceHash !== cardSyncHash(card);
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

function normalizeBoard(value) {
  const cards = Array.isArray(value?.cards) ? value.cards : [];
  return {
    imports: typeof value?.imports === "object" && value.imports ? value.imports : {},
    cards: cards
      .map((card) => ({
        id: String(card?.id || crypto.randomUUID()),
        title: String(card?.title || "").trim(),
        group: String(card?.group || "Geral").trim(),
        owner: normalizeOwner(card),
        priority: PRIORITIES.some((priority) => priority.id === card?.priority) ? card.priority : "medium",
        dueDate: normalizeDate(card?.dueDate),
        dueTime: normalizeTime(card?.dueTime),
        reminder: REMINDERS.some((reminder) => reminder.id === card?.reminder) ? card.reminder : "none",
        column: COLUMNS.some((column) => column.id === card?.column) ? card.column : "todo",
        googleCalendar: normalizeGoogleCalendar(card?.googleCalendar),
        createdBy: String(card?.createdBy || "Família"),
        createdAt: String(card?.createdAt || new Date().toISOString())
      }))
      .filter((card) => card.title)
  };
}

function normalizeOwner(card) {
  if (OWNERS.includes(card?.owner)) {
    if (card.owner === "Ambos" && card.createdBy === "Google Sheets") return "Sem dono";
    return card.owner;
  }
  return "Sem dono";
}

function matchesBaseFilters(card, filters) {
  if (filters.owner !== ALL_FILTER && card.owner !== filters.owner) return false;
  if (filters.group !== ALL_FILTER && groupKey(card.group) !== filters.group) return false;
  if (filters.priority !== ALL_FILTER && card.priority !== filters.priority) return false;
  return true;
}

function matchesDueFilter(card, dueFilter) {
  if (dueFilter === ALL_FILTER) return true;
  if (card.column === "done" || !card.dueDate) return false;

  const due = parseLocalDate(card.dueDate);
  if (!due) return false;

  const today = localDateStart(new Date());
  if (dueFilter === "overdue") return due < today;
  if (dueFilter === "today") return sameDay(due, today);
  if (dueFilter === "next7") return due > today && due <= addDays(today, 7);
  return true;
}

function uniqueGroupOptions(values) {
  const groups = new Map();

  for (const value of values) {
    const label = cleanGroupLabel(value);
    if (!label) continue;

    const key = groupKey(label);
    const current = groups.get(key);
    if (!current || shouldPreferGroupLabel(label, current)) {
      groups.set(key, label);
    }
  }

  return Array.from(groups.values());
}

function canonicalGroupLabel(value, options) {
  const key = groupKey(value);
  return options.find((group) => groupKey(group) === key) || cleanGroupLabel(value) || "Geral";
}

function shouldPreferGroupLabel(candidate, current) {
  const candidateDecorated = hasDecorativePrefix(candidate);
  const currentDecorated = hasDecorativePrefix(current);
  if (candidateDecorated !== currentDecorated) return candidateDecorated;
  return candidate.length > current.length && groupKey(candidate) === groupKey(current);
}

function hasDecorativePrefix(value) {
  return /^[^\p{L}\p{N}]+/u.test(String(value || "").trim());
}

function groupKey(value) {
  return normalizeFilterText(value) || "geral";
}

function cleanGroupLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeFilterText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
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

function dueTone(value, column) {
  if (column === "done") return "is-done";
  const due = parseLocalDate(value);
  if (!due) return "";
  const today = localDateStart(new Date());
  if (due < today) return "is-overdue";
  if (sameDay(due, today)) return "is-today";
  if (due <= addDays(today, 7)) return "is-soon";
  return "";
}

function formatDueDate(value) {
  const due = parseLocalDate(value);
  if (!due) return "";
  const today = localDateStart(new Date());
  if (due < today) return "Atrasado";
  if (sameDay(due, today)) return "Hoje";
  if (due <= addDays(today, 7)) {
    return due.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  }
  return due.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatCalendarEventTime(event) {
  const start = String(event?.start || "");
  if (!start) return "";
  const date = event.allDay ? parseLocalDate(start) : new Date(start);
  if (!date || Number.isNaN(date.getTime())) return "";
  if (event.allDay) {
    return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
