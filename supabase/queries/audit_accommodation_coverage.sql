with qualified_accommodations as (
  select
    destination_id,
    count(*) as qualified_count,
    max(family_score) as best_family_score,
    array_agg(slug order by family_score desc nulls last, name) as accommodation_slugs
  from public.accommodations
  where is_placeholder = false
    and confidence_level in ('high', 'verified')
    and family_score >= 7.0
    and coalesce(array_length(source_urls, 1), 0) > 0
  group by destination_id
)
select
  d.slug as destination_slug,
  d.name as destination_name,
  coalesce(qa.qualified_count, 0) as qualified_accommodations,
  qa.best_family_score,
  qa.accommodation_slugs
from public.destinations d
left join qualified_accommodations qa on qa.destination_id = d.id
where coalesce(qa.qualified_count, 0) = 0
order by d.slug;

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
