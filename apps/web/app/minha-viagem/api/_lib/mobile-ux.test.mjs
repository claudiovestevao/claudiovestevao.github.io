import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tripHtml = readFileSync(
  new URL("../../orlando-agente.html", import.meta.url),
  "utf8"
);
const globalCss = readFileSync(
  new URL("../../../globals.css", import.meta.url),
  "utf8"
);
const globalBack = readFileSync(
  new URL("../../../../components/GlobalBackButton.jsx", import.meta.url),
  "utf8"
);
const auth = readFileSync(
  new URL("../../TravelPasswordAuth.jsx", import.meta.url),
  "utf8"
);
const frameShell = readFileSync(
  new URL("../../TravelFrameShell.jsx", import.meta.url),
  "utf8"
);
const serviceWorker = readFileSync(
  new URL("../../../../public/sw.js", import.meta.url),
  "utf8"
);
const leafletCss = readFileSync(
  new URL("../../../../public/leaflet.css", import.meta.url),
  "utf8"
);
const leafletJs = readFileSync(
  new URL("../../../../public/leaflet.js", import.meta.url),
  "utf8"
);
const nextConfig = readFileSync(
  new URL("../../../../next.config.mjs", import.meta.url),
  "utf8"
);
const middleware = readFileSync(
  new URL("../../../../middleware.js", import.meta.url),
  "utf8"
);

test("mobile shell keeps one five-item primary navigation", () => {
  const navStart = tripHtml.indexOf('<nav class="bottom-nav"');
  const navEnd = tripHtml.indexOf("</nav>", navStart);
  const mobileNav = tripHtml.slice(navStart, navEnd);

  assert.ok(navStart >= 0 && navEnd > navStart, "bottom navigation must exist");
  assert.equal(mobileNav.split("<button").length - 1, 5);
  assert.ok(tripHtml.includes("nav.primary-tabs{display:none!important}"));
  assert.ok(tripHtml.includes(".bottom-nav button.active{font-weight:950}"));
  assert.ok(tripHtml.includes("aria-current','page"));
});

test("mobile shell protects content and device safe areas", () => {
  assert.ok(tripHtml.includes("--tap:48px"));
  assert.ok(tripHtml.includes('button,input:not([type="checkbox"])'));
  assert.ok(tripHtml.includes("min-height:var(--tap)"));
  assert.ok(tripHtml.includes("gap:8px"));
  assert.ok(tripHtml.includes("env(safe-area-inset-top)"));
  assert.ok(tripHtml.includes("env(safe-area-inset-bottom)"));
  assert.ok(tripHtml.includes("calc(120px + env(safe-area-inset-bottom))"));
  assert.ok(globalCss.includes("min-height: 100dvh"));
});

test("header collapses and leaves persistent status and emergency access", () => {
  assert.ok(tripHtml.includes("header.hero.is-collapsed"));
  assert.ok(tripHtml.includes("window.scrollY>48"));
  assert.ok(tripHtml.includes('id="syncStatus" role="status" aria-live="polite"'));
  assert.ok(tripHtml.includes('data-open-tab="emergencia"'));
  assert.ok(tripHtml.includes('id="tripHomeButton"'));
});

test("system back restores previous in-app destinations", () => {
  assert.ok(tripHtml.includes("history.pushState({tripTab:id}"));
  assert.ok(tripHtml.includes("addEventListener('popstate'"));
  assert.ok(tripHtml.includes("openTab(id,true,'none')"));
});

test("touch and motion feedback remain accessible", () => {
  assert.ok(tripHtml.includes("transition:.22s"));
  assert.ok(tripHtml.includes("transition-duration:0s"));
  assert.ok(tripHtml.includes(":focus-visible"));
  assert.ok(tripHtml.includes("prefers-reduced-motion:reduce"));
  assert.ok(tripHtml.includes("font-size:12px"));
  assert.ok(frameShell.includes('role="status"'));
  assert.ok(frameShell.includes("aria-busy={!loaded}"));
});

test("authentication prevents invalid submission and avoids duplicate back UI", () => {
  assert.ok(auth.includes("const formValid = emailValid && password.length >= 8"));
  assert.ok(auth.includes("disabled={loading || !formValid}"));
  assert.ok(auth.includes('role="tabpanel"'));
  assert.ok(globalBack.includes('pathname.startsWith("/minha-viagem")'));
  assert.ok(globalCss.includes("min-height: 3rem"));
});

