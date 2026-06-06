begin;

update public.destination_images
set status = 'rejected',
    updated_at = now()
where source = 'pexels'
  and destination_slug in (
    'resort-interior-sp',
    'atibaia',
    'hotel-fazenda-sp',
    'campos-do-jordao',
    'sao-roque',
    'olimpia',
    'litoral-norte-sp',
    'praia-do-forte',
    'porto-de-galinhas',
    'maceio-maragogi',
    'foz-do-iguacu',
    'gramado',
    'beto-carrero-penha',
    'buenos-aires',
    'orlando'
  );

with image_rows as (
  select *
  from jsonb_to_recordset($json$
  [
    {"destination_slug":"resort-interior-sp","destination_name":"Campinas","city":"Campinas","state":"Sao Paulo","country":"Brasil","category":"parque urbano","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Parque_Portugal_(2).jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Parque_Portugal_(2).jpg","attribution_text":"Parque Portugal/Lagoa do Taquaral via Wikimedia Commons","alt":"Parque Portugal, Lagoa do Taquaral, em Campinas","confidence_score":88,"status":"approved"},
    {"destination_slug":"atibaia","destination_name":"Atibaia","city":"Atibaia","state":"Sao Paulo","country":"Brasil","category":"serra e mirante","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Pedra_Grande_Atibaia_-_35087291084.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Pedra_Grande_Atibaia_-_35087291084.jpg","attribution_text":"Pedra Grande de Atibaia via Wikimedia Commons","alt":"Vista turística da Pedra Grande em Atibaia","confidence_score":95,"status":"approved"},
    {"destination_slug":"mogi-das-cruzes","destination_name":"Mogi das Cruzes","city":"Mogi das Cruzes","state":"Sao Paulo","country":"Brasil","category":"parque","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Parque_Centen%C3%A1rio_da_Imigra%C3%A7%C3%A3o_Japonesa.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Parque_Centen%C3%A1rio_da_Imigra%C3%A7%C3%A3o_Japonesa.jpg","attribution_text":"Parque Centenário da Imigração Japonesa via Wikimedia Commons","alt":"Parque Centenário da Imigração Japonesa em Mogi das Cruzes","confidence_score":92,"status":"approved"},
    {"destination_slug":"hotel-fazenda-sp","destination_name":"Dourado","city":"Dourado","state":"Sao Paulo","country":"Brasil","category":"hotel fazenda","image_url":null,"source":"pending","original_url":null,"attribution_text":"Imagem turística de Dourado pendente de validação","alt":"Imagem turística de Dourado pendente de validação","confidence_score":0,"status":"pending_review"},
    {"destination_slug":"cesario-lange","destination_name":"Cesário Lange","city":"Cesário Lange","state":"Sao Paulo","country":"Brasil","category":"resort","image_url":null,"source":"pending","original_url":null,"attribution_text":"Imagem turística de Cesário Lange pendente de validação","alt":"Imagem turística de Cesário Lange pendente de validação","confidence_score":0,"status":"pending_review"},
    {"destination_slug":"campos-do-jordao","destination_name":"Campos do Jordão","city":"Campos do Jordão","state":"Sao Paulo","country":"Brasil","category":"serra","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Vista_%C3%A1rea_da_Vila_Capivari,_Campos_do_Jord%C3%A3o.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Vista_%C3%A1rea_da_Vila_Capivari,_Campos_do_Jord%C3%A3o.jpg","attribution_text":"Vila Capivari, Campos do Jordão, via Wikimedia Commons","alt":"Vila Capivari em Campos do Jordão","confidence_score":90,"status":"approved"},
    {"destination_slug":"sao-roque","destination_name":"São Roque","city":"São Roque","state":"Sao Paulo","country":"Brasil","category":"roteiro do vinho","image_url":null,"source":"pending","original_url":null,"attribution_text":"Imagem turística de São Roque pendente de validação","alt":"Imagem turística de São Roque pendente de validação","confidence_score":0,"status":"pending_review"},
    {"destination_slug":"olimpia","destination_name":"Olímpia","city":"Olímpia","state":"Sao Paulo","country":"Brasil","category":"parque aquático","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Thermas_dos_Laranjais_-_Piscina_de_Onda.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Thermas_dos_Laranjais_-_Piscina_de_Onda.jpg","attribution_text":"Thermas dos Laranjais via Wikimedia Commons","alt":"Piscina de ondas no Thermas dos Laranjais em Olímpia","confidence_score":90,"status":"approved"},
    {"destination_slug":"litoral-norte-sp","destination_name":"Guarujá","city":"Guarujá","state":"Sao Paulo","country":"Brasil","category":"praia","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Praia_da_Enseada_079.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Praia_da_Enseada_079.jpg","attribution_text":"Praia da Enseada, Guarujá, via Wikimedia Commons","alt":"Praia da Enseada no Guarujá","confidence_score":95,"status":"approved"},
    {"destination_slug":"praia-do-forte","destination_name":"Praia do Forte","city":"Mata de Sao Joao","state":"Bahia","country":"Brasil","category":"praia e projeto tamar","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Projeto_Tamar_-_Praia_do_Forte,_Bahia_(7291356354).jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Projeto_Tamar_-_Praia_do_Forte,_Bahia_(7291356354).jpg","attribution_text":"Projeto Tamar, Praia do Forte, via Wikimedia Commons","alt":"Projeto Tamar na Praia do Forte","confidence_score":90,"status":"approved"},
    {"destination_slug":"porto-de-galinhas","destination_name":"Porto de Galinhas","city":"Ipojuca","state":"Pernambuco","country":"Brasil","category":"praia","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Porto_de_galinhas_praia.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Porto_de_galinhas_praia.jpg","attribution_text":"Praia de Porto de Galinhas via Wikimedia Commons","alt":"Praia de Porto de Galinhas","confidence_score":88,"status":"approved"},
    {"destination_slug":"maceio-maragogi","destination_name":"Maragogi","city":"Maragogi","state":"Alagoas","country":"Brasil","category":"praia","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Maragogi_beach_tourist.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Maragogi_beach_tourist.jpg","attribution_text":"Maragogi via Wikimedia Commons","alt":"Praia em Maragogi","confidence_score":90,"status":"approved"},
    {"destination_slug":"foz-do-iguacu","destination_name":"Foz do Iguaçu","city":"Foz do Iguaçu","state":"Parana","country":"Brasil","category":"natureza","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Cataratas_Iguacu_Iguazu_Falls.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Cataratas_Iguacu_Iguazu_Falls.jpg","attribution_text":"Cataratas do Iguaçu via Wikimedia Commons","alt":"Cataratas do Iguaçu","confidence_score":98,"status":"approved"},
    {"destination_slug":"gramado","destination_name":"Gramado","city":"Gramado","state":"Rio Grande do Sul","country":"Brasil","category":"serra","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Caminho_ao_lado_do_Lago_Negro_de_Gramado_em_dezembro_de_2017.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Caminho_ao_lado_do_Lago_Negro_de_Gramado_em_dezembro_de_2017.jpg","attribution_text":"Lago Negro de Gramado via Wikimedia Commons","alt":"Lago Negro em Gramado","confidence_score":94,"status":"approved"},
    {"destination_slug":"beto-carrero-penha","destination_name":"Penha","city":"Penha","state":"Santa Catarina","country":"Brasil","category":"parque","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Beto_Carrero_Theme_Park,_Brazil_(50895110451).jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Beto_Carrero_Theme_Park,_Brazil_(50895110451).jpg","attribution_text":"Beto Carrero World via Wikimedia Commons","alt":"Beto Carrero World em Penha","confidence_score":86,"status":"approved"},
    {"destination_slug":"buenos-aires","destination_name":"Buenos Aires","city":"Buenos Aires","state":"Buenos Aires","country":"Argentina","category":"cidade e cultura","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Buenos_Aires_-_La_Boca_-_Caminito_-_200807b.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Buenos_Aires_-_La_Boca_-_Caminito_-_200807b.jpg","attribution_text":"Caminito, Buenos Aires, via Wikimedia Commons","alt":"Caminito em La Boca, Buenos Aires","confidence_score":90,"status":"approved"},
    {"destination_slug":"orlando","destination_name":"Orlando","city":"Orlando","state":"Florida","country":"Estados Unidos","category":"parques","image_url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Cinderella%27s_Castle.jpg","source":"wikimedia_commons","original_url":"https://commons.wikimedia.org/wiki/File:Cinderella%27s_Castle.jpg","attribution_text":"Cinderella Castle, Magic Kingdom, via Wikimedia Commons","alt":"Cinderella Castle no Magic Kingdom, Orlando","confidence_score":84,"status":"approved"}
  ]
  $json$) as x(
    destination_slug text,
    destination_name text,
    city text,
    state text,
    country text,
    category text,
    image_url text,
    source text,
    original_url text,
    attribution_text text,
    alt text,
    confidence_score int,
    status text
  )
)
insert into public.destination_images (
  destination_slug,
  destination_name,
  city,
  state,
  country,
  category,
  context,
  query_used,
  image_url,
  thumbnail_url,
  source,
  original_url,
  license,
  attribution_required,
  attribution_text,
  alt,
  confidence_score,
  status
)
select
  destination_slug,
  destination_name,
  city,
  state,
  country,
  category,
  'tourism and family leisure',
  destination_name || ' turismo familia',
  image_url,
  image_url,
  source,
  original_url,
  case when source = 'pending' then null else 'Creative Commons / Wikimedia Commons' end,
  source <> 'pending',
  attribution_text,
  alt,
  confidence_score,
  status
from image_rows
on conflict (destination_slug, source) do update set
  destination_name = excluded.destination_name,
  city = excluded.city,
  state = excluded.state,
  country = excluded.country,
  category = excluded.category,
  context = excluded.context,
  query_used = excluded.query_used,
  image_url = excluded.image_url,
  thumbnail_url = excluded.thumbnail_url,
  original_url = excluded.original_url,
  license = excluded.license,
  attribution_required = excluded.attribution_required,
  attribution_text = excluded.attribution_text,
  alt = excluded.alt,
  confidence_score = excluded.confidence_score,
  status = excluded.status,
  updated_at = now();

commit;
