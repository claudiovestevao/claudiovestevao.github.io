"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Baby,
  CalendarDays,
  Car,
  CloudSun,
  HeartHandshake,
  Loader2,
  Search,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";

export default function DestinationExplorer({ initialResult }) {
  const [query, setQuery] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [type, setType] = useState("");
  const [curationLevel, setCurationLevel] = useState("");
  const [result, setResult] = useState(initialResult);
  const [isPending, startTransition] = useTransition();

  const destinations = result?.destinations || [];
  const facets = result?.facets || { states: [], types: [], curationLevels: [] };
  const visiblePins = useMemo(() => destinations.slice(0, 12), [destinations]);

  function submit(event) {
    event.preventDefault();
    const params = new URLSearchParams({
      q: query,
      state: stateCode,
      type,
      curationLevel,
      limit: "32"
    });
    startTransition(async () => {
      const response = await fetch(`/api/destinations?${params.toString()}`, {
        headers: { accept: "application/json" }
      });
      setResult(await response.json());
    });
  }

  return (
    <section className="surface overflow-hidden" aria-label="Explorador de destinos familiares">
      <form className="filter-strip" onSubmit={submit}>
        <label className="form-label m-0">
          <span className="small fw-bold text-primary d-flex align-items-center gap-1 mb-1">
            <Search size={14} /> Buscar
          </span>
          <input
            className="form-control"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex: praia, serra, Atibaia"
          />
        </label>
        <SelectField label="UF" value={stateCode} onChange={setStateCode} options={facets.states} />
        <SelectField label="Perfil" value={type} onChange={setType} options={facets.types} />
        <label className="form-label m-0">
          <span className="small fw-bold text-primary d-flex align-items-center gap-1 mb-1">
            <SlidersHorizontal size={14} /> Curadoria
          </span>
          <select className="form-select" value={curationLevel} onChange={(event) => setCurationLevel(event.target.value)}>
            <option value="">Todos</option>
            <option value="known_family_destination">Conhecidos</option>
            <option value="family_destination_candidate">Candidatos</option>
          </select>
        </label>
        <div className="d-grid d-lg-flex align-items-end">
          <button className="btn btn-primary fw-bold px-4" disabled={isPending}>
            {isPending ? <Loader2 className="me-2" size={16} /> : null}
            Explorar
          </button>
        </div>
      </form>

      <div className="destination-map">
        <div className="map-grid" role="img" aria-label="Mapa exploratório de destinos familiares">
          {visiblePins.map((destination, index) => (
            <button
              className="map-pin"
              key={destination.slug}
              style={pinStyle(destination, visiblePins, index)}
              type="button"
              title={`${destination.name}, ${destination.stateCode}`}
              onClick={() => setQuery(destination.name)}
            >
              <b>{index + 1}</b>
              <span>
                {destination.name}
                <small>{destination.stateCode} · {destination.familyScore}/100</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 p-lg-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <strong>{destinations.length} destinos nesta visão</strong>
            <div className="text-secondary small">
              Fonte: {result?.source} · catálogo conhecido: {Number(result?.totalKnown || 0).toLocaleString("pt-BR")}
            </div>
          </div>
          <span className="badge-soft">Hotel aprovado continua sendo etapa separada</span>
        </div>
        <div>
          {destinations.slice(0, 10).map((destination) => (
            <DestinationRow destination={destination} key={destination.slug} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="form-label m-0">
      <span className="small fw-bold text-primary mb-1 d-block">{label}</span>
      <select className="form-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {(options || []).slice(0, 50).map((option) => (
          <option value={option.value} key={option.value}>
            {option.value} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function DestinationRow({ destination }) {
  const fitSummary = destination.fitSummary;
  return (
    <div className="destination-row">
      <div className="score-pill" title={destination.scoreLabel || "Nota familiar"}>
        <strong>{destination.familyScore}</strong>
        <span>/100</span>
      </div>
      <div className="min-w-0">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <div className="fw-bold">{destination.name}, {destination.stateCode}</div>
          {destination.scoreLabel ? <span className="score-label">{destination.scoreLabel}</span> : null}
        </div>
        <div className="text-secondary small">
          {destination.bestFor || "Destino familiar candidato"}
          {fitSummary?.totalProfiles ? ` · atende ${fitSummary.recommendedProfiles}/${fitSummary.totalProfiles} perfis familiares` : ""}
        </div>
        <ScoreBreakdown scores={destination.categoryScores} />
        <div className="d-flex flex-wrap gap-1 mt-2">
          {(destination.tags || []).slice(0, 4).map((tag) => (
            <span className="badge-soft" key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <a
        className="btn btn-outline-primary btn-sm fw-bold"
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.name} ${destination.stateCode}`)}`}
        target="_blank"
        rel="noreferrer"
      >
        Ver mapa
      </a>
    </div>
  );
}

function ScoreBreakdown({ scores }) {
  const items = [
    { key: "logistics", label: "Logística", icon: Car },
    { key: "structure", label: "Estrutura", icon: Baby },
    { key: "seasonality", label: "Época", icon: CalendarDays },
    { key: "rainyDay", label: "Chuva", icon: CloudSun },
    { key: "safety", label: "Segurança", icon: ShieldCheck },
    { key: "parentComfort", label: "Pais", icon: HeartHandshake }
  ].filter((item) => Number.isFinite(Number(scores?.[item.key])));

  if (!items.length) return null;

  return (
    <div className="score-breakdown" aria-label="Notas por categoria">
      {items.map(({ key, label, icon: Icon }) => (
        <span className="score-chip" key={key} title={`${label}: ${formatScore(scores[key])} de 10`}>
          <Icon size={13} aria-hidden="true" />
          {label} <b>{formatScore(scores[key])}</b>
        </span>
      ))}
    </div>
  );
}

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function pinStyle(destination, destinations, index) {
  const lats = destinations.map((item) => Number(item.latitude)).filter(Number.isFinite);
  const lngs = destinations.map((item) => Number(item.longitude)).filter(Number.isFinite);
  const lat = Number(destination.latitude);
  const lng = Number(destination.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lats.length < 2 || lngs.length < 2) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      left: `${14 + column * 22}%`,
      top: `${24 + row * 24}%`
    };
  }
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.001, maxLat - minLat);
  const lngRange = Math.max(0.001, maxLng - minLng);
  return {
    left: `${10 + ((lng - minLng) / lngRange) * 80}%`,
    top: `${88 - ((lat - minLat) / latRange) * 76}%`
  };
}
