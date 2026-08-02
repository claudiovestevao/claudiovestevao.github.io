"use client";

import { ArrowLeft } from "lucide-react";

export default function TravelBackButton({ fallback = "/minha-viagem", label = "Voltar" }) {
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign(fallback);
  }

  return (
    <button className="travel-back-link" type="button" onClick={goBack}>
      <ArrowLeft size={17} />
      {label}
    </button>
  );
}
