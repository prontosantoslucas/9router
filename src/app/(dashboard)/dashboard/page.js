import Dashboard2Client from "@/app/dashboard2/Dashboard2Client";

export const metadata = {
  title: "Painel Principal & Lucas | MaxRouter",
  description: "Status, métricas, personalidades e canais do Agente Lucas.",
};

export default function DashboardPage() {
  return <Dashboard2Client />;
}

