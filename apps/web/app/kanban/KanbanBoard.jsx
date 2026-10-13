"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarDays, CalendarPlus, Clock, Filter, Mic, Pencil, Plane, Plus, RefreshCw, Trash2, X } from "lucide-react";

const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" }
];

const OWNERS = ["Sem dono", "Vitor", "Nathalie", "Ambos"];
const OWNER_TAGS = {
  "Sem dono": "?",
  Vitor: "VE",
  Nathalie: "NB",
  Ambos: "VN"
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
const LONG_PRESS_MS = 320;
const MOUSE_DRAG_THRESHOLD = 6;
const TOUCH_CANCEL_THRESHOLD = 9;
const AUTOSCROLL_EDGE = 56;
const REMINDERS = [
  { id: "none", label: "Sem lembrete" },
  { id: "same_day", label: "No dia" },
  { id: "one_day", label: "1 dia antes" },
  { id: "three_days", label: "3 dias antes" },
  { id: "one_week", label: "1 semana antes" }
];

export default function KanbanBoard({ csrfToken, calendarNotice, kanbanAgentId, user }) {
  const [board, setBoard] = useState({ imports: {}, cards: [] });
  const [editingId, setEditingId] = useState("");
  const [editingForm, setEditingForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [focusTitle, setFocusTitle] = useState(true);
  const [composerColumn, setComposerColumn] = useState("");
  const [composerText, setComposerText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [calendar, setCalendar] = useState({ connected: false, configured: true, calendars: [], selectedCalendarIds: [], syncCalendarId: "primary", events: [] });
  const [calendarStatus, setCalendarStatus] = useState({ type: "idle", text: "" });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [syncingCardId, setSyncingCardId] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const [ghost, setGhost] = useState(null);
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
  const boardScrollRef = useRef(null);
  const ghostRef = useRef(null);
  const autoScrollFrameRef = useRef(0);
  const composerRef = useRef(null);

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
    endDragSession();
  }, []);

  // Enquanto um card esta sendo arrastado pelo toque, impede a pagina/lista de rolar.
  useEffect(() => {
    function blockScrollWhileDragging(event) {
      if (dragSessionRef.current?.active) event.preventDefault();
    }
    document.addEventListener("touchmove", blockScrollWhileDragging, { passive: false });
    return () => document.removeEventListener("touchmove", blockScrollWhileDragging);
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      if (dragSessionRef.current) {
        endDragSession();
        return;
      }
      if (editingId) cancelEditing();
      else if (composerColumn) closeComposer();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composerColumn, editingId]);

  useEffect(() => {
    const message = calendarNoticeMessage(calendarNotice);
    if (!message) return;

    setCalendarStatus({ type: message.type, text: message.text });
    showNotice(message.toast || message.text, message.type);
    setShowCalendar(true);

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
      if (editingId || draggingId || composerColumn || statusRef.current.type === "saving") return;

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
  }, [composerColumn, draggingId, editingId]);

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
      editingForm.group
    ]);
  }, [board.cards, editingForm.group]);

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

  const columnPositions = useMemo(() => {
    const positions = new Map();
    const counters = Object.fromEntries(COLUMNS.map((column) => [column.id, 0]));
    for (const card of board.cards) {
      positions.set(card.id, counters[card.column] ?? 0);
      counters[card.column] = (counters[card.column] ?? 0) + 1;
    }
    return { positions, counts: counters };
  }, [board.cards]);

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
      total: board.cards.filter((card) => card.owner === owner && card.column !== "done").length
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

  const editingCard = editingId ? board.cards.find((card) => card.id === editingId) || null : null;
  const ghostCard = ghost ? board.cards.find((card) => card.id === ghost.cardId) || null : null;

  async function persist(nextBoard) {
    const normalized = normalizeBoard(nextBoard);
    boardRef.current = normalized;
    setBoard(normalized);
    setStatus({ type: "saving", text: "Salvando..." });

    const response = await fetch("/kanban/api/board", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-economics-csrf": csrfToken
      },
      body: JSON.stringify({ board: normalized })
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) : {};

    if (!response?.ok || !payload.ok) {
      setStatus({ type: "error", text: payload.message || "Não consegui salvar." });
      return;
    }

    const savedBoard = normalizeBoard(payload.board || normalized);
    boardRef.current = savedBoard;
    setBoard(savedBoard);
    setStatus({ type: "success", text: "Salvo" });
    window.setTimeout(() => {
      if (statusRef.current.type === "success") setStatus({ type: "idle", text: "" });
    }, 1400);
  }

  function showNotice(text, type = "success") {
    setNotice({ text, type });
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3600);
  }

  function openComposer(column) {
    setComposerColumn(column);
    setComposerText("");
    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.scrollIntoView({ block: "nearest" });
    });
  }

  function closeComposer() {
    setComposerColumn("");
    setComposerText("");
  }

  function addCardToColumn(event, column) {
    event?.preventDefault?.();
    const title = composerText.trim();
    if (!title) {
      composerRef.current?.focus();
      return;
    }

    const group = filters.group !== ALL_FILTER
      ? groupOptions.find((item) => groupKey(item) === filters.group) || "Geral"
      : "Geral";
    const newCard = {
      id: crypto.randomUUID(),
      title,
      group,
      owner: filters.owner !== ALL_FILTER ? filters.owner : "Sem dono",
      priority: filters.priority !== ALL_FILTER ? filters.priority : "medium",
      dueDate: "",
      dueTime: "",
      reminder: "none",
      column,
      createdBy: user?.name || "Família",
      createdAt: new Date().toISOString()
    };

    const currentBoard = boardRef.current;
    const cards = [...currentBoard.cards];
    let lastIndex = -1;
    cards.forEach((card, index) => {
      if (card.column === column) lastIndex = index;
    });
    cards.splice(lastIndex >= 0 ? lastIndex + 1 : cards.length, 0, newCard);

    setComposerText("");
    persist({ ...currentBoard, cards });
    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.scrollIntoView({ block: "nearest" });
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
    const nextIndex = Number.isInteger(adjustedPosition) ? Math.max(0, Math.min(adjustedPosition, targetCards.length)) : targetCards.length;
    targetCards.splice(nextIndex, 0, movedCard);

    const cards = COLUMNS.flatMap((item) => cardsByColumn[item.id]);
    persist({ ...currentBoard, cards });
  }

  function deleteCard(cardId) {
    const currentBoard = boardRef.current;
    const removed = currentBoard.cards.find((card) => card.id === cardId);
    cancelEditing();
    persist({
      ...currentBoard,
      cards: currentBoard.cards.filter((card) => card.id !== cardId)
    });
    if (removed) showNotice(`Cartão excluído: ${removed.title}`);
  }

  function startEditing(card, options = {}) {
    setFocusTitle(!options.fromTouch);
    setConfirmDelete(false);
    setEditingId(card.id);
    setEditingForm({
      title: card.title,
      group: canonicalGroupLabel(card.group, groupOptions),
      owner: card.owner,
      priority: card.priority,
      column: card.column,
      dueDate: card.dueDate || "",
      dueTime: card.dueTime || "",
      reminder: card.reminder || "none"
    });
  }

  function cancelEditing() {
    setEditingId("");
    setEditingForm(EMPTY_FORM);
    setConfirmDelete(false);
  }

  function saveEditing(cardId) {
    const title = editingForm.title.replace(/\s+/g, " ").trim();
    if (!title) return;

    const currentBoard = boardRef.current;
    const currentCard = currentBoard.cards.find((card) => card.id === cardId);
    if (!currentCard) {
      cancelEditing();
      return;
    }

    const editedCard = {
      ...currentCard,
      title,
      group: cleanGroupLabel(editingForm.group) || "Geral",
      owner: editingForm.owner,
      priority: editingForm.priority,
      column: editingForm.column,
      dueDate: editingForm.dueDate,
      dueTime: editingForm.dueDate ? editingForm.dueTime : "",
      reminder: editingForm.dueDate ? editingForm.reminder : "none"
    };

    persist({
      ...currentBoard,
      cards: editedCard.column !== currentCard.column
        ? moveCardToColumnTop(currentBoard.cards, editedCard)
        : currentBoard.cards.map((card) => (card.id === cardId ? editedCard : card))
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

  // ---------- Arrastar e soltar (mouse: arrasta direto; toque: segurar ~0,3s) ----------

  function setDragTarget(next) {
    dragOverRef.current = next;
    setDragOver((current) => (
      current?.column === next?.column && current?.position === next?.position ? current : next
    ));
  }

  function startPointerDrag(event, cardId) {
    if (dragSessionRef.current || isInteractiveTarget(event.target)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const session = {
      active: false,
      cardId,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      timer: 0,
      onMove: null,
      onUp: null,
      onCancel: null
    };

    session.onMove = (moveEvent) => handlePointerMove(session, moveEvent);
    session.onUp = (upEvent) => handlePointerUp(session, upEvent);
    session.onCancel = (cancelEvent) => {
      if (cancelEvent.pointerId === session.pointerId) endDragSession();
    };

    if (event.pointerType !== "mouse") {
      session.timer = window.setTimeout(() => {
        if (dragSessionRef.current === session && !session.active) activateDrag(session);
      }, LONG_PRESS_MS);
    }

    dragSessionRef.current = session;
    window.addEventListener("pointermove", session.onMove, { passive: false });
    window.addEventListener("pointerup", session.onUp);
    window.addEventListener("pointercancel", session.onCancel);
  }

  function activateDrag(session) {
    session.active = true;
    if (session.pointerType !== "mouse") navigator.vibrate?.(12);
    setDraggingId(session.cardId);
    setGhost({ cardId: session.cardId, width: session.width, height: session.height, x: session.lastX - session.offsetX, y: session.lastY - session.offsetY });
    setDragTarget(getPointerDropTarget(session.lastX, session.lastY));
    window.cancelAnimationFrame(autoScrollFrameRef.current);
    autoScrollFrameRef.current = window.requestAnimationFrame(autoScrollTick);
  }

  function handlePointerMove(session, event) {
    if (event.pointerId !== session.pointerId) return;
    session.lastX = event.clientX;
    session.lastY = event.clientY;
    const moved = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);

    if (!session.active) {
      if (session.pointerType === "mouse") {
        if (moved >= MOUSE_DRAG_THRESHOLD) activateDrag(session);
      } else if (moved > TOUCH_CANCEL_THRESHOLD) {
        // O dedo se mexeu antes do toque longo: e rolagem, nao arrasto.
        endDragSession();
      }
      return;
    }

    event.preventDefault();
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate3d(${event.clientX - session.offsetX}px, ${event.clientY - session.offsetY}px, 0)`;
    }
    setDragTarget(getPointerDropTarget(event.clientX, event.clientY));
  }

  function handlePointerUp(session, event) {
    if (event.pointerId !== session.pointerId) return;

    if (!session.active) {
      const moved = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
      endDragSession();
      if (moved < MOUSE_DRAG_THRESHOLD && !isInteractiveTarget(event.target)) {
        const card = boardRef.current.cards.find((item) => item.id === session.cardId);
        if (card) {
          if (session.pointerType !== "mouse") suppressGhostClick();
          startEditing(card, { fromTouch: session.pointerType !== "mouse" });
        }
      }
      return;
    }

    const target = dragOverRef.current;
    const cardId = session.cardId;
    endDragSession();
    if (target && !isNoopDrop(cardId, target)) moveCard(cardId, target.column, target.position);
  }

  function endDragSession() {
    const session = dragSessionRef.current;
    if (session) {
      window.clearTimeout(session.timer);
      window.removeEventListener("pointermove", session.onMove);
      window.removeEventListener("pointerup", session.onUp);
      window.removeEventListener("pointercancel", session.onCancel);
    }
    window.cancelAnimationFrame(autoScrollFrameRef.current);
    dragSessionRef.current = null;
    setDraggingId("");
    setGhost(null);
    setDragTarget(null);
  }

  function autoScrollTick() {
    const session = dragSessionRef.current;
    if (!session?.active) return;

    const boardElement = boardScrollRef.current;
    if (boardElement) {
      const rect = boardElement.getBoundingClientRect();
      if (session.lastX < rect.left + AUTOSCROLL_EDGE) boardElement.scrollLeft -= scrollStep(rect.left + AUTOSCROLL_EDGE - session.lastX);
      else if (session.lastX > rect.right - AUTOSCROLL_EDGE) boardElement.scrollLeft += scrollStep(session.lastX - (rect.right - AUTOSCROLL_EDGE));
    }

    const listElement = document.elementFromPoint(session.lastX, session.lastY)?.closest?.("[data-kanban-column]")?.querySelector?.("[data-kanban-scroll]");
    if (listElement) {
      const rect = listElement.getBoundingClientRect();
      if (session.lastY < rect.top + AUTOSCROLL_EDGE) listElement.scrollTop -= scrollStep(rect.top + AUTOSCROLL_EDGE - session.lastY);
      else if (session.lastY > rect.bottom - AUTOSCROLL_EDGE) listElement.scrollTop += scrollStep(session.lastY - (rect.bottom - AUTOSCROLL_EDGE));
    }

    setDragTarget(getPointerDropTarget(session.lastX, session.lastY));
    autoScrollFrameRef.current = window.requestAnimationFrame(autoScrollTick);
  }

  function isNoopDrop(cardId, target) {
    const card = boardRef.current.cards.find((item) => item.id === cardId);
    if (!card || card.column !== target.column) return false;
    const index = boardRef.current.cards.filter((item) => item.column === card.column).findIndex((item) => item.id === cardId);
    return target.position === index || target.position === index + 1;
  }

  function getPointerDropTarget(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    if (element?.closest?.("[data-kanban-placeholder]")) return dragOverRef.current;

    const columnElement = element?.closest?.("[data-kanban-column]");
    if (!columnElement) return dragOverRef.current;

    const columnId = columnElement.dataset.kanbanColumn;
    const columnCards = boardRef.current.cards.filter((card) => card.column === columnId);
    const cardElement = element.closest?.("[data-kanban-card-id]");
    if (cardElement && columnElement.contains(cardElement)) {
      const targetCardId = cardElement.dataset.kanbanCardId;
      const targetIndex = columnCards.findIndex((card) => card.id === targetCardId);
      if (targetIndex >= 0) {
        const rect = cardElement.getBoundingClientRect();
        return { column: columnId, position: targetIndex + (clientY > rect.top + rect.height / 2 ? 1 : 0) };
      }
    }

    // Fora de um card: antes do primeiro (se acima dele) ou no fim da lista.
    const firstCard = columnElement.querySelector("[data-kanban-card-id]");
    if (firstCard && clientY < firstCard.getBoundingClientRect().top) {
      const firstIndex = columnCards.findIndex((card) => card.id === firstCard.dataset.kanbanCardId);
      return { column: columnId, position: Math.max(0, firstIndex) };
    }
    return { column: columnId, position: columnCards.length };
  }

  const dropIsNoop = draggingId && dragOver ? isNoopDrop(draggingId, dragOver) : true;
  const placeholderHeight = ghost?.height || 44;

  return (
    <section className="tk-shell">
      {notice ? <div className={`kanban-toast tk-toast is-${notice.type}`} role="status">{notice.text}</div> : null}
      {kanbanAgentId && showVoice ? (
        <aside className="kanban-voice-agent" aria-label="Agente Kanban por voz">
          <elevenlabs-convai agent-id={kanbanAgentId}></elevenlabs-convai>
        </aside>
      ) : null}

      <header className="tk-boardbar">
        <h1>Kanban da família</h1>
        <div className="tk-members" aria-label="Tarefas abertas por responsável">
          {ownerTotals.filter((item) => item.owner !== "Sem dono").map((item) => (
            <button
              aria-pressed={filters.owner === item.owner}
              className={`tk-member ${filters.owner === item.owner ? "is-active" : ""}`}
              key={item.owner}
              onClick={() => setFilters((current) => ({ ...current, owner: current.owner === item.owner ? ALL_FILTER : item.owner }))}
              title={`${item.owner}: ${item.total} abertas`}
              type="button"
            >
              <span className={`tk-avatar owner-${item.className}`}>{item.tag}</span>
              {item.total}
            </button>
          ))}
        </div>
        <span className={`tk-status is-${status.type}`} aria-live="polite">
          {status.text || (activeFilterCount ? `${filteredCards.length} de ${board.cards.length} cartões` : "")}
        </span>
        <div className="tk-actions">
          <DeadlineButton
            cards={deadlineSummary.overdue}
            label="Atrasados"
            onClick={() => setFilters((current) => ({ ...current, due: current.due === "overdue" ? ALL_FILTER : "overdue" }))}
            selected={filters.due === "overdue"}
            tone="danger"
          />
          <DeadlineButton
            cards={deadlineSummary.today}
            label="Hoje"
            onClick={() => setFilters((current) => ({ ...current, due: current.due === "today" ? ALL_FILTER : "today" }))}
            selected={filters.due === "today"}
            tone="today"
          />
          <DeadlineButton
            cards={deadlineSummary.soon}
            label="7 dias"
            onClick={() => setFilters((current) => ({ ...current, due: current.due === "next7" ? ALL_FILTER : "next7" }))}
            selected={filters.due === "next7"}
            tone="soon"
          />
          {kanbanAgentId ? (
            <button
              aria-pressed={showVoice}
              className={`tk-btn ${showVoice ? "is-active" : ""}`}
              onClick={() => setShowVoice((value) => !value)}
              title={showVoice ? "Esconder assistente de voz" : "Falar com o assistente de voz"}
              type="button"
            >
              <Mic size={15} />
              Voz
            </button>
          ) : null}
          <button
            aria-expanded={showCalendar}
            className={`tk-btn ${showCalendar ? "is-active" : ""}`}
            onClick={() => setShowCalendar((value) => !value)}
            type="button"
          >
            <CalendarDays size={15} />
            Agenda
            {calendar.events?.length ? <b>{calendar.events.length}</b> : null}
          </button>
          <button
            aria-expanded={showFilters}
            className={`tk-btn ${showFilters || activeFilterCount ? "is-active" : ""}`}
            onClick={() => setShowFilters((value) => !value)}
            type="button"
          >
            <Filter size={15} />
            Filtros
            {activeFilterCount ? <b>{activeFilterCount}</b> : null}
          </button>
        </div>
      </header>

      {showFilters ? (
        <section className="tk-panel" aria-label="Filtros do Kanban">
          <button
            aria-pressed={filters.group === groupKey(TRAVEL_GROUP)}
            className={`tk-chip ${filters.group === groupKey(TRAVEL_GROUP) ? "is-selected" : ""}`}
            onClick={() => setFilters((current) => ({
              ...current,
              group: current.group === groupKey(TRAVEL_GROUP) ? ALL_FILTER : groupKey(TRAVEL_GROUP)
            }))}
            type="button"
          >
            <Plane size={14} />
            Viagem ({travelCardCount})
          </button>
          <label>
            Responsável
            <select onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))} value={filters.owner}>
              <option value={ALL_FILTER}>Todos</option>
              {OWNERS.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </label>
          <label>
            Grupo
            <select onChange={(event) => setFilters((current) => ({ ...current, group: event.target.value }))} value={filters.group}>
              <option value={ALL_FILTER}>Todos</option>
              {groupFilterOptions.map((group) => (
                <option key={group.key} value={group.key}>{group.label}</option>
              ))}
            </select>
          </label>
          <label>
            Prioridade
            <select onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))} value={filters.priority}>
              <option value={ALL_FILTER}>Todas</option>
              {PRIORITIES.map((priority) => (
                <option key={priority.id} value={priority.id}>{priority.label}</option>
              ))}
            </select>
          </label>
          <label>
            Prazo
            <select onChange={(event) => setFilters((current) => ({ ...current, due: event.target.value }))} value={filters.due}>
              {DUE_FILTERS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <button className="tk-secondary" disabled={!activeFilterCount} onClick={() => setFilters(EMPTY_FILTERS)} type="button">
            <X size={14} />
            Limpar filtros
          </button>
        </section>
      ) : null}

      {showCalendar ? (
        <div className="tk-panel tk-calendar-panel">
          <CalendarStrip
            calendar={calendar}
            calendarStatus={calendarStatus}
            onRefresh={loadCalendar}
            onSelectCalendar={selectCalendar}
          />
        </div>
      ) : null}

      <div className={`tk-board ${draggingId ? "is-dragging" : ""}`} ref={boardScrollRef}>
        {COLUMNS.map((column) => {
          const cards = grouped[column.id];
          const isTarget = Boolean(draggingId) && dragOver?.column === column.id;
          const showPlaceholderAt = isTarget && !dropIsNoop ? dragOver.position : -1;
          let placeholderRendered = false;
          const placeholder = (
            <div aria-hidden="true" className="tk-placeholder" data-kanban-placeholder="" key="placeholder" style={{ height: placeholderHeight }} />
          );

          return (
            <section
              aria-label={column.title}
              className={`tk-list ${isTarget ? "is-drop-target" : ""}`}
              data-kanban-column={column.id}
              key={column.id}
            >
              <header className="tk-list-header">
                <h2>{column.title}</h2>
                <span>{cards.length}</span>
              </header>

              <div className="tk-cards" data-kanban-scroll="">
                {cards.map((card) => {
                  const position = columnPositions.positions.get(card.id);
                  const before = !placeholderRendered && showPlaceholderAt >= 0 && position >= showPlaceholderAt;
                  if (before) placeholderRendered = true;

                  return [
                    before ? placeholder : null,
                    <CardFace
                      card={card}
                      dragging={draggingId === card.id}
                      groupLabel={canonicalGroupLabel(card.group, groupOptions)}
                      key={card.id}
                      onOpen={() => startEditing(card)}
                      onPointerDown={(event) => startPointerDrag(event, card.id)}
                    />
                  ];
                })}
                {showPlaceholderAt >= 0 && !placeholderRendered ? placeholder : null}
                {composerColumn === column.id ? (
                  <form className="tk-composer" onSubmit={(event) => addCardToColumn(event, column.id)}>
                    <textarea
                      aria-label="Título do cartão"
                      autoFocus
                      onBlur={() => {
                        if (!composerText.trim()) closeComposer();
                      }}
                      onChange={(event) => setComposerText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) addCardToColumn(event, column.id);
                      }}
                      placeholder="Insira um título para este cartão..."
                      ref={composerRef}
                      rows={3}
                      value={composerText}
                    />
                    <div className="tk-composer-row">
                      <button className="tk-primary" onMouseDown={(event) => event.preventDefault()} type="submit">Adicionar cartão</button>
                      <button aria-label="Cancelar" className="tk-icon-btn" onClick={closeComposer} onMouseDown={(event) => event.preventDefault()} type="button">
                        <X size={18} />
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>

              {composerColumn !== column.id ? (
                <button className="tk-composer-toggle" onClick={() => openComposer(column.id)} type="button">
                  <Plus size={16} />
                  Adicionar um cartão
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      {ghost && ghostCard ? (
        <div
          aria-hidden="true"
          className="tk-ghost"
          ref={ghostRef}
          style={{ width: ghost.width, transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0)` }}
        >
          <CardFace card={ghostCard} groupLabel={canonicalGroupLabel(ghostCard.group, groupOptions)} />
        </div>
      ) : null}

      {editingCard ? (
        <CardModal
          calendar={calendar}
          card={editingCard}
          confirmDelete={confirmDelete}
          focusTitle={focusTitle}
          form={editingForm}
          groupOptions={groupOptions}
          onClose={cancelEditing}
          onDelete={() => (confirmDelete ? deleteCard(editingCard.id) : setConfirmDelete(true))}
          onSave={() => saveEditing(editingCard.id)}
          onSync={() => syncCardToGoogle(editingCard.id)}
          setForm={setEditingForm}
          syncing={syncingCardId === editingCard.id}
        />
      ) : null}
    </section>
  );
}

