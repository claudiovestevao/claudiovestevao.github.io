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

with qualified_accommodations as (
  select destination_id
  from public.accommodations
  where is_placeholder = false
    and confidence_level in ('high', 'verified')
    and family_score >= 7.0
    and coalesce(array_length(source_urls, 1), 0) > 0
  group by destination_id
)
select
  count(*) as total_destinations,
  count(qa.destination_id) as covered_destinations,
  count(*) - count(qa.destination_id) as missing_destinations,
  round((count(qa.destination_id)::numeric / nullif(count(*), 0)) * 100, 1) as coverage_percent
from public.destinations d
left join qualified_accommodations qa on qa.destination_id = d.id;
