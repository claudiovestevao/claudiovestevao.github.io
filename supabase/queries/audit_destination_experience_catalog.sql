select
  destination_key,
  destination_name,
  jsonb_array_length(restaurants) as restaurant_count,
  jsonb_array_length(attractions) as attraction_count,
  curation_status,
  last_verified_at
from public.destination_visit_guides
where jsonb_array_length(restaurants) < 3
   or jsonb_array_length(attractions) < 3
order by destination_key;
