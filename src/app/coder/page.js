import CoderPageClient from "./CoderPageClient";
import DashboardLayout from "@/shared/components/layouts/DashboardLayout";

export const metadata = {
  title: "Coder — Agente Lucas | MaxRouter",
  description: "IDE Coder inteligente do Agente Lucas integrada nativamente ao Chat.",
};

export default function CoderPage() {
  return (
    <DashboardLayout>
      <CoderPageClient />
    </DashboardLayout>
  );
}
