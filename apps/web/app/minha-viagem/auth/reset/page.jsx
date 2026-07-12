import TravelPasswordReset from "./TravelPasswordReset";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Criar senha | Minha Viagem",
  description: "Crie ou troque a senha da area privada Minha Viagem."
};

export default function MinhaViagemPasswordResetPage() {
  return <TravelPasswordReset />;
}
