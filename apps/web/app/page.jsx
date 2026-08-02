import Link from "next/link";
import {
  ArrowRight,
  Columns3,
  Gift,
  LockKeyhole,
  Map,
  PiggyBank,
  PlaneTakeoff
} from "lucide-react";

const privateAreas = [
  {
    href: "/minha-viagem",
    title: "Minha Viagem",
    text: "Roteiro, check-ins, diário, vouchers, ingressos, seguros e compras de Orlando.",
    metric: "Diário + PDFs",
    icon: PlaneTakeoff,
    tone: "travel",
    featured: true
  },
  {
    href: "/economics",
    title: "Economics",
    text: "Documentos, decisões e controles financeiros da família.",
    metric: "Finanças",
    icon: PiggyBank,
    tone: "money"
  },
  {
    href: "/kanban",
    title: "Kanban",
    text: "Tarefas de Vitor e Nathalie, com prioridades, responsáveis e calendário.",
    metric: "Operação",
    icon: Columns3,
    tone: "work"
  },
  {
    href: "/festa-luiza/",
    title: "Site Luiza",
    text: "Espaço reservado para os momentos e materiais da Luiza.",
    metric: "Memória",
    icon: Gift,
    tone: "party"
  }
];

const guestAreas = [
  {
    href: "/concierge-da-familia",
    title: "Concierge da Família",
    text: "Destinos familiares com mapa, filtros, hotéis e score para decidir.",
    metric: "Mapa + score",
    icon: Map,
    tone: "atlas"
  }
];

export default function HomePage() {
  return (
    <main className="app-shell home-hub-page">
      <Topbar />

      <section className="container home-access-page" aria-labelledby="home-title">
        <header className="home-access-header">
          <span>Claudio Code</span>
          <h1 id="home-title">Agentes para produtividade e bem estar</h1>
        </header>

        <AccessSection icon={LockKeyhole} title="Áreas pessoais" items={privateAreas} privateArea />
        <AccessSection icon={Map} title="Área do convidado" items={guestAreas} />
      </section>
    </main>
  );
}

function AccessSection({ icon: Icon, items, privateArea, title }) {
  return (
    <section className="home-access-section" aria-label={title}>
      <div className="home-access-section-head">
        <span className={privateArea ? "is-private" : "is-guest"}>
          <Icon size={16} />
          {title}
        </span>
      </div>
      <div className="home-hub-grid">
        {items.map((item) => (
          <HubCard item={item} key={item.title} privateArea={privateArea} />
        ))}
      </div>
    </section>
  );
}

function HubCard({ item, privateArea }) {
  const Icon = item.icon;

  return (
    <Link
      className={`hub-card ${item.featured ? "is-featured" : ""}`}
      data-tone={item.tone}
      href={item.href}
    >
      <div className="hub-card-topline">
        <div className={`hub-card-icon ${item.tone === "travel" ? "is-magic" : ""}`}>
          {item.tone === "travel" ? <span className="hub-magic-ears"><span /></span> : <Icon size={22} />}
        </div>
        {privateArea ? (
          <span className="hub-card-status is-private"><LockKeyhole size={13} /> Protegido</span>
        ) : (
          <span className="hub-card-status">Convidado</span>
        )}
      </div>
      <div className="hub-card-title">
        <h3>{item.title}</h3>
      </div>
      <p>{item.text}</p>
      <div className="hub-card-footer">
        <span>{item.metric}</span>
        <b>Abrir <ArrowRight size={16} /></b>
      </div>
    </Link>
  );
}

function Topbar() {
  return (
    <header className="topbar">
      <div className="container py-2 d-flex align-items-center justify-content-between">
        <Link className="brand-mark" href="/">
          <span aria-hidden="true">C</span>
          Claudio Code
        </Link>
        <Link className="ui-button ghost compact" href="/concierge-da-familia">
          Área do convidado
        </Link>
      </div>
    </header>
  );
}
