import { conciergeDestinations } from "../src/data/conciergeFamilyDestinations.js";
import { conciergeHotels } from "../src/data/conciergeFamilyHotels.js";
import { conciergeHotelAdditions } from "../src/data/conciergeFamilyHotelAdditions.js";
import { conciergeDestinationGalleries } from "../src/data/conciergeDestinationGalleries.js";

const MIN_WIDTH = 1200;
const MIN_HEIGHT = 800;
const REQUIRED_PHOTOS = 3;
const COMMONS_UPLOAD_HOST = "upload.wikimedia.org";
const OFFICIAL_IMAGE_HOSTS = new Set(["lirp.cdn-website.com"]);

const galleriesByKey = new Map();
const failures = [];
const recommendableCityKeys = new Set([...conciergeHotels, ...conciergeHotelAdditions].map(hotel => slugifyText(hotel.destination || hotel.destinationSlug || hotel.id)));

for (const gallery of conciergeDestinationGalleries) {
  registerGalleryKey(gallery.key, gallery);
  for (const alias of gallery.aliases || []) registerGalleryKey(alias, gallery);
}

for (const destinationKey of conciergeDestinations.map(destination => destination.id)) {
  const gallery = galleriesByKey.get(destinationKey);
  if (!gallery) {
    failures.push(`${destinationKey}: sem galeria mapeada`);
    continue;
  }
}

for (const cityKey of recommendableCityKeys) {
  if (!galleriesByKey.has(cityKey)) failures.push(`${cityKey}: cidade recomendável sem galeria exata`);
}

for (const gallery of conciergeDestinationGalleries) {
  const photos = Array.isArray(gallery.photos) ? gallery.photos : [];
  if (photos.length !== REQUIRED_PHOTOS) {
    failures.push(`${gallery.key}: esperado ${REQUIRED_PHOTOS} fotos, encontrado ${photos.length}`);
  }

  photos.forEach((photo, index) => {
    const prefix = `${gallery.key} foto ${index + 1}`;
    if (photo.status !== "approved") failures.push(`${prefix}: status precisa ser approved`);
    if (!["wikimedia_commons", "official_hotel_site"].includes(photo.source)) failures.push(`${prefix}: fonte não permitida`);
    if (!photo.imageUrl) failures.push(`${prefix}: imageUrl ausente`);
    if (!photo.thumbnailUrl) failures.push(`${prefix}: thumbnailUrl ausente`);
    if (!photo.sourceUrl) failures.push(`${prefix}: sourceUrl ausente`);
    if (!photo.alt || photo.alt.length < 12) failures.push(`${prefix}: alt muito curto ou ausente`);
    if (!Number.isFinite(photo.width) || photo.width < MIN_WIDTH) failures.push(`${prefix}: largura ${photo.width} abaixo de ${MIN_WIDTH}`);
    if (!Number.isFinite(photo.height) || photo.height < MIN_HEIGHT) failures.push(`${prefix}: altura ${photo.height} abaixo de ${MIN_HEIGHT}`);
    if (photo.source === "wikimedia_commons" && photo.imageUrl && !hasCommonsHost(photo.imageUrl)) failures.push(`${prefix}: imageUrl fora do Wikimedia Commons`);
    if (photo.source === "wikimedia_commons" && photo.thumbnailUrl && !hasCommonsHost(photo.thumbnailUrl)) failures.push(`${prefix}: thumbnailUrl fora do Wikimedia Commons`);
    if (photo.source === "official_hotel_site" && photo.imageUrl && !hasOfficialImageHost(photo.imageUrl)) failures.push(`${prefix}: imageUrl fora dos hosts oficiais permitidos`);
  });
}

const summary = {
  totalMappedDestinations: conciergeDestinations.length,
  destinationsWithThreePhotos: conciergeDestinations.filter(destination => {
    const gallery = galleriesByKey.get(destination.id);
    return Array.isArray(gallery?.photos) && gallery.photos.length === REQUIRED_PHOTOS;
  }).length,
  recommendableCityKeys: recommendableCityKeys.size,
  recommendableCityKeysWithExactGallery: [...recommendableCityKeys].filter(cityKey => galleriesByKey.has(cityKey)).length,
  totalGalleries: conciergeDestinationGalleries.length,
  totalPhotos: conciergeDestinationGalleries.reduce((sum, gallery) => sum + (gallery.photos?.length || 0), 0),
  minimumResolution: `${MIN_WIDTH}x${MIN_HEIGHT}`,
  failures
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exit(1);

function registerGalleryKey(key, gallery) {
  if (!key) return;
  if (galleriesByKey.has(key)) failures.push(`${key}: chave/alias duplicado`);
  galleriesByKey.set(key, gallery);
}

function hasCommonsHost(url) {
  try {
    return new URL(url).hostname === COMMONS_UPLOAD_HOST;
  } catch {
    return false;
  }
}

function hasOfficialImageHost(url) {
  try {
    return OFFICIAL_IMAGE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function slugifyText(text) {
  return removeAccents(String(text || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function removeAccents(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
