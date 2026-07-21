import Dashboard2Client from "./Dashboard2Client";
import DashboardLayout from "@/shared/components/layouts/DashboardLayout";

export const metadata = {
  title: "Painel do Agente Lucas | MaxRouter",
  description: "Status, métricas, personalidades e canais do Agente Lucas.",
};

export default function Dashboard2Page() {
  return (
    <DashboardLayout>
      <Dashboard2Client />
    </DashboardLayout>
  );
}
