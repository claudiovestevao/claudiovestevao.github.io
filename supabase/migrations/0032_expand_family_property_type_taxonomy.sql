alter table if exists public.destination_recommended_property_types
  drop constraint if exists destination_recommended_property_types_property_type_check;

alter table if exists public.destination_recommended_property_types
  add constraint destination_recommended_property_types_property_type_check
  check (
    property_type in (
      'hotel',
      'resort',
      'hotel_fazenda',
      'pousada',
      'apart_hotel',
      'flat',
      'chale',
      'cabana',
      'casa_temporada'
    )
  );
