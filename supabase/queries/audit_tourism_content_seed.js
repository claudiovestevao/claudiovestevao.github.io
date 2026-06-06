const fs = require("fs");
const path = require("path");

const migrationPath = path.resolve(__dirname, "../migrations/0020_create_tourism_content_and_storage_paths.sql");
const migration = fs.readFileSync(migrationPath, "utf8");

function readDollarJson(tag) {
  const match = migration.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`));
  if (!match) throw new Error(`Could not find $${tag}$ block.`);
  return JSON.parse(match[1]);
}

const destinations = readDollarJson("destinations");
const spots = readDollarJson("spots");
const events = readDollarJson("events");

const failures = [];
const destinationSlugs = new Set(destinations.map(destination => destination.destination_slug));

function addFailure(type, detail) {
  failures.push({ type, ...detail });
}

for (const destination of destinations) {
  if (destination.image_folder !== destination.destination_slug) {
    addFailure("destination_image_folder", {
      destination_slug: destination.destination_slug,
      image_folder: destination.image_folder
    });
  }
}

for (const item of [...spots, ...events]) {
  if (!destinationSlugs.has(item.destination_slug)) {
    addFailure("unknown_destination", {
      destination_slug: item.destination_slug,
      slug: item.slug,
      name: item.name
    });
  }

  const expectedPath = `${item.destination_slug}/${item.slug}.jpg`;
  if (item.image_path !== expectedPath) {
    addFailure("bad_image_path", {
      destination_slug: item.destination_slug,
      slug: item.slug,
      image_path: item.image_path,
      expectedPath
    });
  }

  if ([...item.description].length > 150) {
    addFailure("long_description", {
      destination_slug: item.destination_slug,
      slug: item.slug,
      name: item.name,
      length: [...item.description].length
    });
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) {
    addFailure("bad_slug", {
      destination_slug: item.destination_slug,
      slug: item.slug,
      name: item.name
    });
  }
}

for (const destination of destinations) {
  const destinationSpots = spots.filter(item => item.destination_slug === destination.destination_slug);
  const destinationEvents = events.filter(item => item.destination_slug === destination.destination_slug);
  const familySpots = destinationSpots.filter(item => item.highlight_type === "family_accessible");

  if (destinationSpots.length !== 3) {
    addFailure("spot_count", {
      destination_slug: destination.destination_slug,
      count: destinationSpots.length
    });
  }

  if (destinationEvents.length !== 2) {
    addFailure("event_count", {
      destination_slug: destination.destination_slug,
      count: destinationEvents.length
    });
  }

  if (familySpots.length < 1) {
    addFailure("missing_family_accessible_spot", {
      destination_slug: destination.destination_slug
    });
  }
}

const duplicateKeys = new Map();
for (const item of [...spots.map(item => ({ ...item, item_type: "spot" })), ...events.map(item => ({ ...item, item_type: "event" }))]) {
  const key = `${item.item_type}:${item.destination_slug}:${item.slug}`;
  duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
}
for (const [key, count] of duplicateKeys) {
  if (count > 1) addFailure("duplicate_item_key", { key, count });
}

const summary = {
  totalDestinations: destinations.length,
  totalTouristSpots: spots.length,
  totalEvents: events.length,
  totalImagePaths: spots.length + events.length,
  expectedTouristSpots: destinations.length * 3,
  expectedEvents: destinations.length * 2,
  failures
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exit(1);
