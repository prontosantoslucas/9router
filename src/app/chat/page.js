import ChatPageClient from "./ChatPageClient";
import DashboardLayout from "@/shared/components/layouts/DashboardLayout";

export const metadata = {
  title: "Chat — Agente Lucas | MaxRouter",
  description: "Converse com o Agente Lucas autônomo diretamente pela Web.",
};

export default function ChatPage() {
  return (
    <DashboardLayout>
      <ChatPageClient />
    </DashboardLayout>
  );
}
