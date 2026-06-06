function commonsPhoto(title, alt, width, height, imageUrl, thumbnailUrl, license, author) {
  return {
    title,
    alt,
    width,
    height,
    imageUrl,
    thumbnailUrl,
    source: "wikimedia_commons",
    sourceUrl: `https://commons.wikimedia.org/wiki/${title.replace("File:", "File:").replaceAll(" ", "_")}`,
    license,
    author,
    status: "approved"
  };
}

function officialPhoto(title, alt, width, height, imageUrl, sourceUrl, sourceLabel) {
  return {
    title,
    alt,
    width,
    height,
    imageUrl,
    thumbnailUrl: imageUrl,
    source: "official_hotel_site",
    sourceUrl,
    sourceLabel,
    license: "foto oficial",
    author: sourceLabel,
    status: "approved"
  };
}

export const conciergeDestinationGalleries = [
  {
    key: "resort-interior-sp",
    aliases: ["campinas-sp"],
    destinationName: "Campinas, SP",
    photos: [
      commonsPhoto("File:Parque Portugal (3).jpg", "Parque Portugal e Lagoa do Taquaral em Campinas", 4896, 2752, "https://upload.wikimedia.org/wikipedia/commons/b/bb/Parque_Portugal_%283%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Parque_Portugal_%283%29.jpg/1280px-Parque_Portugal_%283%29.jpg", "CC BY-SA 4.0", "Raphael Henrique Figueira"),
      commonsPhoto("File:Bosque dos Jequitibas Campinas.jpg", "Bosque dos Jequitibás em Campinas", 4032, 2688, "https://upload.wikimedia.org/wikipedia/commons/e/e8/Bosque_dos_Jequitibas_Campinas.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Bosque_dos_Jequitibas_Campinas.jpg/1280px-Bosque_dos_Jequitibas_Campinas.jpg", "CC BY-SA 3.0", "Leandro R. M. de Marco"),
      commonsPhoto("File:Campinas - Estação de Anhumas - turismo 005.jpg", "Estação de Anhumas da Maria Fumaça em Campinas", 2048, 1536, "https://upload.wikimedia.org/wikipedia/commons/b/bc/Campinas_-_Esta%C3%A7%C3%A3o_de_Anhumas_-_turismo_005.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Campinas_-_Esta%C3%A7%C3%A3o_de_Anhumas_-_turismo_005.jpg/1280px-Campinas_-_Esta%C3%A7%C3%A3o_de_Anhumas_-_turismo_005.jpg", "CC BY-SA 2.5", "")
    ]
  },
  {
    key: "mogi-das-cruzes-sp",
    aliases: ["mogi-das-cruzes"],
    destinationName: "Mogi das Cruzes, SP",
    photos: [
      commonsPhoto("File:Vista de Mogi das Cruzes a partir do Pico do Urubu.JPG", "Vista de Mogi das Cruzes a partir do Pico do Urubu", 5184, 3456, "https://upload.wikimedia.org/wikipedia/commons/6/6f/Vista_de_Mogi_das_Cruzes_a_partir_do_Pico_do_Urubu.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Vista_de_Mogi_das_Cruzes_a_partir_do_Pico_do_Urubu.JPG/1280px-Vista_de_Mogi_das_Cruzes_a_partir_do_Pico_do_Urubu.JPG", "CC BY-SA 3.0", "Henrique Boney"),
      commonsPhoto("File:Panorama do Playground do parque.jpg", "Playground do Parque da Cidade em Mogi das Cruzes", 6592, 2864, "https://upload.wikimedia.org/wikipedia/commons/6/65/Panorama_do_Playground_do_parque.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Panorama_do_Playground_do_parque.jpg/1280px-Panorama_do_Playground_do_parque.jpg", "CC0", "Tetizeraz"),
      commonsPhoto("File:Pico do Urubu.JPG", "Pico do Urubu em Mogi das Cruzes", 5184, 3456, "https://upload.wikimedia.org/wikipedia/commons/7/71/Pico_do_Urubu.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Pico_do_Urubu.JPG/1280px-Pico_do_Urubu.JPG", "CC BY-SA 3.0", "Henrique Boney")
    ]
  },
  {
    key: "hotel-fazenda-sp",
    aliases: ["dourado-sp"],
    destinationName: "Dourado, SP",
    photos: [
      commonsPhoto("File:Rio Dourado, SP 01.jpg", "Rio Dourado em São Paulo", 4000, 2893, "https://upload.wikimedia.org/wikipedia/commons/8/85/Rio_Dourado%2C_SP_01.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Rio_Dourado%2C_SP_01.jpg/1280px-Rio_Dourado%2C_SP_01.jpg", "CC BY-SA 3.0", "MARCO AURELIO ESPARZ"),
      commonsPhoto("File:Rio Dourado, SP 02.jpg", "Paisagem do Rio Dourado em São Paulo", 4000, 3000, "https://upload.wikimedia.org/wikipedia/commons/7/71/Rio_Dourado%2C_SP_02.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Rio_Dourado%2C_SP_02.jpg/1280px-Rio_Dourado%2C_SP_02.jpg", "CC BY-SA 3.0", "MARCO AURELIO ESPARZ"),
      commonsPhoto("File:Rio Dourado, SP 03.jpg", "Trecho natural do Rio Dourado em São Paulo", 4000, 2883, "https://upload.wikimedia.org/wikipedia/commons/8/8e/Rio_Dourado%2C_SP_03.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Rio_Dourado%2C_SP_03.jpg/1280px-Rio_Dourado%2C_SP_03.jpg", "CC BY-SA 3.0", "MARCO AURELIO ESPARZ")
    ]
  },
  {
    key: "cesario-lange-sp",
    aliases: ["cesario-lange"],
    destinationName: "Cesário Lange, SP",
    photos: [
      officialPhoto("Mavsa Resort - fachada temática", "Área temática iluminada do Mavsa Resort em Cesário Lange", 1500, 1000, "https://lirp.cdn-website.com/5bf3d25b/dms3rep/multi/opt/mr_ft-07-1920w.webp", "https://www.mavsaresort.com.br/", "Mavsa Resort"),
      officialPhoto("Mavsa Resort - lago e stand up paddle", "Lago com stand up paddle no Mavsa Resort em Cesário Lange", 1500, 1001, "https://lirp.cdn-website.com/5bf3d25b/dms3rep/multi/opt/mr_ft-09-4748883b-1920w.jpg", "https://www.mavsaresort.com.br/", "Mavsa Resort"),
      officialPhoto("Mavsa Resort - barco e lago", "Área de lazer com barco no Mavsa Resort em Cesário Lange", 1500, 1000, "https://lirp.cdn-website.com/5bf3d25b/dms3rep/multi/opt/mr_evt_barco_ft-05-1920w.jpg", "https://www.mavsaresort.com.br/", "Mavsa Resort")
    ]
  },
  {
    key: "campos-do-jordao",
    aliases: ["campos-do-jordao-sp"],
    destinationName: "Campos do Jordão, SP",
    photos: [
      commonsPhoto("File:Vila Capivari, Campos do Jordão.JPG", "Vila Capivari em Campos do Jordão", 2048, 1536, "https://upload.wikimedia.org/wikipedia/commons/a/a6/Vila_Capivari%2C_Campos_do_Jord%C3%A3o.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Vila_Capivari%2C_Campos_do_Jord%C3%A3o.JPG/1280px-Vila_Capivari%2C_Campos_do_Jord%C3%A3o.JPG", "CC BY-SA 4.0", "Majtec"),
      commonsPhoto("File:Flores em Amantikir.jpg", "Jardins do Parque Amantikir em Campos do Jordão", 4032, 3024, "https://upload.wikimedia.org/wikipedia/commons/4/4f/Flores_em_Amantikir.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Flores_em_Amantikir.jpg/1280px-Flores_em_Amantikir.jpg", "CC BY-SA 4.0", "ALEXANDRE VALERIO MUSSIO"),
      commonsPhoto("File:Lago do parque estadual de campos do jordão SP.jpg", "Lago no Parque Estadual Campos do Jordão", 5184, 3456, "https://upload.wikimedia.org/wikipedia/commons/7/7e/Lago_do_parque_estadual_de_campos_do_jord%C3%A3o_SP.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Lago_do_parque_estadual_de_campos_do_jord%C3%A3o_SP.jpg/1280px-Lago_do_parque_estadual_de_campos_do_jord%C3%A3o_SP.jpg", "CC BY-SA 4.0", "Gabrielleaine")
    ]
  },
  {
    key: "sao-roque",
    aliases: ["sao-roque-sp"],
    destinationName: "São Roque, SP",
    photos: [
      commonsPhoto("File:Ski Mountain Park, São Roque - SP 9.jpg", "Ski Mountain Park em São Roque", 3468, 4624, "https://upload.wikimedia.org/wikipedia/commons/a/ab/Ski_Mountain_Park%2C_S%C3%A3o_Roque_-_SP_9.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Ski_Mountain_Park%2C_S%C3%A3o_Roque_-_SP_9.jpg/1280px-Ski_Mountain_Park%2C_S%C3%A3o_Roque_-_SP_9.jpg", "CC BY-SA 4.0", "Daniel Whistler"),
      commonsPhoto("File:Ski Mountain Park, São Roque - SP 8.jpg", "Vista do Ski Mountain Park em São Roque", 2448, 3264, "https://upload.wikimedia.org/wikipedia/commons/0/06/Ski_Mountain_Park%2C_S%C3%A3o_Roque_-_SP_8.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Ski_Mountain_Park%2C_S%C3%A3o_Roque_-_SP_8.jpg/1280px-Ski_Mountain_Park%2C_S%C3%A3o_Roque_-_SP_8.jpg", "CC BY-SA 4.0", "Daniel Whistler"),
      commonsPhoto("File:Ski Mountain Park, São Roque - SP 7.jpg", "Área turística do Ski Mountain Park em São Roque", 3468, 4624, "https://upload.wikimedia.org/wikipedia/commons/5/59/Ski_Mountain_Park%2C_S%C3%A3o_Roque_-_SP_7.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Ski_Mountain_Park%2C_S%C3%A3o_Roque_-_SP_7.jpg/1280px-Ski_Mountain_Park%2C_S%C3%A3o_Roque_-_SP_7.jpg", "CC BY-SA 4.0", "Daniel Whistler")
    ]
  },
  {
    key: "atibaia",
    aliases: ["atibaia-sp"],
    destinationName: "Atibaia, SP",
    photos: [
      commonsPhoto("File:Pedra Grande, Atibaia - SP, Nov2014.jpg", "Pedra Grande em Atibaia", 3456, 2304, "https://upload.wikimedia.org/wikipedia/commons/c/c0/Pedra_Grande%2C_Atibaia_-_SP%2C_Nov2014.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Pedra_Grande%2C_Atibaia_-_SP%2C_Nov2014.jpg/1280px-Pedra_Grande%2C_Atibaia_-_SP%2C_Nov2014.jpg", "CC BY-SA 2.0", "Ana Paula Hirama"),
      commonsPhoto("File:Parque Edmundo Zanoni, Atibaia 2018 07.jpg", "Parque Edmundo Zanoni em Atibaia", 5184, 3456, "https://upload.wikimedia.org/wikipedia/commons/0/0c/Parque_Edmundo_Zanoni%2C_Atibaia_2018_07.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Parque_Edmundo_Zanoni%2C_Atibaia_2018_07.jpg/1280px-Parque_Edmundo_Zanoni%2C_Atibaia_2018_07.jpg", "CC BY-SA 4.0", ""),
      commonsPhoto("File:Parque Edmundo Zanoni, Atibaia 2018 13.jpg", "Lago e área verde do Parque Edmundo Zanoni em Atibaia", 5184, 3456, "https://upload.wikimedia.org/wikipedia/commons/f/f6/Parque_Edmundo_Zanoni%2C_Atibaia_2018_13.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Parque_Edmundo_Zanoni%2C_Atibaia_2018_13.jpg/1280px-Parque_Edmundo_Zanoni%2C_Atibaia_2018_13.jpg", "CC BY-SA 4.0", "")
    ]
  },
  {
    key: "aguas-de-lindoia",
    aliases: ["aguas-de-lindoia-sp"],
    destinationName: "Aguas de Lindoia, SP",
    photos: [
      officialPhoto("Bendito Cacao Family Resort - piscina", "Piscina e fachada do Bendito Cacao Family Resort em Aguas de Lindoia", 1920, 1080, "https://lirp.cdn-website.com/63940162/dms3rep/multi/opt/bendito-aguas-banner-01-1920w.webp", "https://www.benditocacaoresort.com.br/bendito-lindoia", "Bendito Cacao Family Resort"),
      officialPhoto("Bendito Cacao Family Resort - acomodacoes", "Area de acomodacoes do Bendito Cacao Family Resort em Aguas de Lindoia", 1920, 1280, "https://lirp.cdn-website.com/63940162/dms3rep/multi/opt/bendito-aguas-acomodacoes-1920w.jpg", "https://www.benditocacaoresort.com.br/bendito-lindoia", "Bendito Cacao Family Resort"),
      officialPhoto("Bendito Cacao Family Resort - lazer", "Area de lazer do Bendito Cacao Family Resort em Aguas de Lindoia", 1920, 1280, "https://lirp.cdn-website.com/63940162/dms3rep/multi/opt/5H9A5178-d0b40575-1920w.jpg", "https://www.benditocacaoresort.com.br/bendito-lindoia", "Bendito Cacao Family Resort")
    ]
  },
  {
    key: "olimpia",
    aliases: ["olimpia-sp"],
    destinationName: "Olímpia, SP",
    photos: [
      commonsPhoto("File:Thermas dos Laranjais, Olímpia - Piscina Semi Olímpica - panoramio.jpg", "Piscina no Thermas dos Laranjais em Olímpia", 4000, 3000, "https://upload.wikimedia.org/wikipedia/commons/e/e3/Thermas_dos_Laranjais%2C_Ol%C3%ADmpia_-_Piscina_Semi_Ol%C3%ADmpica_-_panoramio.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Thermas_dos_Laranjais%2C_Ol%C3%ADmpia_-_Piscina_Semi_Ol%C3%ADmpica_-_panoramio.jpg/1280px-Thermas_dos_Laranjais%2C_Ol%C3%ADmpia_-_Piscina_Semi_Ol%C3%ADmpica_-_panoramio.jpg", "CC BY-SA 3.0", "MARCO AURELIO ESPARZ"),
      commonsPhoto("File:Thermas dos Laranjais - Olímpia - Pedalinhos - panoramio.jpg", "Pedalinhos no Thermas dos Laranjais em Olímpia", 4000, 3000, "https://upload.wikimedia.org/wikipedia/commons/5/58/Thermas_dos_Laranjais_-_Ol%C3%ADmpia_-_Pedalinhos_-_panoramio.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Thermas_dos_Laranjais_-_Ol%C3%ADmpia_-_Pedalinhos_-_panoramio.jpg/1280px-Thermas_dos_Laranjais_-_Ol%C3%ADmpia_-_Pedalinhos_-_panoramio.jpg", "CC BY-SA 3.0", "MARCO AURELIO ESPARZ"),
      commonsPhoto("File:Hot Beach Parks and Resorts, Olimpia, Brazil.jpg", "Hot Beach em Olímpia", 4032, 3024, "https://upload.wikimedia.org/wikipedia/commons/6/6e/Hot_Beach_Parks_and_Resorts%2C_Olimpia%2C_Brazil.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Hot_Beach_Parks_and_Resorts%2C_Olimpia%2C_Brazil.jpg/1280px-Hot_Beach_Parks_and_Resorts%2C_Olimpia%2C_Brazil.jpg", "CC BY-SA 4.0", "")
    ]
  },
  {
    key: "litoral-norte-sp",
    aliases: ["guaruja-sp"],
    destinationName: "Guarujá, SP",
    photos: [
      commonsPhoto("File:Praia da Enseada 2.jpg", "Praia da Enseada no Guarujá", 5344, 3008, "https://upload.wikimedia.org/wikipedia/commons/6/69/Praia_da_Enseada_2.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Praia_da_Enseada_2.jpg/1280px-Praia_da_Enseada_2.jpg", "CC BY-SA 4.0", ""),
      commonsPhoto("File:ROGERIO CASSIMIRO acqua mundo GUARUJA SP (39077956510).jpg", "Acqua Mundo no Guarujá", 4961, 3307, "https://upload.wikimedia.org/wikipedia/commons/1/1b/ROGERIO_CASSIMIRO_acqua_mundo_GUARUJA_SP_%2839077956510%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/ROGERIO_CASSIMIRO_acqua_mundo_GUARUJA_SP_%2839077956510%29.jpg/1280px-ROGERIO_CASSIMIRO_acqua_mundo_GUARUJA_SP_%2839077956510%29.jpg", "CC BY-SA 2.0", "Rogério Cassimiro"),
      commonsPhoto("File:Morro do Maluf.jpg", "Morro do Maluf no Guarujá", 4961, 3307, "https://upload.wikimedia.org/wikipedia/commons/5/56/Morro_do_Maluf.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Morro_do_Maluf.jpg/1280px-Morro_do_Maluf.jpg", "CC BY-SA 4.0", "")
    ]
  },
  {
    key: "praia-do-forte",
    aliases: ["praia-do-forte-ba"],
    destinationName: "Praia do Forte, BA",
    photos: [
      commonsPhoto("File:SANTOS PRAIA DO FORTE BAHIA 2.JPG", "Praia do Forte na Bahia", 4320, 3240, "https://upload.wikimedia.org/wikipedia/commons/4/44/SANTOS_PRAIA_DO_FORTE_BAHIA_2.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/SANTOS_PRAIA_DO_FORTE_BAHIA_2.JPG/1280px-SANTOS_PRAIA_DO_FORTE_BAHIA_2.JPG", "CC BY-SA 4.0", ""),
      commonsPhoto("File:Projeto Tamar - Praia do Forte, Bahia (7291055402).jpg", "Projeto Tamar na Praia do Forte", 3872, 2592, "https://upload.wikimedia.org/wikipedia/commons/d/d0/Projeto_Tamar_-_Praia_do_Forte%2C_Bahia_%287291055402%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Projeto_Tamar_-_Praia_do_Forte%2C_Bahia_%287291055402%29.jpg/1280px-Projeto_Tamar_-_Praia_do_Forte%2C_Bahia_%287291055402%29.jpg", "CC BY-SA 2.0", ""),
      commonsPhoto("File:Casa da Torre Garcia D Àvila - Praia do Forte. Foto Rita Barreto - Bahiatursa (8835040443).jpg", "Castelo Garcia D'Ávila na Praia do Forte", 4288, 2848, "https://upload.wikimedia.org/wikipedia/commons/2/25/Casa_da_Torre_Garcia_D_%C3%80vila_-_Praia_do_Forte._Foto_Rita_Barreto_-_Bahiatursa_%288835040443%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Casa_da_Torre_Garcia_D_%C3%80vila_-_Praia_do_Forte._Foto_Rita_Barreto_-_Bahiatursa_%288835040443%29.jpg/1280px-Casa_da_Torre_Garcia_D_%C3%80vila_-_Praia_do_Forte._Foto_Rita_Barreto_-_Bahiatursa_%288835040443%29.jpg", "CC BY-SA 2.0", "Rita Barreto / Bahiatursa")
    ]
  },
  {
    key: "porto-de-galinhas",
    aliases: ["porto-de-galinhas-pe"],
    destinationName: "Porto de Galinhas, PE",
    photos: [
      commonsPhoto("File:Porto de galinhas 019.JPG", "Praia em Porto de Galinhas", 3072, 2304, "https://upload.wikimedia.org/wikipedia/commons/a/aa/Porto_de_galinhas_019.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Porto_de_galinhas_019.JPG/1280px-Porto_de_galinhas_019.JPG", "CC BY-SA 3.0", ""),
      commonsPhoto("File:Praia de Muro alto - Porto de Galinhas - Pernambuco - 02.jpg", "Praia de Muro Alto em Porto de Galinhas", 5184, 3888, "https://upload.wikimedia.org/wikipedia/commons/a/ae/Praia_de_Muro_alto_-_Porto_de_Galinhas_-_Pernambuco_-_02.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Praia_de_Muro_alto_-_Porto_de_Galinhas_-_Pernambuco_-_02.jpg/1280px-Praia_de_Muro_alto_-_Porto_de_Galinhas_-_Pernambuco_-_02.jpg", "CC BY-SA 4.0", ""),
      commonsPhoto("File:Piscinas Naturais de Porto de Galinhas - Pernambuco.jpg", "Piscinas naturais de Porto de Galinhas", 4608, 3456, "https://upload.wikimedia.org/wikipedia/commons/9/99/Piscinas_Naturais_de_Porto_de_Galinhas_-_Pernambuco.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Piscinas_Naturais_de_Porto_de_Galinhas_-_Pernambuco.jpg/1280px-Piscinas_Naturais_de_Porto_de_Galinhas_-_Pernambuco.jpg", "CC BY-SA 4.0", "")
    ]
  },
  {
    key: "maceio-maragogi",
    aliases: ["maragogi-al"],
    destinationName: "Maragogi, AL",
    photos: [
      commonsPhoto("File:Maragogi beach tourist.jpg", "Praia em Maragogi", 3072, 2304, "https://upload.wikimedia.org/wikipedia/commons/c/c1/Maragogi_beach_tourist.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Maragogi_beach_tourist.jpg/1280px-Maragogi_beach_tourist.jpg", "Creative Commons", ""),
      commonsPhoto("File:Praia de Antunes (51724006234).jpg", "Praia de Antunes em Maragogi", 2988, 1992, "https://upload.wikimedia.org/wikipedia/commons/2/2d/Praia_de_Antunes_%2851724006234%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Praia_de_Antunes_%2851724006234%29.jpg/1280px-Praia_de_Antunes_%2851724006234%29.jpg", "CC BY-SA 2.0", ""),
      commonsPhoto("File:Barra Grande - Alagoas - Brasil. (11409760916).jpg", "Barra Grande em Maragogi", 5184, 3456, "https://upload.wikimedia.org/wikipedia/commons/3/33/Barra_Grande_-_Alagoas_-_Brasil._%2811409760916%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Barra_Grande_-_Alagoas_-_Brasil._%2811409760916%29.jpg/1280px-Barra_Grande_-_Alagoas_-_Brasil._%2811409760916%29.jpg", "CC BY-SA 2.0", "")
    ]
  },
  {
    key: "foz-do-iguacu",
    aliases: ["foz-do-iguacu-pr"],
    destinationName: "Foz do Iguaçu, PR",
    photos: [
      commonsPhoto("File:00 1838 Iguazu Falls from the Brazilian side.jpg", "Cataratas do Iguaçu vistas pelo lado brasileiro", 3300, 2200, "https://upload.wikimedia.org/wikipedia/commons/4/48/00_1838_Iguazu_Falls_from_the_Brazilian_side.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/00_1838_Iguazu_Falls_from_the_Brazilian_side.jpg/1280px-00_1838_Iguazu_Falls_from_the_Brazilian_side.jpg", "CC BY-SA 4.0", ""),
      commonsPhoto("File:Parque das Aves, Foz do Iguacu, Brazil-12Feb2011.jpg", "Parque das Aves em Foz do Iguaçu", 4032, 3024, "https://upload.wikimedia.org/wikipedia/commons/b/b3/Parque_das_Aves%2C_Foz_do_Iguacu%2C_Brazil-12Feb2011.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Parque_das_Aves%2C_Foz_do_Iguacu%2C_Brazil-12Feb2011.jpg/1280px-Parque_das_Aves%2C_Foz_do_Iguacu%2C_Brazil-12Feb2011.jpg", "CC BY-SA 3.0", ""),
      commonsPhoto("File:Marcos das Tres Fronteiras - Foz do Iguacu.jpg", "Marco das Três Fronteiras em Foz do Iguaçu", 4608, 3456, "https://upload.wikimedia.org/wikipedia/commons/a/ac/Marcos_das_Tres_Fronteiras_-_Foz_do_Iguacu.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Marcos_das_Tres_Fronteiras_-_Foz_do_Iguacu.jpg/1280px-Marcos_das_Tres_Fronteiras_-_Foz_do_Iguacu.jpg", "CC BY-SA 4.0", "")
    ]
  },
  {
    key: "gramado",
    aliases: ["gramado-rs"],
    destinationName: "Gramado, RS",
    photos: [
      commonsPhoto("File:Lago Negro (Gramado) 0.JPG", "Lago Negro em Gramado", 4288, 3216, "https://upload.wikimedia.org/wikipedia/commons/c/c6/Lago_Negro_%28Gramado%29_0.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Lago_Negro_%28Gramado%29_0.JPG/1280px-Lago_Negro_%28Gramado%29_0.JPG", "CC BY-SA 4.0", ""),
      commonsPhoto("File:Mini Mundo (Gramado).JPG", "Mini Mundo em Gramado", 4288, 3216, "https://upload.wikimedia.org/wikipedia/commons/9/9a/Mini_Mundo_%28Gramado%29.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Mini_Mundo_%28Gramado%29.JPG/1280px-Mini_Mundo_%28Gramado%29.JPG", "CC BY-SA 4.0", ""),
      commonsPhoto("File:RenatoSoares SnowLand Gramado RS (40193258034).jpg", "Snowland em Gramado", 7360, 4912, "https://upload.wikimedia.org/wikipedia/commons/0/0d/RenatoSoares_SnowLand_Gramado_RS_%2840193258034%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/RenatoSoares_SnowLand_Gramado_RS_%2840193258034%29.jpg/1280px-RenatoSoares_SnowLand_Gramado_RS_%2840193258034%29.jpg", "CC BY-SA 2.0", "Renato Soares")
    ]
  },
  {
    key: "beto-carrero-penha",
    aliases: ["penha-sc"],
    destinationName: "Penha, SC",
    photos: [
      commonsPhoto("File:BETO CARRERO WORLD, Penha, Santa Catarina, Brasil - panoramio.jpg", "Beto Carrero World em Penha", 4000, 3000, "https://upload.wikimedia.org/wikipedia/commons/f/fc/BETO_CARRERO_WORLD%2C_Penha%2C_Santa_Catarina%2C_Brasil_-_panoramio.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/BETO_CARRERO_WORLD%2C_Penha%2C_Santa_Catarina%2C_Brasil_-_panoramio.jpg/1280px-BETO_CARRERO_WORLD%2C_Penha%2C_Santa_Catarina%2C_Brasil_-_panoramio.jpg", "CC BY-SA 3.0", ""),
      commonsPhoto("File:Vista do Beto Carrero World a partir da roda-gigante, Penha SC.JPG", "Vista do Beto Carrero World em Penha", 4380, 2920, "https://upload.wikimedia.org/wikipedia/commons/0/09/Vista_do_Beto_Carrero_World_a_partir_da_roda-gigante%2C_Penha_SC.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Vista_do_Beto_Carrero_World_a_partir_da_roda-gigante%2C_Penha_SC.JPG/1280px-Vista_do_Beto_Carrero_World_a_partir_da_roda-gigante%2C_Penha_SC.JPG", "CC BY-SA 4.0", ""),
      commonsPhoto("File:Praia de Armação do Itapocorói, Penha - SC, Brazil - panoramio (3).jpg", "Praia de Armação do Itapocorói em Penha", 5184, 3456, "https://upload.wikimedia.org/wikipedia/commons/2/2b/Praia_de_Arma%C3%A7%C3%A3o_do_Itapocor%C3%B3i%2C_Penha_-_SC%2C_Brazil_-_panoramio_%283%29.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Praia_de_Arma%C3%A7%C3%A3o_do_Itapocor%C3%B3i%2C_Penha_-_SC%2C_Brazil_-_panoramio_%283%29.jpg/1280px-Praia_de_Arma%C3%A7%C3%A3o_do_Itapocor%C3%B3i%2C_Penha_-_SC%2C_Brazil_-_panoramio_%283%29.jpg", "CC BY-SA 3.0", "")
    ]
  },
  {
    key: "buenos-aires",
    aliases: ["buenos-aires-argentina"],
    destinationName: "Buenos Aires, Argentina",
    photos: [
      commonsPhoto("File:Jardin Japones 1.JPG", "Jardín Japonés em Buenos Aires", 2048, 1536, "https://upload.wikimedia.org/wikipedia/commons/3/32/Jardin_Japones_1.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Jardin_Japones_1.JPG/1280px-Jardin_Japones_1.JPG", "CC BY-SA 3.0", "Edgar Andrés Ochoa"),
      commonsPhoto("File:Buenos Aires - La Boca - Caminito - 200807i.jpg", "Caminito em La Boca, Buenos Aires", 3906, 2602, "https://upload.wikimedia.org/wikipedia/commons/8/8b/Buenos_Aires_-_La_Boca_-_Caminito_-_200807i.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Buenos_Aires_-_La_Boca_-_Caminito_-_200807i.jpg/1280px-Buenos_Aires_-_La_Boca_-_Caminito_-_200807i.jpg", "CC BY-SA 3.0", ""),
      commonsPhoto("File:Calle Caminito in La Boca, Buenos Aires-1.JPG", "Rua Caminito em La Boca, Buenos Aires", 5184, 3456, "https://upload.wikimedia.org/wikipedia/commons/d/da/Calle_Caminito_in_La_Boca%2C_Buenos_Aires-1.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Calle_Caminito_in_La_Boca%2C_Buenos_Aires-1.JPG/1280px-Calle_Caminito_in_La_Boca%2C_Buenos_Aires-1.JPG", "CC BY-SA 4.0", "")
    ]
  },
  {
    key: "orlando",
    aliases: ["orlando-fl"],
    destinationName: "Orlando, FL",
    photos: [
      commonsPhoto("File:Sunny day on Disney Springs, USA.jpg", "Disney Springs em Orlando", 3024, 4032, "https://upload.wikimedia.org/wikipedia/commons/4/46/Sunny_day_on_Disney_Springs%2C_USA.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Sunny_day_on_Disney_Springs%2C_USA.jpg/1280px-Sunny_day_on_Disney_Springs%2C_USA.jpg", "CC BY-SA 4.0", ""),
      commonsPhoto("File:At Disney's Animal Kingdom 1.JPG", "Disney's Animal Kingdom em Orlando", 2272, 1704, "https://upload.wikimedia.org/wikipedia/commons/b/b3/At_Disney%27s_Animal_Kingdom_1.JPG", "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/At_Disney%27s_Animal_Kingdom_1.JPG/1280px-At_Disney%27s_Animal_Kingdom_1.JPG", "CC BY-SA 3.0", ""),
      commonsPhoto("File:Magic Kingdom, Disney World.jpg", "Magic Kingdom em Orlando", 4497, 2786, "https://upload.wikimedia.org/wikipedia/commons/2/26/Magic_Kingdom%2C_Disney_World.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Magic_Kingdom%2C_Disney_World.jpg/1280px-Magic_Kingdom%2C_Disney_World.jpg", "CC BY-SA 4.0", "")
    ]
  }
];
