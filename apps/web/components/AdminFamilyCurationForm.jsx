"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Camera, CheckCircle2, Hotel, Loader2, Lock, Search, Send, ShieldCheck } from "lucide-react";

const choiceGroups = [
  {
    title: "Sono e rotina",
    questions: [
      ["cribReality", "Berco/cama extra", ["ja estava pronto e era bom", "bom, mas precisei pedir", "improvisado/ruim", "nao usei/nao sei"]],
      ["blackoutNoise", "Sono no quarto", ["otimo para soneca", "ok com ajustes", "barulhento/claro", "ruim para rotina"]],
      ["roomLayout", "Layout com crianca", ["funcionou muito bem", "funcionou razoavel", "apertado/confuso", "nao recomendo"]],
      ["napFriendly", "Soneca no meio do dia", ["facil de respeitar", "possivel com planejamento", "dificil", "quase impossivel"]]
    ]
  },
  {
    title: "Comida e sobrevivencia",
    questions: [
      ["babyFoodSupport", "Papinha/mamadeira", ["estrutura excelente", "quebra galho", "tem que se virar", "nao serve para bebe"]],
      ["restaurantWithKids", "Restaurante com crianca", ["tranquilo", "ok fora do pico", "espera/estresse", "ruim com crianca"]],
      ["kidsMenuQuality", "Menu infantil", ["bom de verdade", "basico aceitavel", "fraco", "nao percebi"]],
      ["earlyFood", "Horarios de comida", ["compatíveis com crianca", "precisa ajustar", "jantar tarde/dificil", "sem apoio"]]
    ]
  },
  {
    title: "Lazer, piscina e chuva",
    questions: [
      ["poolSafety", "Piscina infantil", ["segura e boa", "boa com supervisao", "fria/funda/pouca sombra", "nao adequada"]],
      ["kidsClubTruth", "Kids club/monitoria", ["excelente", "bom para algumas idades", "limitado", "nao tinha/nao confiaria"]],
      ["rainPlan", "Se chover", ["salva a viagem", "tem plano B parcial", "fica limitado", "estraga bastante"]],
      ["beachOrNatureAccess", "Praia/natureza com crianca", ["muito facil", "ok com cuidado", "puxado", "nao indicado"]]
    ]
  },
  {
    title: "Logistica invisivel",
    questions: [
      ["strollerReality", "Carrinho de bebe", ["circula bem", "da para usar com trechos ruins", "melhor mochila", "impossivel"]],
      ["walkingFatigue", "Distancias internas", ["curtas", "medias", "cansa pais", "muito puxado"]],
      ["arrivalCheckin", "Chegada/check-in", ["suave", "ok", "demorado", "perrengue"]],
      ["medicalComfort", "Farmacia/hospital/sinal", ["me senti seguro", "ok", "me preocupou", "nao sei"]]
    ]
  },
  {
    title: "Veredito",
    questions: [
      ["bestAge", "Melhor idade", ["0+ bebe", "2+ toddler", "4+ crianca pequena", "6+ caminha bem", "8+ aventura"]],
      ["avoidAge", "Eu evitaria para", ["nao evitaria", "bebe de colo", "2-3 anos", "crianca agitada", "familia que quer descanso"]],
      ["familyProfileFit", "Combina mais com", ["descanso", "resort/praticidade", "natureza leve", "aventura", "gastronomia/cidade"]],
      ["wouldRecommend", "Indicaria para amigos?", ["sim, sem medo", "sim, com ressalvas", "so para perfil especifico", "nao indicaria"]]
    ]
  }
];

const scoreFields = [
  ["sleepScore", "Sono"],
  ["foodScore", "Comida"],
  ["babyScore", "Bebe 0-2"],
  ["toddlerScore", "3-5 anos"],
  ["kidsScore", "6-10 anos"],
  ["strollerScore", "Carrinho"],
  ["rainScore", "Chuva"],
  ["parentRestScore", "Descanso dos pais"],
  ["overallFamilyScore", "Geral"]
];

const textFields = [
  ["worstPerrengue", "Maior perrengue real", "O que quase estragou, cansou demais ou voce avisaria outro pai/mae?"],
  ["magicMoment", "Momento que fez valer a pena", "Qual detalhe encantou a familia ou as criancas?"],
  ["semPerrengueTip", "Estrategia sem perrengue", "Se eu fosse seu amigo, qual seria o jeito certo de fazer essa viagem?"],
  ["bookingQuestion", "Pergunta obrigatoria antes de reservar", "A pergunta que voce faria ao hotel para evitar dor de cabeca."]
];

