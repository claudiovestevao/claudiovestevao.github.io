export const conciergeQuizQuestions = [
  {
    id: "travel_goal",
    question: "O que esta viagem precisa resolver?",
    type: "single",
    options: ["Primeira viagem sem susto", "Descansar com estrutura", "Praia e piscina", "Natureza e ar livre", "Parque ou muita atividade"]
  },
  {
    id: "family_pace",
    question: "Qual ritmo combina com a sua família?",
    type: "single",
    options: ["Rotina bem previsível", "Flexível, mas com pausas", "Criança com bastante energia", "Pais querem conforto também"]
  },
  {
    id: "displacement_limit",
    question: "Qual deslocamento vocês toleram bem?",
    type: "single",
    options: ["Até 2h de carro", "Até 4h de carro", "Voo direto e traslado até 1h", "Aceito mais logística se valer muito"]
  },
  {
    id: "stay_style",
    question: "Que tipo de hospedagem faz mais sentido?",
    type: "single",
    options: ["Resort completo", "Hotel fazenda", "Praia com resort", "Cidade com passeios", "Apart-hotel com cozinha"]
  },
  {
    id: "budget_season_strategy",
    question: "Como orçamento e época pesam na decisão?",
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
    id: "comfort_needs",
    question: "O que precisa existir para você ficar tranquilo?",
    type: "multi",
    max: 3,
    options: ["Copa baby", "Copa baby 24h", "All inclusive", "Kids club", "Piscina aquecida", "Plano B para chuva", "Kitchenette/cozinha", "Não alugar carro"]
  },
  {
    id: "decision_profile",
    question: "Como vocês preferem decidir?",
    type: "single",
    options: ["Menos risco, mais certeza", "Melhor custo-benefício", "Melhor estrutura, mesmo mais caro", "Evitar lotação e filas"]
  },
  {
    id: "avoid_risks",
    question: "O que vocês querem evitar de qualquer jeito?",
    type: "multi",
    max: 3,
    options: ["Chegar tarde", "Traslado longo", "Estrada cansativa", "Fila e lotação", "Sem comida fácil", "Sem plano B para chuva", "Hotel só bonito na foto"]
  }
];
