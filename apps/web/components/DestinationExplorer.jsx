"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Baby,
  CalendarDays,
  Car,
  ChevronRight,
  CloudSun,
  HeartHandshake,
  Hotel,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star
} from "lucide-react";

const SAO_PAULO_CENTER = [-23.55052, -46.63331];

export default function DestinationExplorer({ initialResult }) {
  const [query, setQuery] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [type, setType] = useState("");
  const [curationLevel, setCurationLevel] = useState("");
  const [result, setResult] = useState(initialResult);
  const [selectedSlug, setSelectedSlug] = useState(initialResult?.destinations?.[0]?.slug || "");
  const [isPending, startTransition] = useTransition();

  const destinations = result?.destinations || [];
  const facets = result?.facets || { states: [], types: [], curationLevels: [] };
  const selectedDestination = useMemo(
    () => destinations.find((destination) => destination.slug === selectedSlug) || destinations[0],
    [destinations, selectedSlug]
  );
  const mapDestinations = useMemo(
    () => destinations.filter((destination) => Number.isFinite(destination.latitude) && Number.isFinite(destination.longitude)).slice(0, 36),
    [destinations]
  );

  function submit(event) {
    event.preventDefault();
    const params = new URLSearchParams({
      q: query,
      state: stateCode,
      type,
      curationLevel,
      limit: "48"
    });
    startTransition(async () => {
      const response = await fetch(`/api/destinations?${params.toString()}`, {
        headers: { accept: "application/json" }
      });
      const nextResult = await response.json();
      setResult(nextResult);
      setSelectedSlug(nextResult?.destinations?.[0]?.slug || "");
    });
  }

  return (
    <section className="explorer-shell" aria-label="Explorador de destinos familiares">
      <form className="command-bar" onSubmit={submit}>
        <label className="command-search">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar destino, serra, praia, pousada..."
          />
        </label>
        <SelectField label="UF" value={stateCode} onChange={setStateCode} options={facets.states} />
        <SelectField label="Perfil" value={type} onChange={setType} options={facets.types} />
        <label className="ui-select">
          <span><SlidersHorizontal size={14} /> Curadoria</span>
          <select value={curationLevel} onChange={(event) => setCurationLevel(event.target.value)}>
            <option value="">Todos</option>
            <option value="known_family_destination">Validados</option>
            <option value="family_destination_candidate">Candidatos</option>
          </select>
        </label>
        <button className="ui-button primary" disabled={isPending}>
          {isPending ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
          Explorar
        </button>
      </form>

      <div className="explorer-layout">
        <div className="map-stage">
          <DestinationMap
            destinations={mapDestinations}
            selectedSlug={selectedDestination?.slug}
            onSelect={setSelectedSlug}
          />
          <div className="map-status">
            <strong>{destinations.length}</strong>
            <span>destinos filtrados</span>
          </div>
        </div>

        <aside className="side-panel" aria-label="Resumo do destino selecionado">
          {selectedDestination ? <DestinationSummary destination={selectedDestination} /> : <EmptyState />}
        </aside>
      </div>

      <div className="results-strip" aria-label="Destinos em destaque">
        {destinations.slice(0, 8).map((destination) => (
          <button
            className={`destination-card ${destination.slug === selectedDestination?.slug ? "is-active" : ""}`}
            key={destination.slug}
            type="button"
            onClick={() => setSelectedSlug(destination.slug)}
          >
            <span className="score-dot">{destination.familyScore}</span>
            <span>
              <b>{destination.name}</b>
              <small>{destination.stateCode} · {shortScoreLabel(destination.scoreLabel)}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DestinationMap({ destinations, selectedSlug, onSelect }) {
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const elementRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function setupMap() {
      if (!elementRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !elementRef.current) return;

      const map = L.map(elementRef.current, {
        zoomControl: false,
        scrollWheelZoom: true
      }).setView(SAO_PAULO_CENTER, 7);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setIsMapReady(true);
    }

    setupMap();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function renderPins() {
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!isMapReady || !map || !layer) return;
      const L = await import("leaflet");
      if (cancelled) return;

      layer.clearLayers();
      const points = destinations
        .map((destination) => ({
          destination,
          lat: Number(destination.latitude),
          lng: Number(destination.longitude)
        }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

      for (const point of points) {
        const isSelected = point.destination.slug === selectedSlug;
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "",
            html: `<button class="leaflet-family-pin ${isSelected ? "is-selected" : ""}" type="button"><span>${Math.round(point.destination.familyScore || 0)}</span><b>${escapeHtml(point.destination.name)}</b></button>`,
            iconSize: [118, 36],
            iconAnchor: [58, 18]
          })
        });
        marker.on("click", () => onSelect(point.destination.slug));
        marker.addTo(layer);
      }

      if (points.length > 1) {
        map.fitBounds(points.map((point) => [point.lat, point.lng]), { padding: [34, 34], maxZoom: 9 });
      } else if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 10);
      } else {
        map.setView(SAO_PAULO_CENTER, 7);
      }
    }

    renderPins();
    return () => {
      cancelled = true;
    };
  }, [destinations, selectedSlug, onSelect, isMapReady]);

  return <div className="real-map" ref={elementRef} aria-label="Mapa real com destinos familiares curados" />;
}

