"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";

const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" }
];

const OWNERS = ["Vitor", "Nathalie", "Ambos"];
const OWNER_TAGS = {
  Vitor: "VE",
  Nathalie: "NB",
  Ambos: "Ambos"
};
const BASE_GROUPS = ["Geral", "Escritorio", "Quarto Luiza", "Hall", "Lavabo", "Sala"];

const EMPTY_FORM = {
  title: "",
  group: "Geral",
  owner: "Ambos"
};

export default function KanbanBoard({ csrfToken, user }) {
  const [board, setBoard] = useState({ imports: {}, cards: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [editingForm, setEditingForm] = useState(EMPTY_FORM);
  const [draggingId, setDraggingId] = useState("");
  const [status, setStatus] = useState({ type: "idle", text: "" });

  useEffect(() => {
    let active = true;

    async function loadBoard() {
      setStatus({ type: "loading", text: "Carregando quadro..." });
      const response = await fetch("/kanban/api/board", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!active) return;

      if (response.ok && payload.ok) {
        setBoard(normalizeBoard(payload.board));
        setStatus({ type: "idle", text: "" });
      } else {
        setStatus({ type: "error", text: payload.message || "Nao consegui carregar o Kanban." });
      }
    }

    loadBoard();
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(COLUMNS.map((column) => [column.id, []]));
    for (const card of board.cards) {
      groups[card.column]?.push(card);
    }
    return groups;
  }, [board.cards]);

  const groupOptions = useMemo(() => {
    const names = new Set(BASE_GROUPS);
    for (const card of board.cards) names.add(card.group || "Geral");
    if (form.group) names.add(form.group);
    if (editingForm.group) names.add(editingForm.group);
    return Array.from(names).filter(Boolean);
  }, [board.cards, editingForm.group, form.group]);

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
      setStatus({ type: "error", text: payload.message || "Nao consegui salvar." });
      return;
    }

    setStatus({ type: "success", text: "Salvo." });
    window.setTimeout(() => setStatus({ type: "idle", text: "" }), 1400);
  }

  function addCard(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    setForm(EMPTY_FORM);
    persist({
      ...board,
      cards: [
        ...board.cards,
        {
          id: crypto.randomUUID(),
          title,
          group: form.group,
          owner: form.owner,
          column: "todo",
          createdBy: user?.name || "Familia",
          createdAt: new Date().toISOString()
        }
      ]
    });
  }

  function moveCard(cardId, column) {
    const currentCard = board.cards.find((card) => card.id === cardId);
    if (!currentCard || currentCard.column === column) return;

    const movedCard = { ...currentCard, column };
    const remaining = board.cards.filter((card) => card.id !== cardId);
    const lastInColumn = remaining.reduce((lastIndex, card, index) => (card.column === column ? index : lastIndex), -1);
    const cards = [...remaining];
    cards.splice(lastInColumn + 1, 0, movedCard);
    persist({ ...board, cards });
  }

  function deleteCard(cardId) {
    persist({
      ...board,
      cards: board.cards.filter((card) => card.id !== cardId)
    });
  }

  function startEditing(card) {
    setEditingId(card.id);
    setEditingForm({ title: card.title, group: card.group, owner: card.owner });
  }

  function cancelEditing() {
    setEditingId("");
    setEditingForm(EMPTY_FORM);
  }

  function saveEditing(cardId) {
    const title = editingForm.title.trim();
    if (!title) return;

    persist({
      ...board,
      cards: board.cards.map((card) => (
        card.id === cardId
          ? { ...card, title, group: editingForm.group, owner: editingForm.owner }
          : card
      ))
    });
    cancelEditing();
  }

  function moveByStep(card, direction) {
    const index = COLUMNS.findIndex((column) => column.id === card.column);
    const next = COLUMNS[index + direction];
    if (next) moveCard(card.id, next.id);
  }

  function movePriority(card, direction) {
    const sameColumn = grouped[card.column] || [];
    const columnIndex = sameColumn.findIndex((item) => item.id === card.id);
    const target = sameColumn[columnIndex + direction];
    if (!target) return;

    const cards = [...board.cards];
    const from = cards.findIndex((item) => item.id === card.id);
    const to = cards.findIndex((item) => item.id === target.id);
    [cards[from], cards[to]] = [cards[to], cards[from]];
    persist({ ...board, cards });
  }

  return (
    <section className="kanban-shell">
      <div className="kanban-hero">
        <div>
          <span className="ui-badge">Organizacao da familia</span>
          <h1>Kanban</h1>
          <p>Arraste tarefas entre colunas, edite cards e use as setas para ajustar prioridade.</p>
        </div>
        <form className="kanban-compose" onSubmit={addCard}>
          <label>
            Nova tarefa
            <input
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ex.: pagar conta, ligar para escola..."
              value={form.title}
            />
          </label>
          <label>
            Grupo
            <select onChange={(event) => setForm((current) => ({ ...current, group: event.target.value }))} value={form.group}>
              {groupOptions.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>
          <label>
            Dono
            <select onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} value={form.owner}>
              {OWNERS.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </label>
          <button type="submit">
            <Plus size={17} />
            Adicionar
          </button>
        </form>
      </div>

      <div className="kanban-meta" aria-live="polite">
        {status.text ? <span className={`is-${status.type}`}>{status.text}</span> : <span>{board.cards.length} tarefas no quadro</span>}
      </div>

      <div className="kanban-board">
        {COLUMNS.map((column) => (
          <section
            className="kanban-column"
            key={column.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingId) moveCard(draggingId, column.id);
              setDraggingId("");
            }}
          >
            <header>
              <h2>{column.title}</h2>
              <span>{grouped[column.id].length}</span>
            </header>
            <div className="kanban-card-list">
              {grouped[column.id].map((card, priority) => {
                const isEditing = editingId === card.id;
                const ownerTag = OWNER_TAGS[card.owner] || "Ambos";

                return (
                  <article
                    className={`kanban-card ${draggingId === card.id ? "is-dragging" : ""}`}
                    draggable={!isEditing}
                    key={card.id}
                    onDragEnd={() => setDraggingId("")}
                    onDragStart={() => setDraggingId(card.id)}
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
                      </div>
                    ) : (
                      <div>
                        <div className="kanban-card-topline">
                          <span className="kanban-card-group">{card.group}</span>
                          <span className={`kanban-owner-tag owner-${ownerTag.toLowerCase()}`}>{ownerTag}</span>
                        </div>
                        <h3>{card.title}</h3>
                      </div>
                    )}

                    <div className="kanban-card-moves">
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
                          <button aria-label="Subir prioridade" disabled={priority === 0} onClick={() => movePriority(card, -1)} type="button">
                            <ArrowUp size={15} />
                          </button>
                          <button aria-label="Descer prioridade" disabled={priority === grouped[column.id].length - 1} onClick={() => movePriority(card, 1)} type="button">
                            <ArrowDown size={15} />
                          </button>
                          <button aria-label="Mover para coluna anterior" disabled={column.id === "todo"} onClick={() => moveByStep(card, -1)} type="button">
                            <ArrowLeft size={15} />
                          </button>
                          <button aria-label="Mover para proxima coluna" disabled={column.id === "done"} onClick={() => moveByStep(card, 1)} type="button">
                            <ArrowRight size={15} />
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

function normalizeBoard(value) {
  const cards = Array.isArray(value?.cards) ? value.cards : [];
  return {
    imports: typeof value?.imports === "object" && value.imports ? value.imports : {},
    cards: cards
      .map((card) => ({
        id: String(card?.id || crypto.randomUUID()),
        title: String(card?.title || "").trim(),
        group: String(card?.group || "Geral").trim(),
        owner: OWNERS.includes(card?.owner) ? card.owner : "Ambos",
        column: COLUMNS.some((column) => column.id === card?.column) ? card.column : "todo",
        createdBy: String(card?.createdBy || "Familia"),
        createdAt: String(card?.createdAt || new Date().toISOString())
      }))
      .filter((card) => card.title)
  };
}
