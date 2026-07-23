import { redirect } from "next/navigation";

// A rota /login foi migrada para /entrar. O edge do Railway (railway-hikari)
// cacheou a variante RSC prerenderizada antiga de /login com s-maxage de 1 ano
// (keyed em Accept-Encoding do navegador) e não evicta em redeploy — servindo
// payload RSC cru para navegações HTML. /entrar é uma URL nova, sem cache
// envenenado. Este stub redireciona quem chegar em /login (dinâmico, no-store).
export const dynamic = "force-dynamic";

export default function LoginRedirect() {
  redirect("/entrar");
}
