import { headers } from "next/headers";
import { redirect } from "next/navigation";
import TravelBackButton from "../TravelBackButton";
import PackingChecklist from "./PackingChecklist";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Checklist de Mala | Minha Viagem",
  description: "Checklist de mala da viagem de Orlando 2026."
};

export default async function ChecklistMalaPage() {
  const headerStore = await headers();
  const isUnlocked = headerStore.get("x-trip-access") === "1";

  if (!isUnlocked) {
    redirect("/minha-viagem");
  }

  return (
    <main className="travel-frame-page">
      <div className="travel-frame-bar">
        <TravelBackButton fallback="/minha-viagem" />
        <div>
          <b>Minha Viagem</b>
          <span>Checklist de mala</span>
        </div>
      </div>
      <PackingChecklist />
    </main>
  );
}