function DestinationSummary({ destination }) {
  const bookingUrl = `https://www.booking.com/searchresults.pt-br.html?ss=${encodeURIComponent(`${destination.name}, ${destination.stateCode}`)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.name} ${destination.stateCode}`)}`;

  return (
    <div className="summary-card">
      <div className="summary-top">
        <div>
          <span className="ui-badge">Destino selecionado</span>
          <h2>{destination.name}</h2>
          <p>{destination.stateCode} · {destination.country}</p>
        </div>
        <div className="score-ring">
          <strong>{destination.familyScore}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="summary-section">
        <BadgeLine icon={Star} label={destination.scoreLabel || "Curadoria familiar"} />
        <p className="summary-copy">{destination.bestFor || "Boa opção para famílias quando a hospedagem e o deslocamento combinam com a idade das crianças."}</p>
      </div>

      <ScoreBreakdown scores={destination.categoryScores} />
      <StayOptions options={destination.stayOptions} />

      <div className="attention-list">
        {(destination.attentionPoints || []).slice(0, 3).map((point) => (
          <span key={point}>{point}</span>
        ))}
      </div>

      <div className="summary-actions">
        <a className="ui-button primary" href={bookingUrl} target="_blank" rel="noreferrer">
          <Hotel size={16} />
          Ver hotéis
        </a>
        <a className="ui-button ghost" href={mapsUrl} target="_blank" rel="noreferrer">
          <MapPin size={16} />
          Ver no mapa
        </a>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="ui-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {(options || []).slice(0, 60).map((option) => (
          <option value={option.value} key={option.value}>
            {option.value} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function StayOptions({ options }) {
  const visibleOptions = (options || []).slice(0, 5);
  if (!visibleOptions.length) return null;
  return (
    <div className="stay-options compact" aria-label="Tipos de hospedagem indicados">
      {visibleOptions.map((option) => (
        <b key={`${option.key}-${option.label}`}>{option.label}</b>
      ))}
    </div>
  );
}

function ScoreBreakdown({ scores }) {
  const items = [
    { key: "logistics", label: "Logística", icon: Car },
    { key: "structure", label: "Estrutura", icon: Baby },
    { key: "seasonality", label: "Época", icon: CalendarDays },
    { key: "rainyDay", label: "Chuva", icon: CloudSun },
    { key: "safety", label: "Saúde", icon: ShieldCheck },
    { key: "parentComfort", label: "Conforto", icon: HeartHandshake }
  ].filter((item) => Number.isFinite(Number(scores?.[item.key])));

  if (!items.length) return null;

  return (
    <div className="score-grid" aria-label="Notas por categoria">
      {items.map(({ key, label, icon: Icon }) => (
        <div className="score-tile" key={key} title={`${label}: ${formatScore(scores[key])} de 10`}>
          <Icon size={15} aria-hidden="true" />
          <span>{label}</span>
          <b>{formatScore(scores[key])}</b>
        </div>
      ))}
    </div>
  );
}

function BadgeLine({ icon: Icon, label }) {
  return (
    <div className="badge-line">
      <Icon size={15} />
      <span>{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="summary-card">
      <h2>Nenhum destino encontrado</h2>
      <p className="summary-copy">Ajuste os filtros para descobrir destinos familiares curados.</p>
    </div>
  );
}

function shortScoreLabel(label = "") {
  if (label.includes("Ouro")) return "Ouro";
  if (label.includes("Prata")) return "Prata";
  if (label.includes("Bronze")) return "Bronze";
  return "Em curadoria";
}

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
