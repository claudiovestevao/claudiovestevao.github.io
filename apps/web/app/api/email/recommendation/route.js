import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const email = String(payload.email || payload.to || "").trim();
  const consentContact = Boolean(payload.consentContact);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, message: "Informe um e-mail válido." }, { status: 400 });
  }
  if (!consentContact) {
    return NextResponse.json({ ok: false, message: "Consentimento é obrigatório para enviar o resumo." }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, message: "RESEND_API_KEY não configurada no servidor." }, { status: 503 });
  }

  const html = buildRecommendationEmail(payload);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.TRANSACTIONAL_EMAIL_FROM || "Concierge da Família <noreply@claudiocode.dev>",
      to: email,
      subject: payload.subject || "Seu resumo do Concierge da Família",
      html
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({
      ok: false,
      provider: "resend",
      message: data.message || "Falha ao enviar e-mail transacional."
    }, { status: response.status });
  }

  return NextResponse.json({
    ok: true,
    provider: "resend",
    id: data.id || null
  });
}

function buildRecommendationEmail(payload) {
  const destination = escapeHtml(payload.destination || payload.destinationName || "destino recomendado");
  const summary = escapeHtml(payload.summary || "Resumo preparado pelo Concierge da Família.");
  const link = escapeHtml(payload.link || "https://claudiocode.dev/concierge-da-familia");
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h1 style="margin:0 0 12px">Concierge da Família</h1>
      <p style="margin:0 0 16px">Seu resumo sobre <strong>${destination}</strong> está pronto.</p>
      <p style="margin:0 0 16px">${summary}</p>
      <p style="margin:0 0 20px">
        <a href="${link}" style="background:#0f5bd7;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">
          Abrir recomendação
        </a>
      </p>
      <p style="font-size:12px;color:#64748b">Você recebeu este e-mail porque autorizou contato no Concierge da Família.</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}
