"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Baby,
  CalendarDays,
  Car,
  ChevronRight,
  CloudSun,
  Compass,
  HeartHandshake,
  Hotel,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
  Wallet
} from "lucide-react";
import { calculateFamilyFitScore } from "../../../agentes/concierge-da-familia/src/data/familyHassleCuration.js";
import { TRIP_MOMENT_OPTIONS } from "../lib/destinations/moments.js";

const SAO_PAULO_CENTER = [-23.55052, -46.63331];

export default function DestinationExplorer({ initialResult }) {
  const [mode, setMode] = useState("explore");
  const [query, setQuery] = useState("");
  const [tripMoment, setTripMoment] = useState("");
  const [curationLevel, setCurationLevel] = useState("");
  const [result, setResult] = useState(initialResult);
  const [selectedSlug, setSelectedSlug] = useState(initialResult?.destinations?.[0]?.slug || "");
  const [isPending, startTransition] = useTransition();

  const destinations = result?.destinations || [];
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
      moment: tripMoment,
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
      <div className="mode-header" aria-label="Escolha como descobrir destinos">
        <ModeButton
          active={mode === "explore"}
          description="Quero navegar livremente pelos destinos."
          icon={Compass}
          label="Explorar no mapa"
          onClick={() => setMode("explore")}
        />
        <ModeButton
          active={mode === "assistant"}
          description="Quero 3 sugestões rápidas para minha família."
          icon={MessageCircle}
          label="Assistente"
          onClick={() => setMode("assistant")}
        />
      </div>

      {mode === "explore" ? (
        <>
          <form className="command-bar" onSubmit={submit}>
            <div className="origin-pill" aria-label="Origem da viagem">
              <MapPin size={16} aria-hidden="true" />
              <span>
                <small>Origem</small>
                <b>São Paulo-SP</b>
              </span>
            </div>
            <label className="command-search">
              <Search size={18} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar destino, serra, praia, pousada..."
              />
            </label>
            <label className="ui-select">
              <span><CalendarDays size={14} /> Momento</span>
              <select value={tripMoment} onChange={(event) => setTripMoment(event.target.value)}>
                {TRIP_MOMENT_OPTIONS.map((option) => (
                  <option key={option.value || "any"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-select">
              <span><SlidersHorizontal size={14} /> Curadoria</span>
              <select value={curationLevel} onChange={(event) => setCurationLevel(event.target.value)}>
                <option value="">Todos</option>
                <option value="ouro">Ouro</option>
                <option value="prata">Prata</option>
                <option value="bronze">Bronze</option>
                <option value="family_destination_candidate">Candidatos</option>
              </select>
            </label>
            <button className="ui-button primary" disabled={isPending}>
              {isPending ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
              Explorar
            </button>
          </form>

          <MapExperience
            destinations={destinations}
            mapDestinations={mapDestinations}
            selectedDestination={selectedDestination}
            setSelectedSlug={setSelectedSlug}
          />
        </>
      ) : (
        <AssistantExperience
          destinations={destinations}
          onSelectDestination={(slug) => {
            setSelectedSlug(slug);
            setMode("explore");
          }}
        />
      )}
    </section>
  );
}

function ModeButton({ active, description, icon: Icon, label, onClick }) {
  return (
    <button className={`mode-card ${active ? "is-active" : ""}`} type="button" onClick={onClick}>
      <Icon size={20} />
      <span>
        <b>{label}</b>
        <small>{description}</small>
      </span>
    </button>
  );
}

function MapExperience({ destinations, mapDestinations, selectedDestination, setSelectedSlug }) {
  return (
    <>
      <div className="explorer-layout">
        <div className="map-stage">
          <DestinationMap
            destinations={mapDestinations}
            selectedSlug={selectedDestination?.slug}
            onSelect={setSelectedSlug}
          />
          <div className="map-origin-badge">
            <MapPin size={15} />
            Saindo de São Paulo-SP
          </div>
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
              <small>{destination.stateCode} · {shortScoreLabel(destination.scoreLabel)} · {hassleLabel(destination.familyHassleLevel)}</small>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function AssistantExperience({ destinations, onSelectDestination }) {
  const [childrenProfile, setChildrenProfile] = useState("mixed");
  const [travelEffort, setTravelEffort] = useState("medium");
  const [tripStyle, setTripStyle] = useState("resort");
  const [tripPace, setTripPace] = useState("rest");
  const [budget, setBudget] = useState("comfort");

  const recommendations = useMemo(() => {
    return destinations
      .map((destination) => ({
        destination,
        assistantScore: assistantScore(destination, { childrenProfile, travelEffort, tripStyle, tripPace, budget })
      }))
      .sort((a, b) => b.assistantScore - a.assistantScore || b.destination.familyScore - a.destination.familyScore)
      .slice(0, 3);
  }, [destinations, childrenProfile, travelEffort, tripStyle, tripPace, budget]);

  return (
    <div className="assistant-layout">
      <div className="assistant-panel">
        <span className="ui-badge"><MessageCircle size={14} /> Assistente da Família</span>
        <h2>Me diga o básico. Eu corto o excesso.</h2>
        <p>Responda escolhas simples e veja destinos mais coerentes agora.</p>

        <QuickChoice
          icon={Users}
          label="Quem vai?"
          value={childrenProfile}
          onChange={setChildrenProfile}
          options={[
            { value: "baby", label: "Bebê no grupo" },
            { value: "mixed", label: "Crianças pequenas" },
            { value: "older", label: "Crianças maiores" }
          ]}
        />
        <QuickChoice
          icon={Car}
          label="Deslocamento"
          value={travelEffort}
          onChange={setTravelEffort}
          options={[
            { value: "short", label: "Quero fácil" },
            { value: "medium", label: "Até 4h ok" },
            { value: "flight", label: "Pode ter voo" }
          ]}
        />
        <QuickChoice
          icon={Compass}
          label="Clima da viagem"
          value={tripStyle}
          onChange={setTripStyle}
          options={[
            { value: "resort", label: "Resort sem pensar" },
            { value: "beach", label: "Praia e piscina" },
            { value: "mountain", label: "Serra/natureza" }
          ]}
        />
        <QuickChoice
          icon={HeartHandshake}
          label="Ritmo"
          value={tripPace}
          onChange={setTripPace}
          options={[
            { value: "rest", label: "Descansar" },
            { value: "play", label: "Crianca gastar energia" },
            { value: "explore", label: "Passear e comer bem" }
          ]}
        />
        <QuickChoice
          icon={Wallet}
          label="Estilo"
          value={budget}
          onChange={setBudget}
          options={[
            { value: "smart", label: "Custo esperto" },
            { value: "comfort", label: "Conforto" },
            { value: "premium", label: "Premium" }
          ]}
        />
      </div>

      <div className="assistant-results">
        <div className="assistant-results-head">
          <div>
            <span className="ui-badge">Top 3</span>
            <h3>Eu começaria por aqui</h3>
          </div>
          <small>Abra qualquer sugestão no mapa para comparar hotéis e localização.</small>
        </div>

        {recommendations.map(({ destination }, index) => (
          <button
            className="assistant-recommendation"
            key={destination.slug}
            type="button"
            onClick={() => onSelectDestination(destination.slug)}
          >
            <span className="rank">{index + 1}</span>
            <span className="recommendation-copy">
              <b>{destination.name}, {destination.stateCode}</b>
              <small>{recommendationReason(destination, { childrenProfile, travelEffort, tripStyle, tripPace, budget })}</small>
            </span>
            <FamilyHassleBadge destination={destination} compact />
            <span className="recommendation-score">{destination.familyScore}</span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickChoice({ icon: Icon, label, value, onChange, options }) {
  return (
    <fieldset className="quick-choice">
      <legend><Icon size={15} /> {label}</legend>
      <div>
        {options.map((option) => (
          <button
            className={value === option.value ? "is-selected" : ""}
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
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
        <div className="summary-badges">
          <BadgeLine icon={Star} label={destination.scoreLabel || "Curadoria familiar"} />
          <FamilyHassleBadge destination={destination} />
        </div>
        <p className="summary-copy">{destination.honestSummary || destination.bestFor || "Boa opção para famílias quando a hospedagem e o deslocamento combinam com a idade das crianças."}</p>
      </div>

      <ScoreBreakdown scores={destination.categoryScores} />
      <FamilyHasslePanel destination={destination} />
      <SemPerrengueStrategy destination={destination} />
      <StayOptions options={destination.stayOptions} />
      <GoogleLivePanel destination={destination} />

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

function FamilyHassleBadge({ destination, compact = false }) {
  const level = destination.familyHassleLevel || "moderado";
  return (
    <span className={`hassle-badge hassle-${level} ${compact ? "is-compact" : ""}`}>
      Perrengue: {hassleLabel(level)}
      {!compact && Number.isFinite(Number(destination.bestMinimumAge)) ? ` · ${destination.bestMinimumAge}+` : ""}
    </span>
  );
}

function FamilyHasslePanel({ destination }) {
  const hassles = (destination.mainHassles || []).slice(0, 4);
  const tips = (destination.hassleMitigationTips || []).slice(0, 4);
  if (!hassles.length && !tips.length) return null;
  return (
    <div className="hassle-panel">
      <div>
        <h3>O que pode dar perrengue</h3>
        <ul>
          {hassles.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div>
        <h3>Como reduzir a dor de cabeca</h3>
        <ul>
          {tips.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}

function SemPerrengueStrategy({ destination }) {
  if (!destination.semPerrengueStrategy && !destination.shortHassleAlert) return null;
  return (
    <div className="sem-perrengue-card">
      <b>Roteiro Sem Perrengue</b>
      <p>{destination.semPerrengueStrategy || destination.shortHassleAlert}</p>
      <span>
        Ritmo {destination.recommendedTripPace || "leve"} · max. {destination.maxActivitiesPerDayWithKids || 1} atividade principal/dia
      </span>
    </div>
  );
}

function GoogleLivePanel({ destination }) {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: "" });
    fetch(`/api/google/destination?slug=${encodeURIComponent(destination.slug)}`, {
      headers: { accept: "application/json" }
    })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setState(data.ok ? { status: "ready", data, error: "" } : { status: "error", data: null, error: data.message || "Google indisponível" });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", data: null, error: error.message || "Google indisponível" });
      });
    return () => {
      cancelled = true;
    };
  }, [destination.slug]);

  if (state.status === "loading") {
    return (
      <div className="google-live-card is-loading">
        <Loader2 className="spin" size={15} />
        Atualizando dados Google ao vivo...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="google-live-card is-error">
        <ShieldCheck size={15} />
        Dados Google ao vivo indisponíveis agora.
      </div>
    );
  }

  const place = state.data?.place;
  const route = state.data?.route;
  if (!place) return null;

  return (
    <div className="google-live-card">
      <div className="google-live-head">
        <span className="ui-badge">Google ao vivo</span>
        <small>{place.name}</small>
      </div>
      <div className="google-live-facts">
        <span><Star size={13} /> {place.rating || "-"} · {formatCompact(place.userRatingCount)} avaliações</span>
        <span><Car size={13} /> {route?.status === "OK" ? `${route.distanceKm} km · ${route.driveText}` : "rota em validação"}</span>
      </div>
      {place.photos?.length ? (
        <div className="google-photo-grid">
          {place.photos.filter((photo) => photo.photoUri).slice(0, 3).map((photo, index) => (
            <img src={photo.photoUri} alt={`${photo.sourceName || place.name} no Google ${index + 1}`} key={`${photo.photoUri}-${index}`} loading="lazy" />
          ))}
        </div>
      ) : null}
      {place.reviews?.length ? (
        <div className="google-review-list">
          {place.reviews.slice(0, 3).map((review, index) => (
            <a href={review.googleMapsUri || review.authorUri || place.googleMapsUri} target="_blank" rel="noreferrer" key={`${review.authorName}-${index}`}>
              <b>{review.rating || "-"}★ {review.authorName || "Avaliação Google"}{review.sourceName ? ` · ${review.sourceName}` : ""}</b>
              <span>{review.text}</span>
            </a>
          ))}
        </div>
      ) : null}
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
    { key: "hassle", label: "Sem perrengue", icon: ShieldCheck },
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

function assistantScore(destination, preferences) {
  let score = calculateFamilyFitScore(destination.familyScore, destination, {
    youngestChildAge: preferences.childrenProfile === "baby" ? 1 : preferences.childrenProfile === "mixed" ? 4 : 8,
    travelEffort: preferences.travelEffort,
    budget: preferences.budget,
    restFirst: preferences.childrenProfile === "baby"
  });
  const text = [
    destination.name,
    destination.macroRegion,
    destination.destinationType,
    destination.bestFor,
    destination.honestSummary,
    destination.shortHassleAlert,
    ...(destination.tags || []),
    ...(destination.travelModes || []),
    ...(destination.stayOptions || []).map((option) => option.label)
  ].join(" ");
  const normalizedText = normalizeAssistantText(text);

  if (preferences.childrenProfile === "baby") {
    score += Number(destination.categoryScores?.structure || 0) * 1.8;
    if (hasAny(normalizedText, ["resort", "hotel fazenda", "pousada", "chale"])) score += 4;
    if (destination.avoidWithBaby) score -= 18;
  }
  if (preferences.childrenProfile === "mixed" && destination.avoidWithToddler) score -= 12;
  if (preferences.childrenProfile === "older" && hasAny(normalizedText, ["parque", "aventura", "praia", "trilha", "aquatico"])) score += 5;

  if (preferences.tripStyle === "resort") {
    if (hasAny(normalizedText, ["resort", "all inclusive", "hotel fazenda", "termas", "aguas quentes"])) score += 13;
    if (hasAny(normalizedText, ["cidade historica", "urbano", "gastronomia"]) && !hasAny(normalizedText, ["resort", "hotel"])) score -= 5;
  }
  if (preferences.tripStyle === "beach") {
    if (hasAny(normalizedText, ["praia", "litoral", "beach", "mar", "maceio", "maragogi", "japaratinga", "milagres", "galinhas", "forte", "natal", "guaruja"])) score += 15;
    if (!hasAny(normalizedText, ["praia", "litoral", "beach", "mar"]) && destination.stateCode === "SP") score -= 10;
  }
  if (preferences.tripStyle === "mountain") {
    if (hasAny(normalizedText, ["serra", "montanha", "campo", "frio", "chale", "natureza", "cunha", "goncalves", "gramado", "campos", "urubici"])) score += 14;
    if (hasAny(normalizedText, ["praia", "litoral", "beach"])) score -= 8;
  }

  if (preferences.tripPace === "rest") {
    if (["baixo", "moderado"].includes(destination.familyHassleLevel)) score += 5;
    if (hasAny(normalizedText, ["resort", "pousada", "chale", "all inclusive", "descanso"])) score += 5;
    if (["alto", "muito_alto"].includes(destination.familyHassleLevel)) score -= 10;
  }
  if (preferences.tripPace === "play") {
    if (hasAny(normalizedText, ["parque", "kids", "crianca", "monitoria", "aquatico", "termas", "hot park", "beto", "olimpia", "rio quente"])) score += 12;
  }
  if (preferences.tripPace === "explore") {
    if (hasAny(normalizedText, ["gastronomia", "cultura", "cidade", "centro", "historico", "passeio", "charme"])) score += 10;
    if (hasAny(normalizedText, ["all inclusive"]) && !hasAny(normalizedText, ["cidade", "gastronomia"])) score -= 4;
  }

  if (preferences.travelEffort === "short" && destination.stateCode === "SP") score += 3;
  if (preferences.travelEffort === "short" && ["alto", "muito_alto"].includes(destination.familyHassleLevel)) score -= 10;
  if (preferences.travelEffort === "flight" && destination.stateCode !== "SP") score += preferences.tripStyle === "beach" ? 9 : 5;
  if (preferences.budget === "smart" && hasAny(normalizedText, ["pousada", "apart", "casa", "chale"])) score += 5;
  if (preferences.budget === "smart" && ["alto", "muito_alto"].includes(destination.familyHassleLevel)) score -= 5;
  if (preferences.budget === "premium" && hasAny(normalizedText, ["resort", "premium", "all inclusive", "spa"])) score += 6;
  return score;
}

function recommendationReason(destination, preferences) {
  if (preferences.childrenProfile === "baby" && destination.avoidWithBaby) {
    return "Destino bonito, mas eu so consideraria com bebe em versao muito leve.";
  }
  if (["alto", "muito_alto"].includes(destination.familyHassleLevel)) {
    return destination.shortHassleAlert || "Pode encantar, mas pede estrategia clara para nao cansar a familia.";
  }
  if (preferences.tripStyle === "beach") {
    return destination.bestFor || "Entrou porque combina melhor com praia, piscina e rotina leve.";
  }
  if (preferences.tripStyle === "mountain") {
    return destination.bestFor || "Combina com serra, natureza e um ritmo menos urbano.";
  }
  if (preferences.tripPace === "play") {
    return destination.bestFor || "Boa para criança gastar energia sem depender de roteiro complicado.";
  }
  if (preferences.travelEffort === "short" && destination.stateCode === "SP") {
    return "Boa primeira triagem quando a prioridade é reduzir deslocamento.";
  }
  if (preferences.childrenProfile === "baby") {
    return "Combina melhor quando rotina, estrutura e pausas importam mais que roteiro cheio.";
  }
  if (preferences.budget === "smart") {
    return "Vale comparar estadias alternativas antes de fechar hotel.";
  }
  return destination.bestFor || "Bom equilíbrio entre estrutura familiar e logística.";
}

function normalizeAssistantText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function shortScoreLabel(label = "") {
  if (label.includes("Ouro")) return "Ouro";
  if (label.includes("Prata")) return "Prata";
  if (label.includes("Bronze")) return "Bronze";
  return "Em curadoria";
}

function hassleLabel(level = "") {
  const labels = {
    baixo: "Baixo",
    moderado: "Moderado",
    alto: "Alto",
    muito_alto: "Muito alto"
  };
  return labels[level] || "Moderado";
}

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function formatCompact(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric >= 1000 ? `${(numeric / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : numeric.toLocaleString("pt-BR");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
