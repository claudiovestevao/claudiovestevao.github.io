import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const OPENAI_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";

export async function POST(request) {
  const auth = await ensurePrivateAccess(request, { action: "transcribe", csrf: true });
  if (!auth.ok) return auth.response;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, message: "OPENAI_API_KEY nao configurada no servidor." },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ ok: false, message: "Envie um audio valido." }, { status: 400 });
  }

  if (Number(file.size || 0) > MAX_AUDIO_BYTES) {
    return NextResponse.json({ ok: false, message: "Audio muito grande. O limite e 25 MB." }, { status: 413 });
  }

  const mime = String(file.type || "").toLowerCase();
  if (mime && !mime.startsWith("audio/") && mime !== "video/mp4" && mime !== "video/webm") {
    return NextResponse.json({ ok: false, message: "Formato de audio nao suportado." }, { status: 400 });
  }

  const date = String(form.get("date") || "").slice(0, 20);
  const openaiForm = new FormData();
  openaiForm.append("model", OPENAI_MODEL);
  openaiForm.append("file", file, cleanFileName(file.name || `diario-${date || "orlando"}.webm`));
  openaiForm.append("language", "pt");
  openaiForm.append(
    "prompt",
    "Transcreva em portugues brasileiro. Contexto: diario da viagem de Orlando de Vitor, Nathalie, Luiza e Arthur."
  );

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: openaiForm
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { ok: false, message: data?.error?.message || `OpenAI retornou ${response.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    model: OPENAI_MODEL,
    text: String(data.text || "").trim()
  });
}

function cleanFileName(value) {
  return String(value || "audio.webm")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .slice(0, 90) || "audio.webm";
}
