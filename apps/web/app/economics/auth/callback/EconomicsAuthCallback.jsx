"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PiggyBank } from "lucide-react";

export default function EconomicsAuthCallback() {
  const [message, setMessage] = useState("Validando seu Gmail...");

  useEffect(() => {
    let cancelled = false;

    async function finishLogin() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const nextPath = safeNextPath(query.get("next"));
      const error = hash.get("error_description") || query.get("error_description") || query.get("error");
      const accessToken = hash.get("access_token");

      if (error) {
        window.location.replace("/economics?erro=google");
        return;
      }

      if (!accessToken) {
        setMessage("Nao recebi a sessao do Google. Tente entrar novamente.");
        return;
      }

      const response = await fetch("/economics/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ access_token: accessToken })
      });

      if (cancelled) return;

      if (response.ok) {
        window.history.replaceState(null, "", "/economics/auth/callback");
        window.location.replace(nextPath);
        return;
      }

      if (response.status === 403) {
        window.location.replace("/economics?erro=unauthorized");
        return;
      }

      window.location.replace("/economics?erro=session");
    }

    finishLogin().catch(() => {
      if (!cancelled) setMessage("Nao consegui validar agora. Tente entrar novamente.");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="economics-gate-page">
      <section className="economics-gate-card" aria-labelledby="economics-callback-title">
        <div className="economics-gate-icon" aria-hidden="true">
          <PiggyBank size={28} />
        </div>
        <h1 id="economics-callback-title">Entrando no Economics</h1>
        <p>{message}</p>
        <Link className="economics-google-button" href="/economics">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}

function safeNextPath(value) {
  const nextPath = String(value || "/economics").trim();
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/economics";
  if (nextPath.startsWith("/kanban")) return "/kanban";
  if (nextPath.startsWith("/economics")) return "/economics";
  return "/economics";
}
