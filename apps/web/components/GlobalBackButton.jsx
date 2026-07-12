"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || pathname === "/") return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  return (
    <button className="global-back-button" onClick={goBack} type="button">
      <ArrowLeft size={17} />
      <span>Voltar</span>
    </button>
  );
}
