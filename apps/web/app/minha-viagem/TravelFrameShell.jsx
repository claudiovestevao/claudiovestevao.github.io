"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

export default function TravelFrameShell({ documentHtml }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="travel-frame-shell" aria-busy={!loaded}>
      <div
        className={`travel-frame-loading ${loaded ? "is-loaded" : ""}`}
        role="status"
        aria-live="polite"
      >
        <LoaderCircle aria-hidden="true" size={24} />
        <div>
          <b>Abrindo Minha Viagem</b>
          <span>Preparando roteiro, reservas e dados da familia...</span>
        </div>
      </div>
      <iframe
        allow="microphone; camera; geolocation"
        className="travel-frame"
        onLoad={() => setLoaded(true)}
        srcDoc={documentHtml}
        title="Agente da viagem Orlando 2026"
      />
    </div>
  );
}