function CardFace({ card, dragging = false, groupLabel, onOpen, onPointerDown }) {
  const ownerTag = OWNER_TAGS[card.owner] || "?";
  const ownerClass = OWNER_CLASSES[card.owner] || "sem-dono";
  const priorityMeta = PRIORITIES.find((item) => item.id === card.priority) || PRIORITIES[1];
  const showPriority = card.priority === "high" || card.priority === "urgent";
  const interactive = Boolean(onPointerDown);

  return (
    <article
      aria-label={interactive ? `Abrir cartão: ${card.title}` : undefined}
      className={`tk-card ${dragging ? "is-dragging" : ""} ${card.column === "done" ? "is-done" : ""}`}
      data-kanban-card-id={interactive ? card.id : undefined}
      onContextMenu={interactive ? (event) => event.preventDefault() : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.();
        }
      } : undefined}
      onPointerDown={onPointerDown}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className="tk-card-labels">
        {showPriority ? <span className={`tk-label priority-${card.priority}`}>{priorityMeta.label}</span> : null}
        <span className="tk-label tk-label-group" style={{ "--label-hue": groupHue(groupLabel) }}>{groupLabel}</span>
      </div>
      <h3>{card.title}</h3>
      <div className="tk-card-footer">
        {card.dueDate ? (
          <span className={`tk-badge tk-due ${dueTone(card.dueDate, card.column)}`} title="Data limite">
            <Clock size={12} />
            {formatCardDate(card.dueDate)}{card.dueTime ? ` ${card.dueTime}` : ""}
          </span>
        ) : null}
        {card.googleCalendar?.eventId ? (
          <span className="tk-badge" title="No Google Agenda">
            <CalendarCheck size={12} />
          </span>
        ) : null}
        {card.owner !== "Sem dono" ? <span className={`tk-avatar owner-${ownerClass}`} title={card.owner}>{ownerTag}</span> : null}
      </div>
      {interactive ? (
        <button aria-label="Editar cartão" className="tk-card-edit" onClick={onOpen} tabIndex={-1} type="button">
          <Pencil size={13} />
        </button>
      ) : null}
    </article>
  );
}

