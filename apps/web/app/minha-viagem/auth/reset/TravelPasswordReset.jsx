"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, PlaneTakeoff } from "lucide-react";

export default function TravelPasswordReset() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const accessToken = useMemo(() => {
    if (typeof window === "undefined") return "";
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return hash.get("access_token") || "";
  }, []);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const response = await fetch("/minha-viagem/api/auth/password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          access_token: accessToken,
          password
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus({ type: "error", message: data.message || "Nao consegui salvar a senha." });
        return;
      }

      window.history.replaceState(null, "", "/minha-viagem/auth/reset");
      window.location.replace("/minha-viagem");
    } catch {
      setStatus({ type: "error", message: "Falha de conexao. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="travel-gate-page">
      <section className="travel-gate-card" aria-labelledby="travel-reset-title">
        <div className="travel-gate-icon" aria-hidden="true">
          <PlaneTakeoff size={28} />
        </div>
        <span className="ui-badge travel-gate-badge">
          <KeyRound size={14} />
          Senha da viagem
        </span>
        <h1 id="travel-reset-title">Criar senha</h1>
        <p>Defina uma senha com pelo menos 8 caracteres para entrar depois sem depender do Google.</p>

        <form className="travel-auth-panel is-active" onSubmit={submit}>
          <label htmlFor="travel-new-password">Nova senha</label>
          <input
            autoComplete="new-password"
            id="travel-new-password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            type="password"
            value={password}
          />
          <button disabled={loading || !accessToken} type="submit">
            {loading ? "Salvando..." : "Salvar senha e entrar"}
          </button>
          {!accessToken ? (
            <small className="travel-auth-message" role="alert">
              Link inválido ou expirado. Peça um novo link de senha.
            </small>
          ) : null}
          {status.message ? (
            <small className={`travel-auth-message ${status.type === "error" ? "is-error" : "is-success"}`} role="alert">
              {status.message}
            </small>
          ) : null}
        </form>

        <Link className="travel-auth-secondary" href="/minha-viagem">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
