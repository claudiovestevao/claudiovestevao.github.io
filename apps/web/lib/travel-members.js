import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { travelProfileForEmail } from "@/lib/travel-session";

const ORLANDO_TRIP_SLUG = "orlando-2026";

export async function isTravelEmailInvited(email) {
  const normalized = cleanEmail(email);
  if (!normalized) return false;
  if (travelProfileForEmail(normalized)) return true;

  const client = getServiceClient();
  if (!client) return false;

  const profile = await findProfileByEmail(client, normalized);
  if (!profile?.id) return false;
  return Boolean(await findTripMemberProfile(client, profile.id, normalized));
}

export async function resolveTravelMemberForAuthUser(user) {
  const email = cleanEmail(user?.email);
  if (!email || !user?.id) return null;

  const client = getServiceClient();
  if (client) {
    const storedProfile = await findTripMemberProfile(client, user.id, email);
    if (storedProfile) return storedProfile;
  }

  const bootstrapProfile = travelProfileForEmail(email);
  if (!bootstrapProfile) return null;

  if (client) {
    await ensureTripMembership(client, user, bootstrapProfile);
  }

  return bootstrapProfile;
}

async function ensureTripMembership(client, user, profile) {
  const email = cleanEmail(profile.email || user.email);
  if (!email || !user?.id) return;

  await client.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: clean(profile.name) || displayNameFromEmail(email),
      avatar_url: clean(profile.avatar) || "✨"
    },
    { onConflict: "id" }
  );

  const trip = await getOrCreateOrlandoTrip(client, user.id);
  if (!trip?.id) return;

  await client.from("trip_members").upsert(
    {
      trip_id: trip.id,
      user_id: user.id,
      role: profile.role === "viewer" ? "viewer" : "owner",
      status: "active"
    },
    { onConflict: "trip_id,user_id" }
  );
}

async function findTripMemberProfile(client, userId, fallbackEmail) {
  const trip = await getOrCreateOrlandoTrip(client, null);
  if (!trip?.id) return null;

  const { data: member, error: memberError } = await client
    .from("trip_members")
    .select("role,status")
    .eq("trip_id", trip.id)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (memberError || !member) return null;

  const { data: storedProfile } = await client
    .from("profiles")
    .select("email,full_name,avatar_url")
    .eq("id", userId)
    .maybeSingle();

  const email = cleanEmail(storedProfile?.email || fallbackEmail);
  const fallbackProfile = travelProfileForEmail(email);

  return {
    email,
    name: clean(storedProfile?.full_name) || fallbackProfile?.name || displayNameFromEmail(email),
    role: member.role === "viewer" ? "viewer" : "admin",
    avatar: clean(storedProfile?.avatar_url) || fallbackProfile?.avatar || "✨"
  };
}

async function findProfileByEmail(client, email) {
  const { data, error } = await client
    .from("profiles")
    .select("id,email")
    .eq("email", cleanEmail(email))
    .maybeSingle();

  return error ? null : data;
}

async function getOrCreateOrlandoTrip(client, ownerId) {
  const existing = await getOrlandoTrip(client);
  if (existing?.id || !ownerId) return existing;

  const { data: created } = await client
    .from("trips")
    .insert({
      name: "Orlando 2026",
      slug: ORLANDO_TRIP_SLUG,
      owner_id: ownerId,
      created_by: ownerId,
      start_date: "2026-08-09",
      end_date: "2026-08-18"
    })
    .select("id")
    .maybeSingle();

  return created || (await getOrlandoTrip(client));
}

async function getOrlandoTrip(client) {
  const { data, error } = await client
    .from("trips")
    .select("id")
    .eq("slug", ORLANDO_TRIP_SLUG)
    .maybeSingle();

  return error ? null : data;
}

function getServiceClient() {
  if (!appConfig.supabaseUrl || !appConfig.supabaseServiceRoleKey) return null;
  return getSupabaseServerClient();
}

function displayNameFromEmail(email) {
  const local = clean(email).split("@")[0] || "Família";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanEmail(value) {
  return clean(value).toLowerCase();
}

function clean(value) {
  return String(value ?? "").trim();
}
