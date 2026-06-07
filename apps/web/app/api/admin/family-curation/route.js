import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "family-curation-uploads";
const MAX_PHOTOS = 12;
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const password = clean(request.headers.get("x-admin-password") || searchParams.get("password"));
  if (!password || password !== appConfig.familyCurationAdminPassword) {
    return NextResponse.json({ ok: false, message: "Senha de admin invalida." }, { status: 401 });
  }

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, message: "Supabase service role nao configurado no servidor." }, { status: 503 });
  }

  const [destinationsResult, hotelsResult, hotelCardsResult] = await Promise.all([
    client
      .from("destinations")
      .select("id,slug,name,city,state,country,short_description,family_summary,latitude,longitude,is_mvp_priority,mvp_priority,destination_types")
      .eq("is_active", true)
      .order("is_mvp_priority", { ascending: false })
      .order("mvp_priority", { ascending: true })
      .order("name", { ascending: true })
      .limit(500),
    client
      .from("destination_hotels")
      .select("id,destination_id,name,address,city,country,latitude,longitude,liteapi_id,liteapi_rating,review_count,source,description")
      .limit(1000),
    client
      .from("destination_hotel_cards")
      .select("destination_slug,destination_name,liteapi_id,hotel_name,stars,liteapi_rating,review_count,address,main_photo,thumbnail,latitude,longitude,description")
      .limit(1000)
  ]);

  if (destinationsResult.error) {
    return NextResponse.json({
      ok: false,
      message: `Falha ao carregar destinos: ${destinationsResult.error.message}`
    }, { status: 502 });
  }

  const cardsByLiteApi = new Map((hotelCardsResult.data || [])
    .filter((card) => card.liteapi_id)
    .map((card) => [String(card.liteapi_id), card]));
  const cardsByName = new Map((hotelCardsResult.data || [])
    .map((card) => [`${slugify(card.destination_slug || card.destination_name)}|${slugify(card.hotel_name)}`, card]));

  const destinations = (destinationsResult.data || []).map((destination) => ({
    id: destination.id,
    slug: destination.slug,
    name: destination.city || destination.name,
    state: destination.state,
    country: destination.country || "Brasil",
    summary: destination.family_summary || destination.short_description || "",
    latitude: destination.latitude,
    longitude: destination.longitude,
    isPriority: Boolean(destination.is_mvp_priority),
    destinationTypes: destination.destination_types || []
  }));

  const hotels = (hotelsResult.data || []).map((hotel) => {
    const card = cardsByLiteApi.get(String(hotel.liteapi_id || "")) ||
      cardsByName.get(`${slugify(hotel.city)}|${slugify(hotel.name)}`) ||
      null;
    return {
      id: hotel.id,
      destinationId: hotel.destination_id,
      liteapiId: hotel.liteapi_id || card?.liteapi_id || "",
      name: hotel.name || card?.hotel_name || "",
      address: hotel.address || card?.address || "",
      city: hotel.city || "",
      country: hotel.country || "Brasil",
      latitude: hotel.latitude || card?.latitude || null,
      longitude: hotel.longitude || card?.longitude || null,
      stars: card?.stars ?? null,
      rating: hotel.liteapi_rating ?? card?.liteapi_rating ?? null,
      reviewCount: hotel.review_count ?? card?.review_count ?? null,
      source: hotel.source || "supabase",
      description: hotel.description || card?.description || "",
      image: card?.thumbnail || card?.main_photo || ""
    };
  });

  return NextResponse.json({
    ok: true,
    source: "supabase_admin_prefill",
    destinations,
    hotels,
    warnings: [
      hotelsResult.error ? `destination_hotels indisponivel: ${hotelsResult.error.message}` : "",
      hotelCardsResult.error ? `destination_hotel_cards indisponivel: ${hotelCardsResult.error.message}` : ""
    ].filter(Boolean)
  });
}

