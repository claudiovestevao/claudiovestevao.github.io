export const conciergeQuizQuestions = [
  {
    id: "travel_goal",
    question: "O que esta viagem precisa resolver?",
    help: "Pense no resultado emocional da viagem, não no hotel ainda.",
    type: "single",
    options: ["Primeira viagem sem susto", "Descansar com estrutura", "Praia e piscina", "Natureza e ar livre", "Parque ou muita atividade"]
  },
  {
    id: "displacement_limit",
    question: "Qual deslocamento vocês toleram bem?",
    help: "Com criança, a viagem começa na porta de casa. Logística ruim estraga destino bom.",
    type: "single",
    options: ["Até 2h de carro", "Até 4h de carro", "Voo direto e traslado até 1h", "Aceito mais logística se valer muito"]
  },
  {
    id: "stay_style",
    question: "Que tipo de hospedagem deixaria todo mundo melhor?",
    help: "Aqui eu separo resort, hotel fazenda, praia, cidade com passeios e apart-hotel.",
    type: "single",
    options: ["Resort completo", "Hotel fazenda", "Praia com resort", "Cidade com passeios", "Apart-hotel com cozinha"]
  },
  {
    id: "comfort_needs",
    question: "O que precisa existir para você ficar tranquilo?",
    help: "Escolha só o que muda a experiência da sua família.",
    type: "multi",
    max: 3,
    options: ["Copa baby", "Copa baby 24h", "All inclusive", "Kids club", "Piscina aquecida", "Plano B para chuva", "Kitchenette/cozinha", "Não alugar carro"]
  },
  {
    id: "budget_season_strategy",
    question: "Como orçamento e época pesam na decisão?",
    help: "Esta resposta evita recomendar destino caro na pior semana do ano para a sua família.",
    type: "single",
    options: [
      "Alta temporada, quero segurança mesmo pagando mais",
      "Feriado curto, preciso logística simples",
      "Baixa temporada, prefiro custo-benefício",
      "Verão/praia, aceito pagar mais pelo clima",
      "Data flexível, quero a melhor oportunidade"
    ]
  },
  {
    id: "budget_total",
    question: "Qual gasto total seria confortável?",
    help: "Não precisa ser exato. É só para calibrar destino, hotel e época.",
    type: "single",
    options: ["Até R$ 1.500", "R$ 1.500 a R$ 3.000", "R$ 3.000 a R$ 5.000", "R$ 5.000 a R$ 8.000", "Acima de R$ 8.000", "Prefiro não informar"]
  },
  {
    id: "avoid_risks",
    question: "O que vocês querem evitar de qualquer jeito?",
    help: "Esses alertas pesam bastante no ranking final.",
    type: "multi",
    max: 3,
    options: ["Chegar tarde", "Traslado longo", "Estrada cansativa", "Fila e lotação", "Sem comida fácil", "Sem plano B para chuva", "Hotel só bonito na foto"]
  }
];
