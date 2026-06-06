-- Destinations that do not have exactly 3 tourist spots.
select
  d.destination_slug,
  d.destination_name,
  count(s.id) as tourist_spot_count
from public.tourism_destinations d
left join public.tourism_spots s on s.destination_slug = d.destination_slug
group by d.destination_slug, d.destination_name
having count(s.id) <> 3
order by d.destination_slug;

-- Destinations that do not have exactly 2 events.
select
  d.destination_slug,
  d.destination_name,
  count(e.id) as event_count
from public.tourism_destinations d
left join public.tourism_events e on e.destination_slug = d.destination_slug
group by d.destination_slug, d.destination_name
having count(e.id) <> 2
order by d.destination_slug;

-- Destinations missing at least one family/accessibility-oriented spot.
select
  d.destination_slug,
  d.destination_name
from public.tourism_destinations d
left join public.tourism_spots s
  on s.destination_slug = d.destination_slug
 and s.highlight_type = 'family_accessible'
group by d.destination_slug, d.destination_name
having count(s.id) < 1
order by d.destination_slug;

-- Descriptions that exceed the playbook limit.
select
  'tourist_spot' as item_type,
  destination_slug,
  slug,
  name,
  char_length(description) as description_length
from public.tourism_spots
where char_length(description) > 150
union all
select
  'event' as item_type,
  destination_slug,
  slug,
  name,
  char_length(description) as description_length
from public.tourism_events
where char_length(description) > 150
order by destination_slug, item_type, slug;

-- Image paths that do not follow [destination-slug]/[item-slug].jpg.
select
  'tourist_spot' as item_type,
  destination_slug,
  slug,
  image_path
from public.tourism_spots
where image_path <> destination_slug || '/' || slug || '.jpg'
union all
select
  'event' as item_type,
  destination_slug,
  slug,
  image_path
from public.tourism_events
where image_path <> destination_slug || '/' || slug || '.jpg'
order by destination_slug, item_type, slug;

-- Upload manifest for Supabase Storage bucket tourism-images.
select
  image_path,
  item_type,
  destination_slug,
  item_slug,
  name,
  curation_status
from public.tourism_image_manifest
order by destination_slug, item_type, item_slug;
