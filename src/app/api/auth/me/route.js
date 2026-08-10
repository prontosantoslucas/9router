import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";

/**
 * GET /api/auth/me
 *
 * Retorna o "primary chatId" do usuário autenticado. Serve pra unificar
 * o dono das notificações entre webchat, app mobile e canais externos —
 * todos os sistemas autônomos (dailyInsights, jobAlerts, automations)
 * devem gerar notificações contra ESSE chatId.
 *
 * Regras:
 *   - OIDC login com email → `user:<email>` (case-insensitive, trim)
 *   - Password login → `user:<hash-do-token>` (estável enquanto o token
 *     não é rotacionado; se você resetar senha, muda)
 *   - Sem auth → `user:anonymous` (não útil, mas evita null)
 *
 * O prefixo `user:` distingue de chatIds de canais externos:
 *   - `web:<sessionId>` — webchat legado (uma sessão por browser)
 *   - Números puros → Telegram
 *   - `<numero>@c.us` → WhatsApp
 *   - `user:...` ← ESTE, cross-device
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const session = await getDashboardAuthSession(token);

    if (!session) {
      return NextResponse.json({
        chatId: "user:anonymous",
        authenticated: false,
      });
    }

    let chatId;
    const email = String(session.oidcEmail || "").trim().toLowerCase();
    if (email) {
      chatId = `user:${email}`;
    } else if (token) {
      // Hash SHA-256 dos primeiros 32 chars do token — estável enquanto
      // token não é rotacionado, e curto o suficiente pra caber em logs.
      const h = crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
      chatId = `user:${h}`;
    } else {
      chatId = "user:default";
    }

    return NextResponse.json({
      chatId,
      authenticated: true,
      displayName: session.oidcName || email || "Password user",
      email: email || null,
    });
  } catch (err) {
    return NextResponse.json({ chatId: "user:anonymous", authenticated: false, error: err.message }, { status: 200 });
  }
}
