import { NextResponse } from "next/server";
import { searchGooglePlacesNearby } from "@/lib/integrations/google";
import { listCheckinsForDate, saveCheckin } from "../_lib/checkins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MINUTES_BETWEEN_SAME_PLACE = 45;

export async function POST(request) {
  if (!hasValidCredentials(request)) return unauthorized();

  const raw = await request.text();
  if (!raw.trim()) return NextResponse.json({ ok: true, ignored: "empty_payload" });

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, message: "Payload OwnTracks invalido." }, { status: 400 });
  }

  if (payload?._type !== "location") {
    return NextResponse.json({ ok: true, ignored: payload?._type || "unknown_payload" });
  }

  const latitude = numberOrNull(payload.lat);
  const longitude = numberOrNull(payload.lon);
  if (latitude === null || longitude === null) {
    return NextResponse.json({ ok: false, message: "Localizacao OwnTracks sem latitude/longitude." }, { status: 400 });
  }

  const observedAt = ownTracksTime(payload.tst);
  const nearby = await findNearbyPlace(latitude, longitude);
  const day = observedAt.slice(0, 10);
  const existing = await listCheckinsForDate(day);
  const duplicate = existing.checkins.find((checkin) => samePlaceRecently(checkin, nearby, observedAt));
  if (duplicate) {
    return NextResponse.json({ ok: true, ignored: "same_place_recently", checkinId: duplicate.id });
  }

  const result = await saveCheckin({
    id: `owntracks_${clean(payload.tid || "vt")}_${Math.floor(new Date(observedAt).getTime() / 1000)}`,
    observedAt,
    place: nearby,
    manualPlace: nearby.name || "Localizacao enviada pelo OwnTracks",
    participants: ["vitor", "nathalie", "luiza", "arthur"],
    author: { name: "OwnTracks do Vitor", role: "location" },
    source: "gps",
    confidence: nearby.name ? "suggested" : "probable",
    note: "Sugestao recebida pelo OwnTracks. Confirme ou ajuste antes de entrar no diario.",
    evidence: [{
      provider: "owntracks",
      trigger: clean(payload.t),
      accuracyMeters: numberOrNull(payload.acc),
      batteryPercent: numberOrNull(payload.batt),
      trackerId: clean(payload.tid),
      receivedAt: new Date().toISOString()
    }]
  });

  return NextResponse.json({ ok: true, accepted: true, source: result.source, checkin: result.checkin });
}

export async function GET(request) {
  if (!hasValidCredentials(request)) return unauthorized();
  const url = new URL(request.url);
  const result = await listCheckinsForDate(url.searchParams.get("date") || "");
  const latest = result.checkins.find((checkin) => checkin.source === "gps" && checkin.evidence?.some((item) => item?.provider === "owntracks"));
  return NextResponse.json({
    ok: true,
    service: "owntracks",
    status: "ready",
    lastCheckin: latest
      ? { id: latest.id, place: latest.place?.name || latest.manualPlace, observedAt: latest.observedAt, confidence: latest.confidence }
      : null
  });
}

function hasValidCredentials(request) {
  const expectedUser = clean(process.env.OWNTRACKS_USERNAME);
  const expectedPassword = clean(process.env.OWNTRACKS_PASSWORD);
  const header = request.headers.get("authorization") || "";
  if (!expectedUser || !expectedPassword || !header.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return constantTimeEqual(decoded.slice(0, separator), expectedUser) && constantTimeEqual(decoded.slice(separator + 1), expectedPassword);
  } catch {
    return false;
  }
}

async function findNearbyPlace(latitude, longitude) {
  try {
    const [place] = await searchGooglePlacesNearby({ latitude, longitude, radiusMeters: 180, maxResultCount: 1 });
    if (place) return place;
  } catch {}

  return {
    name: "Localizacao enviada pelo OwnTracks",
    formattedAddress: "Confirmar local antes de adicionar ao diario",
    latitude,
    longitude,
    categories: ["owntracks"]
  };
}

function samePlaceRecently(checkin, place, observedAt) {
  if (checkin.source !== "gps") return false;
  const current = new Date(observedAt).getTime();
  const previous = new Date(checkin.observedAt || checkin.createdAt).getTime();
  if (!Number.isFinite(current) || !Number.isFinite(previous) || current - previous > MINUTES_BETWEEN_SAME_PLACE * 60 * 1000) return false;
  const a = checkin.place || {};
  if (a.placeId && place.placeId && a.placeId === place.placeId) return true;
  return distanceMeters(a.latitude, a.longitude, place.latitude, place.longitude) < 120;
}

function distanceMeters(aLat, aLng, bLat, bLng) {
  const lat1 = numberOrNull(aLat), lon1 = numberOrNull(aLng), lat2 = numberOrNull(bLat), lon2 = numberOrNull(bLng);
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
  const rad = Math.PI / 180;
  const h = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function ownTracksTime(value) {
  const seconds = Number(value);
  const date = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clean(value) {
  return String(value ?? "").trim();
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, message: "Autenticacao OwnTracks necessaria." },
    { status: 401, headers: { "WWW-Authenticate": 'Basic realm="OwnTracks"', "Cache-Control": "no-store" } }
  );
}
