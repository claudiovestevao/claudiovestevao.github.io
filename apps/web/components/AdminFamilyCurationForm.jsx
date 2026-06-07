"use client";

import { useState, useTransition } from "react";
import { Camera, CheckCircle2, Hotel, Loader2, Lock, Send, ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "Identificacao da experiencia",
    fields: [
      ["respondentName", "Quem esta respondendo?", "ex.: Claudio, Flavia"],
      ["respondentRole", "Olhar principal", "ex.: pai, mae, casal, avo/avo"],
      ["destinationName", "Destino/cidade", "ex.: Atibaia, Bonito, Pucón"],
      ["propertyName", "Hotel, resort, pousada ou chale", "nome exato se lembrar"],
      ["propertyWebsite", "Site ou Booking/Google do hotel", "link opcional"],
      ["visitPeriod", "Quando voces foram?", "mes/ano, feriado, ferias, baixa temporada"],
      ["travelParty", "Quem viajou?", "adultos, criancas e idades na epoca"],
      ["roomType", "Tipo de quarto", "standard, familia, conjugado, chale, villa"]
    ]
  },
  {
    title: "Sono e rotina de bebe/crianca",
    fields: [
      ["cribReality", "O berco era bom de verdade?", "tamanho, colchao, estado, foi montado antes?"],
      ["blackoutNoise", "Quarto ajudava no sono?", "blackout, barulho, corredor, musica, gerador, obra"],
      ["roomLayout", "Layout funcionava para crianca dormir?", "cama perto do berco, divisoria, varanda, tomada, banheiro"],
      ["napReality", "Dava para respeitar soneca?", "distancia ate piscina/restaurante, barulho diurno, flexibilidade"],
      ["bathBabySetup", "Banho e troca foram faceis?", "banheira, bancada, chuveiro, piso, espaco para fralda"]
    ]
  },
  {
    title: "Alimentacao sem drama",
    fields: [
      ["babyFoodSupport", "Tinha apoio real para papinha/mamadeira?", "microondas, copa baby, mixer, lava mamadeira, leite"],
      ["restaurantWithKids", "Restaurante era tranquilo com crianca?", "cadeirao, espera, barulho, espaco kids perto, horario"],
      ["kidsMenuQuality", "Menu infantil era bom ou so batata e nuggets?", "opcoes saudaveis, frutas, arroz/feijao, alergias"],
      ["earlyFood", "Tinha comida no horario da crianca?", "cafe cedo, jantar cedo, room service, lanches"],
      ["outsideFood", "Da para comer fora sem perrengue?", "restaurantes proximos, mercado, farmacia, delivery"]
    ]
  },
  {
    title: "Piscina, praia e lazer infantil",
    fields: [
      ["poolReality", "Piscina era realmente boa para crianca?", "profundidade, aquecida, sombra, piso, salva-vidas"],
      ["babyPool", "Bebe pequeno aproveita?", "piscina rasa, agua quente, sombra, barulho, fraldario perto"],
      ["beachAccess", "Se tinha praia: acesso era facil?", "areia, escada, carrinho, mar calmo, barraca, ducha"],
      ["kidsClubTruth", "Kids club funcionava de verdade?", "idade minima, pais ficam junto, equipe, horario, atividades"],
      ["rainPlan", "Se chover, salva a viagem?", "brinquedoteca coberta, sala de jogos, cinema, monitoria indoor"]
    ]
  },
  {
    title: "Logistica que site nenhum conta",
    fields: [
      ["strollerReality", "Carrinho de bebe circula bem?", "rampa, elevador, pedra, areia, grama, distancias"],
      ["walkingFatigue", "Quanto os pais andam por dia?", "quarto-restaurante-piscina, subidas, carrinho no colo"],
      ["parkingArrival", "Chegada/check-in foi suave?", "fila, manobrista, mala, quarto pronto, recepcao com crianca cansada"],
      ["medicalNearby", "Emergencia seria simples?", "farmacia, hospital, pediatra, sinal de celular, estrada a noite"],
      ["hiddenCosts", "Custos escondidos ou chatos", "estacionamento, recreacao paga, bebidas, passeio obrigatorio"]
    ]
  },
  {
    title: "Seguranca e perrengues invisiveis",
    fields: [
      ["safetyConcerns", "Algo te deixou inseguro?", "varanda, tomada, escada, piscina aberta, rio, animais, mosquito"],
      ["hygieneReality", "Limpeza para familia exigente", "quarto, banheiro, restaurante, cadeirao, brinquedoteca"],
      ["staffEmpathy", "Equipe entendia familia com crianca?", "resolveram rapido, tinham paciencia, anteciparam necessidades"],
      ["worstPerrengue", "Qual foi o maior perrengue real?", "o que quase estragou ou cansou demais"],
      ["magicMoment", "Qual detalhe encantou as criancas/pais?", "algo que fez voces pensarem: valeu a pena"]
    ]
  },
  {
    title: "Veredito de curadoria",
    fields: [
      ["bestAge", "Melhor idade para aproveitar", "0+, 2+, 4+, 6+, 8+ e por que"],
      ["avoidAge", "Para qual idade voce evitaria?", "bebe de colo, toddler, crianca agitada, etc."],
      ["familyProfileFit", "Para qual familia combina?", "descanso, aventura, resort, gastronomia, economia, luxo"],
      ["semPerrengueTip", "Se fosse indicar para amigos, qual seria a estrategia sem perrengue?", "o que reservar, evitar, pedir antes"],
      ["bookingQuestion", "Que pergunta obrigatoria fariamos ao hotel antes de reservar?", "a pergunta que evita dor de cabeca"]
    ]
  }
];

