import Link from "next/link";
import { ArrowLeft, CheckCircle2, MapPinned, ShieldCheck } from "lucide-react";
import DestinationExplorer from "@/components/DestinationExplorer";
import { searchDestinations } from "@/lib/destinations/repository";
import { parseDestinationSearchParams } from "@/lib/destinations/search";

export const dynamic = "force-dynamic";

export default async function ConciergeFamilyPage() {
  const initialResult = await searchDestinations(parseDestinationSearchParams({ limit: "48" }));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="container py-2 d-flex align-items-center justify-content-between gap-3">
          <Link className="brand-mark" href="/">
            <span aria-hidden="true">C</span>
            Concierge da Família
          </Link>
          <a className="ui-button ghost compact" href="/api/health">API online</a>
        </div>
      </header>

      <section className="container product-hero compact-hero">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-7">
            <Link className="text-decoration-none text-secondary fw-bold small d-inline-flex align-items-center gap-1 mb-3" href="/">
              <ArrowLeft size={15} /> agentes
            </Link>
            <div className="d-flex flex-column gap-3">
              <span className="ui-badge align-self-start"><MapPinned size={14} /> Mapa familiar a partir de SP</span>
              <h1 className="hero-title">Descubra no mapa onde vale viajar com sua família.</h1>
              <p className="hero-copy">
                Compare destinos por esforço, estrutura, idade das crianças e opções reais de estadia.
              </p>
            </div>
          </div>
          <div className="col-12 col-lg-5">
            <div className="trust-bar">
              <TrustItem icon={CheckCircle2} text={`${initialResult.totalKnown?.toLocaleString("pt-BR") || "170"} destinos ativos`} />
              <TrustItem icon={ShieldCheck} text="score familiar transparente" />
              <TrustItem icon={MapPinned} text="mapa real e filtros rápidos" />
            </div>
          </div>
        </div>
      </section>

      <section className="container pb-5">
        <DestinationExplorer initialResult={initialResult} />
      </section>
    </main>
  );
}

function TrustItem({ icon: Icon, text }) {
  return (
    <span>
      <Icon size={16} />
      {text}
    </span>
  );
}
