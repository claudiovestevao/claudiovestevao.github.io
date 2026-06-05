const fs = require("fs");
const vm = require("vm");

const root = "C:/Users/cvito/Documents/Codex/2026-05-28/dentro-site-claudiocode-dev-qual-tipo/claudiovestevao.github.io";
const destinationsPath = `${root}/agentes/concierge-da-familia/src/data/conciergeFamilyDestinations.js`;
const seedPaths = [
  `${root}/supabase/migrations/0013_seed_verified_family_accommodations.sql`,
  `${root}/supabase/migrations/0014_seed_front_destination_accommodations.sql`
];

const destinationsSource = fs
  .readFileSync(destinationsPath, "utf8")
  .replace("export const conciergeDestinations =", "globalThis.conciergeDestinations =");

vm.runInNewContext(destinationsSource, globalThis);

const hotelRows = seedPaths.flatMap(seedPath => {
  const seedSql = fs.readFileSync(seedPath, "utf8");
  const jsonBlock = seedSql.match(/\$json\$([\s\S]*?)\$json\$/);

  if (!jsonBlock) {
    throw new Error(`Could not find $json$ seed block in ${seedPath}.`);
  }

  return JSON.parse(jsonBlock[1]);
});
const qualifiedDestinationSlugs = new Set(
  hotelRows
    .filter(row =>
      row.confidence_level &&
      ["high", "verified"].includes(row.confidence_level) &&
      row.family_score >= 7 &&
      row.source_urls &&
      row.source_urls.length > 0
    )
    .map(row => row.dest_slug)
);

const missing = globalThis.conciergeDestinations
  .map(destination => ({ slug: destination.id, name: destination.name }))
  .filter(destination => !qualifiedDestinationSlugs.has(destination.slug));

console.log(JSON.stringify({
  totalFrontDestinations: globalThis.conciergeDestinations.length,
  qualifiedFrontDestinations: globalThis.conciergeDestinations.length - missing.length,
  missingFrontDestinations: missing
}, null, 2));
