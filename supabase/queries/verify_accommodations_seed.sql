select
  count(*) as total_accommodations,
  count(*) filter (where confidence_level = 'verified') as verified_accommodations,
  count(*) filter (where confidence_level = 'high') as high_confidence_accommodations,
  count(*) filter (where is_placeholder) as placeholder_accommodations
from public.accommodations;

select
  d.slug as destination_slug,
  d.name as destination_name,
  a.slug as accommodation_slug,
  a.name as accommodation_name,
  a.family_score,
  a.confidence_level,
  a.official_site_url
from public.accommodations a
join public.destinations d on d.id = a.destination_id
where a.is_placeholder = false
order by a.family_score desc nulls last, a.name;