test("offline failure degrades to a usable recovery screen", () => {
  assert.ok(serviceWorker.includes("orlando-trip-v5"));
  assert.ok(serviceWorker.includes("Minha Viagem offline"));
  assert.ok(serviceWorker.includes("Tentar novamente"));
  assert.ok(serviceWorker.includes('"Cache-Control": "no-store"'));
});

test("browser permissions allow the requested check-in location flow", () => {
  assert.ok(nextConfig.includes("geolocation=(self)"));
  assert.ok(middleware.includes("geolocation=(self)"));
});


test("travel map uses real coordinates and responsive Leaflet controls", () => {
  const pinBlock = tripHtml.slice(
    tripHtml.indexOf("var mapPins=["),
    tripHtml.indexOf("var rainIdeas=")
  );

  assert.ok(tripHtml.includes('href="/leaflet.css"'));
  assert.ok(tripHtml.includes('src="/leaflet.js"'));
  assert.ok(tripHtml.includes('id="mapFitAll"'));
  assert.ok(tripHtml.includes('id="mapLocate"'));
  assert.ok(tripHtml.includes("basemaps.cartocdn.com/rastertiles/voyager"));
  assert.ok(tripHtml.includes("height:min(52dvh,480px)"));
  assert.match(pinBlock, /lat:28\./);
  assert.match(pinBlock, /lng:-81\./);
  assert.doesNotMatch(pinBlock, /(?:^|,)x:/m);
  assert.ok(leafletCss.includes(".leaflet-container"));
  assert.ok(leafletJs.includes("Leaflet"));
});

test("trip calendar joins itinerary, meals, bookings and store details", () => {
  const calendarBlock = tripHtml.slice(
    tripHtml.indexOf("var tripCalendarDetails=["),
    tripHtml.indexOf("function foodForDate")
  );
  const tripDaysBlock = tripHtml.slice(
    tripHtml.indexOf("var tripDays=["),
    tripHtml.indexOf("var dinnerChoices=")
  );
  const maxBudgets = [...calendarBlock.matchAll(/budget:"US\$\s*\d+-(\d+)"/g)].map(
    (match) => Number(match[1])
  );
  const numericRatings = [...calendarBlock.matchAll(/rating:"(\d),(\d)/g)].map(
    (match) => Number(`${match[1]}.${match[2]}`)
  );

  assert.equal(calendarBlock.split('iso:"2026-08-').length - 1, 10);
  assert.ok(tripHtml.includes('id="tripCalendar"'));
  assert.ok(tripHtml.includes('id="calendarDetailDialog"'));
  assert.ok(tripHtml.includes("calendarStoresHtml(detail)"));
  assert.ok(calendarBlock.includes('stores:["international","columbia","northface"]'));
  assert.ok(calendarBlock.includes('label:"Confirmada"'));
  assert.ok(calendarBlock.includes('label:"Requer reserva"'));
  assert.ok(calendarBlock.includes('label:"Não aplicável (dispensada)"'));
  assert.ok(tripDaysBlock.includes('{date:"Sex 14/8",title:"Hollywood Studios"'));
  assert.ok(tripDaysBlock.includes('{date:"Sáb 15/8",title:"Florida Mall + eixo Millenia"'));
  assert.ok(maxBudgets.length > 0 && maxBudgets.every((value) => value <= 80));
  assert.ok(numericRatings.length > 0 && numericRatings.every((value) => value >= 4.5));
});

test("personal restaurant highlights stay contextual and below the family cap", () => {
  const spotlightBlock = tripHtml.slice(
    tripHtml.indexOf("var restaurantSpotlights=["),
    tripHtml.indexOf("var restaurantPlan=[")
  );
  const spotlightBudgets = [...spotlightBlock.matchAll(/budget:"US\$\s*\d+-(\d+)"/g)].map(
    (match) => Number(match[1])
  );

  for (const name of ["Five Guys", "Shake Shack", "Chili's", "Texas Roadhouse", "Cheesecake Factory"]) {
    assert.ok(spotlightBlock.includes(`name:"${name}"`));
  }
  assert.ok(tripHtml.includes('id="restaurantSpotlights"'));
  assert.ok(tripHtml.includes("calendarSpotlightsHtml(detail)"));
  assert.ok(tripHtml.includes('spotlights:["cheesecake"]'));
  assert.ok(spotlightBudgets.length === 5 && spotlightBudgets.every((value) => value <= 80));
});
