import Link from "next/link";
import { ArrowLeft, Database, GitBranch, RefreshCcw, ShieldCheck } from "lucide-react";
import DestinationExplorer from "@/components/DestinationExplorer";
import { searchDestinations } from "@/lib/destinations/repository";
import { parseDestinationSearchParams } from "@/lib/destinations/search";

export const dynamic = "force-dynamic";

export default async function ConciergeFamilyPage() {
  const initialResult = await searchDestinations(parseDestinationSearchParams({ limit: "32" }));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="container py-2 d-flex align-items-center justify-content-between gap-3">
          <Link className="brand-mark" href="/">
            <span aria-hidden="true">C</span>
            Concierge da Família
          </Link>
          <a className="btn btn-sm btn-outline-primary fw-bold" href="/agentes/concierge-da-familia/">
            Versão estática
          </a>
        </div>
      </header>

      <section className="container product-hero">
        <div className="row g-4 align-items-end">
          <div className="col-12 col-lg-8">
            <Link className="text-decoration-none text-secondary fw-bold small d-inline-flex align-items-center gap-1 mb-3" href="/">
              <ArrowLeft size={15} /> agentes
            </Link>
            <div className="d-flex flex-column gap-3">
              <span className="badge-soft align-self-start">Next.js · Supabase-ready · 1001 destinos</span>
              <h1 className="hero-title">Descubra destinos familiares com dados, não achismo.</h1>
              <p className="hero-copy">
                Mapa widescreen, busca server-side, catálogo nacional e pipeline de enriquecimento para Google Places, rotas, fotos, eventos e hospedagens.
              </p>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="row g-2">
              <Metric value={initialResult.totalKnown?.toLocaleString("pt-BR") || "1.001"} label="destinos base" />
              <Metric value="27" label="UFs cobertas" />
              <Metric value="API" label="server-side" />
              <Metric value="Cron" label="enriquecimento" />
            </div>
          </div>
        </div>
      </section>

      <section className="container pb-4">
        <DestinationExplorer initialResult={initialResult} />
      </section>

      <section className="container pb-5">
        <div className="ops-grid">
          <OpsItem icon={Database} title="Supabase Postgres" text="Busca e catálogo preparados para tabela indexada, RLS e dados separados por origem." />
          <OpsItem icon={ShieldCheck} title="APIs protegidas" text="Chamadas externas ficam em API routes/Edge Functions, sem chave secreta no frontend." />
          <OpsItem icon={RefreshCcw} title="Fila e cron" text="Endpoint de cron enfileira enriquecimento por destino para rodar em Vercel ou worker." />
        </div>
        <div className="surface mt-3 p-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <GitBranch className="text-primary" size={20} />
            <span className="fw-bold">Deploy alvo: Vercel/Cloudflare. GitHub Pages permanece como fallback estático.</span>
          </div>
          <a className="btn btn-primary fw-bold" href="/api/health">Ver saúde da API</a>
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label }) {
  return (
    <div className="col-6">
      <div className="metric">
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function OpsItem({ icon: Icon, title, text }) {
  return (
    <div className="ops-item">
      <Icon size={24} />
      <h2 className="h5 mt-3 mb-2">{title}</h2>
      <p className="text-secondary mb-0">{text}</p>
    </div>
  );
}
