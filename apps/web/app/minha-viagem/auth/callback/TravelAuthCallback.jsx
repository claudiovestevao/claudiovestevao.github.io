"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlaneTakeoff } from "lucide-react";

export default function TravelAuthCallback() {
  const [message, setMessage] = useState("Validando seu Gmail...");

  useEffect(() => {
    let cancelled = false;

    async function finishLogin() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const error = hash.get("error_description") || query.get("error_description") || query.get("error");
      const accessToken = hash.get("access_token");

      if (error) {
        window.location.replace(`/minha-viagem?erro=google`);
        return;
      }

      if (!accessToken) {
        setMessage("Não recebi a sessão do Google. Tente entrar novamente.");
        return;
      }

      const response = await fetch("/minha-viagem/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ access_token: accessToken })
      });

      if (cancelled) return;

      if (response.ok) {
        window.history.replaceState(null, "", "/minha-viagem/auth/callback");
        window.location.replace("/minha-viagem");
        return;
      }

      if (response.status === 403) {
        window.location.replace("/minha-viagem?erro=unauthorized");
        return;
      }

      window.location.replace("/minha-viagem?erro=session");
    }

    finishLogin().catch(() => {
      if (!cancelled) setMessage("Não consegui validar agora. Tente entrar novamente.");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="travel-gate-page">
      <section className="travel-gate-card" aria-labelledby="travel-callback-title">
        <div className="travel-gate-icon" aria-hidden="true">
          <PlaneTakeoff size={28} />
        </div>
        <h1 id="travel-callback-title">Entrando na viagem</h1>
        <p>{message}</p>
        <Link className="travel-google-button" href="/minha-viagem">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
