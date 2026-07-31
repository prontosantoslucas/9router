import { redirect } from "next/navigation";

// /dashboard2 e a URL antiga (pre-fusao com /dashboard); mantida como redirect
// para bookmarks e para o callback do Google OAuth em apps/agent/src/index.js,
// que ainda aponta para /dashboard2?google=connected. redirect() por si so
// derruba a query string, entao ela e repassada manualmente — sem isso o
// indicador de sucesso da conexao do Google se perde no caminho.
export default async function Dashboard2Page({ searchParams }) {
  const params = await searchParams;
  const qs = new URLSearchParams(params).toString();
  redirect(qs ? `/dashboard?${qs}` : "/dashboard");
}