export default function AdminFamilyCurationForm() {
  const [password, setPassword] = useState("");
  const [catalog, setCatalog] = useState(null);
  const [loginStatus, setLoginStatus] = useState({ type: "idle", message: "" });
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [query, setQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [hotelOptions, setHotelOptions] = useState({ status: "idle", items: [], warning: "" });
  const [isPending, startTransition] = useTransition();

  const destinations = useMemo(() => sortDestinations(catalog?.destinations || []), [catalog?.destinations]);
  const hotels = useMemo(() => sortHotels(catalog?.hotels || []), [catalog?.hotels]);
  const destinationById = useMemo(() => new Map(destinations.map((destination) => [destination.id, destination])), [destinations]);
  const selectedDestination = destinations.find((destination) => destination.id === destinationId) || destinations[0] || null;
  const destinationHotels = useMemo(() => {
    if (!selectedDestination) return [];
    return hotels
      .filter((hotel) => hotel.destinationId === selectedDestination.id || normalize(hotel.city) === normalize(selectedDestination.name))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  }, [hotels, selectedDestination]);
  const activeHotelOptions = hotelOptions.items.length ? hotelOptions.items : destinationHotels;
  const selectedHotel = activeHotelOptions.find((hotel) => hotel.id === hotelId) || null;
  const filteredHotels = useMemo(() => {
    const needle = normalize(query);
    return hotels
      .filter((hotel) => {
        const destination = destinationById.get(hotel.destinationId);
        return !needle || normalize(`${hotel.name} ${hotel.city} ${hotel.address} ${destination?.name || ""} ${destination?.state || ""}`).includes(needle);
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"))
      .slice(0, 160);
  }, [hotels, destinationById, query]);
  const filteredDestinations = useMemo(() => {
    const needle = normalize(destinationQuery || query);
    const matchingHotelDestinationIds = new Set(filteredHotels.map((hotel) => hotel.destinationId).filter(Boolean));
    return destinations
      .filter((destination) =>
        !needle ||
        matchingHotelDestinationIds.has(destination.id) ||
        normalize(`${destination.name} ${destination.state} ${destination.summary}`).includes(needle)
      );
  }, [destinations, filteredHotels, query, destinationQuery]);
  const hotelListItems = query && filteredHotels.length ? mergeHotels(activeHotelOptions, filteredHotels) : activeHotelOptions;

  useEffect(() => {
    if (!catalog || !selectedDestination?.id || !password) return;
    let cancelled = false;
    setHotelOptions({ status: "loading", items: destinationHotels, warning: "" });
    fetch(`/api/admin/family-curation/hotels?destinationId=${encodeURIComponent(selectedDestination.id)}`, {
      headers: { "x-admin-password": password, accept: "application/json" }
    })
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) {
          setHotelOptions({ status: "error", items: destinationHotels, warning: json.message || "Nao consegui carregar hoteis." });
          return;
        }
        setHotelOptions({
          status: "ready",
          items: json.hotels || [],
          warning: (json.warnings || []).join(" ")
        });
      })
      .catch((error) => {
        if (!cancelled) setHotelOptions({ status: "error", items: destinationHotels, warning: error.message || "Nao consegui carregar hoteis." });
      });
    return () => {
      cancelled = true;
    };
  }, [catalog, selectedDestination?.id, password]);

  useEffect(() => {
    if ((!query && !destinationQuery) || !filteredDestinations.length) return;
    const currentStillVisible = filteredDestinations.some((destination) => destination.id === destinationId);
    if (!currentStillVisible) {
      setDestinationId(filteredDestinations[0].id);
      setHotelId("");
    }
  }, [query, destinationQuery, filteredDestinations, destinationId]);

  function unlock(event) {
    event.preventDefault();
    setLoginStatus({ type: "idle", message: "" });
    startTransition(async () => {
      const response = await fetch("/api/admin/family-curation", {
        headers: { "x-admin-password": password, accept: "application/json" }
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) {
        setLoginStatus({ type: "error", message: json.message || "Nao consegui abrir o admin." });
        return;
      }
      const orderedDestinations = sortDestinations(json.destinations || []);
      setCatalog({ ...json, destinations: orderedDestinations, hotels: sortHotels(json.hotels || []) });
      setDestinationId(orderedDestinations?.[0]?.id || "");
      setDestinationQuery("");
      setHotelId("");
      setHotelOptions({ status: "idle", items: [], warning: "" });
      setLoginStatus({ type: "success", message: `${json.destinations?.length || 0} destinos e ${json.hotels?.length || 0} hoteis carregados.` });
    });
  }

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("password", password);
    data.set("destinationId", selectedDestination?.id || "");
    data.set("destinationSlug", selectedDestination?.slug || "");
    data.set("destinationName", selectedDestination?.name || "");
    data.set("propertyId", selectedHotel?.id || "");
    data.set("propertyName", selectedHotel?.name || data.get("manualPropertyName") || "");
    data.set("knownDestinationContext", JSON.stringify(selectedDestination || {}));
    data.set("knownHotelContext", JSON.stringify(selectedHotel || {}));
    setStatus({ type: "idle", message: "" });

    startTransition(async () => {
      const response = await fetch("/api/admin/family-curation", { method: "POST", body: data });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) {
        setStatus({ type: "error", message: json.message || "Nao consegui salvar a curadoria." });
        return;
      }
      form.reset();
      setStatus({ type: "success", message: `Salvo. ID ${json.id}. Fotos: ${json.photos}. Pode catalogar o proximo.` });
    });
  }

  if (!catalog) {
    return (
      <form className="admin-login-card" onSubmit={unlock}>
        <div>
          <span className="ui-badge"><Lock size={14} /> Admin</span>
          <h2>Entrar na curadoria</h2>
          <p>Depois da senha, eu carrego destinos e hoteis que ja existem no banco. Voce so completa o que nenhum site sabe.</p>
        </div>
        <label>
          Senha admin
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" inputMode="numeric" autoFocus required placeholder="senha" />
        </label>
        <button className="ui-button primary" disabled={isPending}>
          {isPending ? <Loader2 className="spin" size={16} /> : <Lock size={16} />}
          Abrir formulario
        </button>
        {loginStatus.message ? <StatusMessage status={loginStatus} /> : null}
      </form>
    );
  }

  return (
    <form className="admin-curation-form" onSubmit={submit}>
      <section className="admin-picker-panel">
        <div className="admin-picker-head">
          <div>
            <span className="ui-badge"><Hotel size={14} /> 1 local por vez</span>
            <h2>Escolha destino e hotel</h2>
            <p>{loginStatus.message}</p>
          </div>
          <label className="admin-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar hotel, resort ou pousada" />
          </label>
        </div>

        <div className="admin-picker-grid">
          <label>
            Digitar destino
            <input
              value={destinationQuery}
              onChange={(event) => handleDestinationQuery(event.target.value)}
              list="admin-destination-options"
              placeholder="Ex.: Japaratinga, Atibaia, Gramado..."
            />
            <datalist id="admin-destination-options">
              {destinations.map((destination) => (
                <option value={destinationLabel(destination)} key={destination.id} />
              ))}
            </datalist>
          </label>
          <label>
            Destino
            <select value={selectedDestination?.id || ""} onChange={(event) => selectDestination(event.target.value)}>
              {filteredDestinations.map((destination) => (
                <option value={destination.id} key={destination.id}>{destination.name}, {destination.state}</option>
              ))}
            </select>
          </label>
          <label>
            Hotel/resort/pousada do banco
            <select value={selectedHotel?.id || ""} onChange={(event) => selectHotel(event.target.value)}>
              <option value="">Sem hotel especifico / avaliar destino</option>
              {(query ? filteredHotels : destinationHotels).map((hotel) => (
                <option value={hotel.id} key={hotel.id}>
                  {hotel.name}{hotel.city ? ` · ${hotel.city}` : ""}{destinationById.get(hotel.destinationId)?.state ? `, ${destinationById.get(hotel.destinationId).state}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Outro hotel, se nao estiver na lista
            <input name="manualPropertyName" placeholder="nome do hotel/pousada/resort" />
          </label>
        </div>

        <HotelPickList
          destination={selectedDestination}
          hotels={hotelListItems}
          selectedHotelId={selectedHotel?.id || ""}
          status={hotelOptions.status}
          warning={hotelOptions.warning}
          onSelect={selectHotel}
        />

        <KnownFacts destination={selectedDestination} hotel={selectedHotel} />
      </section>

      <section className="admin-question-section">
        <h3>Contexto da sua visita</h3>
        <div className="admin-question-grid compact">
          <label>Quem responde?<input name="respondentName" placeholder="Claudio, Flavia..." /></label>
          <label>Quando foram?<input name="visitPeriod" placeholder="mes/ano, feriado, ferias..." /></label>
          <label>Quem viajou?<input name="travelParty" placeholder="2 adultos, criancas e idades" /></label>
          <ChoiceField name="visitType" label="Tipo de experiencia" options={["fiquei hospedado", "day use", "visitei para conhecer", "ainda nao fui, mas tenho info confiavel"]} />
        </div>
      </section>

      {choiceGroups.map((group) => (
        <section className="admin-question-section" key={group.title}>
          <h3>{group.title}</h3>
          <div className="admin-choice-grid">
            {group.questions.map(([name, label, options]) => (
              <ChoiceField key={name} name={name} label={label} options={options} />
            ))}
          </div>
        </section>
      ))}

      <section className="admin-question-section">
        <h3>Notas rapidas</h3>
        <div className="admin-score-grid">
          {scoreFields.map(([name, label]) => (
            <label key={name}>
              {label}
              <select name={name} defaultValue="">
                <option value="">sem nota</option>
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score) => <option value={score} key={score}>{score}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="admin-question-section">
        <h3>Texto so onde importa</h3>
        <div className="admin-question-grid">
          {textFields.map(([name, label, placeholder]) => (
            <label key={name}>
              {label}
              <textarea name={name} placeholder={placeholder} rows={3} />
            </label>
          ))}
        </div>
      </section>

      <section className="admin-question-section">
        <h3>Fotos reais</h3>
        <div className="admin-photo-box">
          <Camera size={22} />
          <div>
            <b>Fotos que ajudam mais que foto bonita</b>
            <p>Quarto, berco, banheiro, copa baby, piscina infantil, brinquedoteca, acesso com carrinho, restaurante e perrengues reais.</p>
          </div>
          <input name="photos" type="file" accept="image/*" multiple />
        </div>
        <label className="admin-wide-field">
          Legenda das fotos
          <textarea name="photoNotes" rows={3} placeholder="ex.: foto 1 = berco; foto 2 = escada ruim para carrinho; foto 3 = piscina infantil" />
        </label>
      </section>

      <section className="admin-submit-bar">
        <div><ShieldCheck size={18} /><span>As respostas ficam privadas ate virarem curadoria editorial.</span></div>
        <button className="ui-button primary" disabled={isPending}>
          {isPending ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          Salvar e ir para o proximo
        </button>
      </section>

      {status.message ? <StatusMessage status={status} /> : null}
    </form>
  );

  function selectHotel(nextHotelId) {
    setHotelId(nextHotelId);
    const nextHotel = [...hotels, ...activeHotelOptions, ...filteredHotels].find((hotel) => hotel.id === nextHotelId);
    if (nextHotel?.destinationId) selectDestination(nextHotel.destinationId);
  }

  function selectDestination(nextDestinationId) {
    const nextDestination = destinations.find((destination) => destination.id === nextDestinationId);
    setDestinationId(nextDestinationId);
    setHotelId("");
    if (nextDestination) setDestinationQuery(destinationLabel(nextDestination));
  }

  function handleDestinationQuery(value) {
    setDestinationQuery(value);
    const needle = normalize(value);
    const exact = destinations.find((destination) => {
      return [destinationLabel(destination), destination.name, destination.slug]
        .map(normalize)
        .includes(needle);
    });
    if (exact) {
      setDestinationId(exact.id);
      setHotelId("");
    }
  }
}

function HotelPickList({ destination, hotels, selectedHotelId, status, warning, onSelect }) {
  const visibleHotels = dedupeHotels(hotels).slice(0, 18);
  return (
    <div className="admin-hotel-list">
      <div className="admin-hotel-list-head">
        <b>Hotéis para {destination?.name || "o destino"}</b>
        <span>{status === "loading" ? "carregando..." : `${visibleHotels.length} opcoes`}</span>
      </div>
      {visibleHotels.length ? (
        <div className="admin-hotel-cards">
          <button
            className={`admin-hotel-card ${!selectedHotelId ? "is-selected" : ""}`}
            type="button"
            onClick={() => onSelect("")}
          >
            <b>Avaliar só o destino</b>
            <span>sem hotel especifico</span>
          </button>
          {visibleHotels.map((hotel) => (
            <button
              className={`admin-hotel-card ${hotel.id === selectedHotelId ? "is-selected" : ""}`}
              type="button"
              key={hotel.id}
              onClick={() => onSelect(hotel.id)}
            >
              <b>{hotel.name}</b>
              <span>
                {[hotel.city, hotel.rating ? `nota ${hotel.rating}` : "", hotel.reviewCount ? `${hotel.reviewCount} reviews` : "", sourceLabel(hotel.source)].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="admin-empty-hotels">
          Nenhum hotel cadastrado ainda para este destino. Use o campo "Outro hotel" ou aguarde a busca Google ao vivo.
        </div>
      )}
      {warning ? <small className="admin-hotel-warning">{warning}</small> : null}
    </div>
  );
}

function KnownFacts({ destination, hotel }) {
  return (
    <div className="known-facts">
      <div>
        <b>{destination?.name || "Destino"}</b>
        <span>{[destination?.state, destination?.country].filter(Boolean).join(" · ")}</span>
        <p>{destination?.summary || "Sem resumo editorial no banco ainda."}</p>
      </div>
      <div>
        <b>{hotel?.name || "Sem hotel selecionado"}</b>
        <span>{hotel ? [hotel.stars ? `${hotel.stars} estrelas` : "", hotel.rating ? `nota ${hotel.rating}` : "", hotel.reviewCount ? `${hotel.reviewCount} reviews` : ""].filter(Boolean).join(" · ") : "Voce pode avaliar apenas o destino."}</span>
        <p>{hotel?.description || hotel?.address || "Escolha um hotel da lista ou informe outro manualmente."}</p>
      </div>
    </div>
  );
}

function ChoiceField({ name, label, options }) {
  return (
    <fieldset className="admin-choice-field">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <label key={option}>
            <input name={name} type="radio" value={option} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function StatusMessage({ status }) {
  return (
    <div className={`admin-status ${status.type}`}>
      {status.type === "success" ? <CheckCircle2 size={18} /> : <Lock size={18} />}
      {status.message}
    </div>
  );
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function compactKey(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "");
}

function destinationLabel(destination) {
  return [destination?.name, destination?.state].filter(Boolean).join(", ");
}

function sortDestinations(destinations = []) {
  return [...destinations].sort((a, b) => {
    const byName = String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" });
    if (byName) return byName;
    return String(a.state || "").localeCompare(String(b.state || ""), "pt-BR", { sensitivity: "base" });
  });
}

function sortHotels(hotels = []) {
  return [...hotels].sort((a, b) => {
    const byDestination = String(a.city || "").localeCompare(String(b.city || ""), "pt-BR", { sensitivity: "base" });
    if (byDestination) return byDestination;
    return hotelQualityScore(b) - hotelQualityScore(a) ||
      String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" });
  });
}

function mergeHotels(...groups) {
  return dedupeHotels(groups.flat().filter(Boolean));
}

function dedupeHotels(hotels = []) {
  const unique = [];
  const sorted = [...hotels].sort((a, b) => hotelQualityScore(b) - hotelQualityScore(a));
  for (const hotel of sorted) {
    if (!hotel?.name) continue;
    if (unique.some((existing) => isProbablySameHotel(existing, hotel))) continue;
    unique.push(hotel);
  }
  return unique.sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR", { sensitivity: "base" }));
}

function hotelQualityScore(hotel = {}) {
  const reviews = Number(hotel.reviewCount || 0);
  const rating = Number(hotel.rating || 0);
  const sourceBonus = /google|curation|audit/i.test(hotel.source || "") ? 20 : 0;
  const specificity = Math.min(20, compactKey(hotel.name).length / 2);
  return sourceBonus + Math.log10(reviews + 1) * 12 + rating * 8 + specificity;
}

function isProbablySameHotel(a = {}, b = {}) {
  const sameDestination = a.destinationId && b.destinationId
    ? a.destinationId === b.destinationId
    : normalize(a.city) === normalize(b.city);
  if (!sameDestination) return false;

  const aName = compactKey(a.name);
  const bName = compactKey(b.name);
  if (!aName || !bName) return false;
  if (aName === bName) return true;

  const aCanonical = canonicalHotelName(a.name);
  const bCanonical = canonicalHotelName(b.name);
  if (aCanonical.length < 8 || bCanonical.length < 8) return false;
  return aCanonical.includes(bCanonical) || bCanonical.includes(aCanonical);
}

function canonicalHotelName(value) {
  return normalize(value)
    .replace(/\b(hotel|resort|pousada|spa|family|all|inclusive|beach|lounge|suites?|apart|flat)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

function sourceLabel(source = "") {
  const value = String(source || "");
  if (value.includes("google_places")) return "Google";
  if (value === "supabase_card") return "card";
  if (value === "supabase") return "banco";
  if (value === "liteapi") return "LiteAPI";
  return "";
}
