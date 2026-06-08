export const TRIP_MOMENT_OPTIONS = [
  { value: "", label: "Qualquer época" },
  { value: "weekend_short", label: "Fim de semana curto" },
  { value: "carnival", label: "Carnaval" },
  { value: "june_festivals", label: "Junho / festas juninas" },
  { value: "winter", label: "Inverno / julho" },
  { value: "flowers", label: "Flores / primavera" },
  { value: "christmas_lights", label: "Natal / luzes" },
  { value: "long_weekend", label: "4 a 6 dias" },
  { value: "long_vacation", label: "Férias 15+ dias" }
];

export function momentAllows(destination, moment) {
  if (!moment) return true;
  if (moment === "weekend_short") {
    return destination.country === "Brasil" && destination.stateCode === "SP";
  }
  if (moment === "winter") {
    const text = destinationSearchText(destination);
    if (hasAny(text, ["cabo frio", "mar del plata", "praia", "litoral", "beach"]) && !hasAny(text, ["bariloche", "patagonia"])) {
      return false;
    }
    return hasAny(text, ["campos", "jordao", "petropolis", "gramado", "canela", "monte verde", "cunha", "goncalves", "urubici", "serra negra", "serra gaucha", "frio", "inverno", "montanha"]);
  }
  return true;
}

export function destinationMomentScore(destination, moment) {
  if (!moment) return Number(destination.familyScore || 0);
  const text = destinationSearchText(destination);
  let score = Number(destination.familyScore || 0);
  const state = destination.stateCode || "";
  const country = removeAccents(destination.country || "Brasil").toLowerCase();
  const isBrazil = country === "brasil" || country === "brazil" || country === "br";

  if (moment === "weekend_short") {
    if (state === "SP") score += 24;
    if (hasAny(text, ["litoral", "praia", "interior", "serra", "hotel fazenda", "resort", "holambra", "atibaia", "socorro", "brotas", "cunha", "guaruja", "sao roque"])) score += 10;
    if (["alto", "muito_alto"].includes(destination.familyHassleLevel)) score -= 18;
  }

  if (moment === "long_weekend") {
    if (isBrazil && ["SP", "RJ", "MG", "PR", "SC", "GO"].includes(state)) score += 10;
    if (hasAny(text, ["buenos aires", "santiago", "montevideo", "mendoza", "foz", "gramado", "rio quente", "olimpia", "nordeste"])) score += 20;
    if (destination.familyHassleLevel === "muito_alto") score -= 14;
  }

  if (moment === "long_vacation") {
    if (!isBrazil) score += 42;
    if (hasAny(text, ["orlando", "europa", "paris", "lisboa", "madrid", "roma", "bariloche", "patagonia", "buenos aires", "santiago"])) score += 42;
    if (hasAny(text, ["resort", "all inclusive", "nordeste", "praia", "internacional"])) score += 8;
  }

  if (moment === "carnival") {
    if (isBrazil && ["BA", "MG", "SP", "RJ", "PE", "AL"].includes(state)) score += 10;
    if (hasAny(text, ["bahia", "praia do forte", "trancoso", "porto seguro", "salvador", "minas", "interior", "serra", "resort", "hotel fazenda", "litoral"])) score += 24;
    if (hasAny(text, ["cidade grande", "agito"])) score -= 4;
  }

  if (moment === "june_festivals") {
    if (isBrazil && ["PE", "PB", "BA", "AL", "RN", "CE", "MA"].includes(state)) score += 18;
    if (hasAny(text, ["nordeste", "junina", "sao joao", "caruaru", "campina grande", "recife", "maceio", "salvador", "joao pessoa", "natal", "porto seguro", "praia", "cultura"])) score += 30;
  }

  if (moment === "winter") {
    if (isBrazil && ["SP", "RJ", "MG", "RS", "SC", "PR"].includes(state)) score += 6;
    if (hasAny(text, ["campos", "jordao", "petropolis", "gramado", "canela", "monte verde", "cunha", "goncalves", "urubici", "serra negra", "serra gaucha", "frio", "inverno", "montanha"])) score += 46;
    if (hasAny(text, ["praia", "litoral", "calor"])) score -= 5;
  }

  if (moment === "flowers") {
    if (hasAny(text, ["holambra", "flores", "expoflora", "jardim", "parque", "natureza", "cunha", "gramado", "curitiba"])) score += 24;
    if (state === "SP") score += 6;
  }

  if (moment === "christmas_lights") {
    if (hasAny(text, ["gramado", "canela", "natal luz", "luzes", "campos", "jordao", "petropolis", "curitiba", "monte verde"])) score += 58;
    if (isBrazil && ["RS", "SP", "RJ", "PR", "MG"].includes(state)) score += 4;
  }

  return score;
}

function destinationSearchText(destination) {
  return removeAccents([
    destination.name,
    destination.slug,
    destination.stateCode,
    destination.stateName,
    destination.country,
    destination.macroRegion,
    destination.destinationType,
    destination.bestFor,
    destination.honestSummary,
    destination.shortHassleAlert,
    ...(destination.tags || []),
    ...(destination.travelModes || []),
    ...(destination.stayOptions || []).map((option) => option.label)
  ].join(" ")).toLowerCase();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function removeAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