function CardModal({ calendar, card, confirmDelete, focusTitle, form, groupOptions, onClose, onDelete, onSave, onSync, setForm, syncing }) {
  const column = COLUMNS.find((item) => item.id === form.column) || COLUMNS[0];
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  return (
    <div
      className="tk-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div aria-labelledby="tk-modal-title" aria-modal="true" className="tk-modal" role="dialog">
        <button aria-label="Fechar" className="tk-icon-btn tk-modal-close" onClick={onClose} type="button">
          <X size={20} />
        </button>

        <div className="tk-modal-head">
          <textarea
            aria-label="Título"
            autoFocus={focusTitle}
            id="tk-modal-title"
            onChange={(event) => update({ title: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
            rows={2}
            value={form.title}
          />
          <label className="tk-modal-sub">
            na lista
            <select onChange={(event) => update({ column: event.target.value })} value={column.id}>
              {COLUMNS.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="tk-field">
          <span>Responsável</span>
          <div className="tk-chips">
            {OWNERS.map((owner) => (
              <button
                aria-pressed={form.owner === owner}
                className={`tk-chip ${form.owner === owner ? "is-selected" : ""}`}
                key={owner}
                onClick={() => update({ owner })}
                type="button"
              >
                <span className={`tk-avatar owner-${OWNER_CLASSES[owner]}`}>{OWNER_TAGS[owner]}</span>
                {owner}
              </button>
            ))}
          </div>
        </div>

        <div className="tk-field">
          <span>Prioridade</span>
          <div className="tk-chips">
            {PRIORITIES.map((priority) => (
              <button
                aria-pressed={form.priority === priority.id}
                className={`tk-chip tk-chip-priority priority-${priority.id} ${form.priority === priority.id ? "is-selected" : ""}`}
                key={priority.id}
                onClick={() => update({ priority: priority.id })}
                type="button"
              >
                {priority.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tk-fields">
          <label className="tk-field">
            <span>Grupo</span>
            <input list="tk-group-options" onChange={(event) => update({ group: event.target.value })} placeholder="Geral" value={form.group} />
            <datalist id="tk-group-options">
              {groupOptions.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
          </label>
          <label className="tk-field">
            <span>Data limite</span>
            <input onChange={(event) => update({ dueDate: event.target.value })} type="date" value={form.dueDate} />
          </label>
          <label className="tk-field">
            <span>Horário</span>
            <input disabled={!form.dueDate} onChange={(event) => update({ dueTime: event.target.value })} type="time" value={form.dueTime} />
          </label>
          <label className="tk-field">
            <span>Lembrete</span>
            <select disabled={!form.dueDate} onChange={(event) => update({ reminder: event.target.value })} value={form.reminder}>
              {REMINDERS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="tk-modal-meta">
          Criado por {card.createdBy || "Família"}{formatCreatedAt(card.createdAt)}
        </p>

        <div className="tk-modal-actions">
          <div className="tk-modal-actions-left">
            <button className="tk-primary" disabled={!form.title.trim()} onClick={onSave} type="button">Salvar</button>
            <button className="tk-secondary" onClick={onClose} type="button">Cancelar</button>
          </div>
          <div className="tk-modal-actions-right">
            <button
              className="tk-secondary"
              disabled={!calendar.connected || !card.dueDate || syncing}
              onClick={onSync}
              title={!card.dueDate ? "Salve uma data limite para enviar à agenda" : undefined}
              type="button"
            >
              {syncing ? <RefreshCw size={15} /> : card.googleCalendar?.eventId ? <CalendarCheck size={15} /> : <CalendarPlus size={15} />}
              {card.googleCalendar?.eventId ? "Atualizar agenda" : "Enviar à agenda"}
            </button>
            <button className={confirmDelete ? "tk-danger" : "tk-secondary"} onClick={onDelete} type="button">
              <Trash2 size={15} />
              {confirmDelete ? "Confirmar exclusão" : "Excluir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeadlineButton({ cards, label, onClick, selected, tone }) {
  const preview = cards.slice(0, 3).map((card) => card.title).join(", ");
  if (!cards.length && !selected) return null;
  return (
    <button
      aria-pressed={selected}
      className={`tk-btn tone-${tone} ${selected ? "is-active" : ""}`}
      onClick={onClick}
      title={preview || "Nada por aqui"}
      type="button"
    >
      {label}
      <b>{cards.length}</b>
    </button>
  );
}

// No toque, o navegador dispara mousedown/click depois do toque; sem isso, eles
// cairiam em um campo do modal recem-aberto (abrindo teclado ou seletor de data).
function suppressGhostClick() {
  const swallow = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const events = ["mousedown", "mouseup", "click"];
  for (const name of events) window.addEventListener(name, swallow, true);
  window.setTimeout(() => {
    for (const name of events) window.removeEventListener(name, swallow, true);
  }, 450);
}

function scrollStep(distance) {
  return Math.ceil(Math.min(distance, AUTOSCROLL_EDGE) / AUTOSCROLL_EDGE * 16);
}

function groupHue(label) {
  const key = groupKey(label);
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)) % 360;
  return hash;
}

function formatCardDate(value) {
  const due = parseLocalDate(value);
  if (!due) return "";
  const today = localDateStart(new Date());
  if (sameDay(due, today)) return "Hoje";
  if (sameDay(due, addDays(today, 1))) return "Amanhã";
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const label = `${due.getDate()} ${months[due.getMonth()]}`;
  return due.getFullYear() === today.getFullYear() ? label : `${label} ${due.getFullYear()}`;
}

function formatCreatedAt(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return ` em ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
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
  const interactive = target?.closest?.("a, button, input, select, textarea, [role='button']");
  // O proprio cartao tem role="button"; so conta como interativo um controle dentro dele.
  return Boolean(interactive && !interactive.hasAttribute("data-kanban-card-id"));
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