const scores = [
  ["sleepScore", "Sono/rotina"],
  ["foodScore", "Alimentacao"],
  ["babyScore", "Bebe 0-2"],
  ["toddlerScore", "Crianca 3-5"],
  ["kidsScore", "Crianca 6-10"],
  ["strollerScore", "Carrinho/acesso"],
  ["rainScore", "Plano de chuva"],
  ["parentRestScore", "Descanso dos pais"],
  ["overallFamilyScore", "Nota familia geral"]
];

export default function AdminFamilyCurationForm() {
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [isPending, startTransition] = useTransition();

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus({ type: "idle", message: "" });

    startTransition(async () => {
      const response = await fetch("/api/admin/family-curation", {
        method: "POST",
        body: data
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) {
        setStatus({ type: "error", message: json.message || "Nao consegui salvar a curadoria." });
        return;
      }
      form.reset();
      setStatus({ type: "success", message: `Curadoria salva. ID ${json.id}. Fotos: ${json.photos}.` });
    });
  }

  return (
    <form className="admin-curation-form" onSubmit={submit}>
      <section className="admin-access-card">
        <div>
          <span className="ui-badge"><Lock size={14} /> Admin</span>
          <h2>Curadoria que so familia real sabe responder</h2>
          <p>Preencha sem pressa. O objetivo e capturar detalhe pratico: sono, comida, carrinho, piscina, chuva, equipe e perrengues invisiveis.</p>
        </div>
        <label>
          Senha admin
          <input name="password" type="password" inputMode="numeric" required placeholder="senha" />
        </label>
      </section>

      {sections.map((section) => (
        <section className="admin-question-section" key={section.title}>
          <h3>{section.title}</h3>
          <div className="admin-question-grid">
            {section.fields.map(([name, label, placeholder]) => (
              <label key={name}>
                {label}
                <textarea name={name} placeholder={placeholder} rows={name.includes("Summary") ? 5 : 3} />
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="admin-question-section">
        <h3>Notas internas de curadoria</h3>
        <div className="admin-score-grid">
          {scores.map(([name, label]) => (
            <label key={name}>
              {label}
              <input name={name} type="number" min="0" max="10" step="0.5" placeholder="0 a 10" />
            </label>
          ))}
        </div>
      </section>

      <section className="admin-question-section">
        <h3>Fotos reais da familia</h3>
        <div className="admin-photo-box">
          <Camera size={22} />
          <div>
            <b>Suba fotos que ajudem a curadoria</b>
            <p>Boas fotos: quarto, berco, banheiro, copa baby, piscina infantil, brinquedoteca, restaurante, acesso com carrinho, praia/estrutura e qualquer perrengue real.</p>
          </div>
          <input name="photos" type="file" accept="image/*" multiple />
        </div>
        <label className="admin-wide-field">
          Observacoes sobre as fotos
          <textarea name="photoNotes" rows={4} placeholder="ex.: foto 1 mostra berco; foto 2 mostra distancia da piscina; foto 3 mostra escada ruim para carrinho" />
        </label>
      </section>

      <section className="admin-submit-bar">
        <div>
          <ShieldCheck size={18} />
          <span>Salva em area privada no Supabase Storage. Nada disso aparece publicamente sem curadoria.</span>
        </div>
        <button className="ui-button primary" disabled={isPending}>
          {isPending ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          Salvar curadoria
        </button>
      </section>

      {status.message ? (
        <div className={`admin-status ${status.type}`}>
          {status.type === "success" ? <CheckCircle2 size={18} /> : <Lock size={18} />}
          {status.message}
        </div>
      ) : null}
    </form>
  );
}