export async function POST(request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, message: "Formulario invalido." }, { status: 400 });
  }

  const password = clean(formData.get("password"));
  if (!password || password !== appConfig.familyCurationAdminPassword) {
    return NextResponse.json({ ok: false, message: "Senha de admin invalida." }, { status: 401 });
  }

  const destinationName = clean(formData.get("destinationName"));
  const propertyName = clean(formData.get("propertyName"));
  if (!destinationName && !propertyName) {
    return NextResponse.json({ ok: false, message: "Informe pelo menos destino ou hotel/pousada/resort." }, { status: 400 });
  }

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, message: "Supabase service role nao configurado no servidor." }, { status: 503 });
  }

  const submissionId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const monthPath = createdAt.slice(0, 7);
  const safePrefix = slugify([destinationName, propertyName].filter(Boolean).join("-") || "curadoria");
  const basePath = `${monthPath}/${safePrefix}-${submissionId}`;
  const photos = formData.getAll("photos").filter((file) => file && typeof file === "object" && "arrayBuffer" in file);

  if (photos.length > MAX_PHOTOS) {
    return NextResponse.json({ ok: false, message: `Envie no maximo ${MAX_PHOTOS} fotos por avaliacao.` }, { status: 400 });
  }

  const bucketReady = await ensureBucket(client);
  if (!bucketReady.ok) {
    return NextResponse.json(bucketReady, { status: 502 });
  }

  const uploadedPhotos = [];
  for (const [index, photo] of photos.entries()) {
    const validation = validatePhoto(photo);
    if (!validation.ok) {
      return NextResponse.json(validation, { status: 400 });
    }
    const extension = extensionFor(photo.type, photo.name);
    const photoPath = `photos/${basePath}/${String(index + 1).padStart(2, "0")}-${slugify(photo.name || "foto")}${extension}`;
    const bytes = Buffer.from(await photo.arrayBuffer());
    const { error } = await client.storage.from(BUCKET).upload(photoPath, bytes, {
      contentType: photo.type || "application/octet-stream",
      upsert: false
    });
    if (error) {
      return NextResponse.json({ ok: false, message: `Falha ao subir foto: ${error.message}` }, { status: 502 });
    }
    uploadedPhotos.push({
      path: photoPath,
      originalName: photo.name || "",
      contentType: photo.type || "",
      size: photo.size || bytes.length
    });
  }

  const submission = {
    id: submissionId,
    questionnaireVersion: "family-curation-admin-v1",
    createdAt,
    destinationName,
    propertyName,
    source: "admin_family_visit",
    respondent: {
      name: clean(formData.get("respondentName")),
      role: clean(formData.get("respondentRole"))
    },
    responses: collectResponses(formData),
    uploadedPhotos
  };

  const jsonPath = `submissions/${basePath}.json`;
  const { error: uploadError } = await client.storage.from(BUCKET).upload(
    jsonPath,
    Buffer.from(JSON.stringify(submission, null, 2), "utf8"),
    { contentType: "application/json", upsert: false }
  );

  if (uploadError) {
    return NextResponse.json({ ok: false, message: `Falha ao salvar curadoria: ${uploadError.message}` }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    id: submissionId,
    bucket: BUCKET,
    submissionPath: jsonPath,
    photos: uploadedPhotos.length
  });
}

function collectResponses(formData) {
  const responses = {};
  for (const [key, value] of formData.entries()) {
    if (key === "password" || key === "photos") continue;
    if (value && typeof value === "object" && "arrayBuffer" in value) continue;
    responses[key] = clean(value);
  }
  return responses;
}

async function ensureBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) return { ok: false, message: `Falha ao listar buckets: ${listError.message}` };
  if ((buckets || []).some((bucket) => bucket.name === BUCKET)) return { ok: true };
  const { error } = await client.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "application/json"],
    fileSizeLimit: String(MAX_PHOTO_BYTES)
  });
  if (error) return { ok: false, message: `Falha ao criar bucket privado: ${error.message}` };
  return { ok: true };
}

function validatePhoto(photo) {
  if (!String(photo.type || "").startsWith("image/")) {
    return { ok: false, message: `Arquivo ${photo.name || ""} nao parece imagem.` };
  }
  if (Number(photo.size || 0) > MAX_PHOTO_BYTES) {
    return { ok: false, message: `Foto ${photo.name || ""} passa de 12 MB.` };
  }
  return { ok: true };
}

function clean(value) {
  return String(value || "").trim();
}

function slugify(value) {
  return String(value || "item")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

function extensionFor(contentType = "", fileName = "") {
  const lower = String(fileName || "").toLowerCase();
  const match = lower.match(/\.(jpe?g|png|webp|heic)$/);
  if (match) return "";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("heic")) return ".heic";
  return ".jpg";
}
