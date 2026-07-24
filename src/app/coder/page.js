import CoderPageClient from "./CoderPageClient";

export const metadata = {
  title: "Coder — Agente Lucas | MaxRouter",
  description: "IDE Coder inteligente do Agente Lucas com motor OpenClaude, commit no GitHub, exportação ZIP e Supabase OAuth.",
};

export default function CoderPage() {
  return <CoderPageClient />;
}
