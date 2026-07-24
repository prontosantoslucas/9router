import { redirect } from "next/navigation";

export const metadata = {
  title: "Coder — Agente Lucas | MaxRouter",
  description: "IDE Coder inteligente do Agente Lucas integrada nativamente ao Chat.",
};

export default function CoderPage() {
  redirect("/chat?mode=coder");
}
