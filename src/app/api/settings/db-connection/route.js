import { NextResponse } from "next/server";
import { getDbConfig, writeFileConfig } from "@/lib/db/dbConfig";
import { getAdapterSync } from "@/lib/db/driver";
import { verifyDashboardPassword } from "@/lib/auth/dashboardSession";

const CLI_TOKEN_HEADER = "x-9r-cli-token";
const PASSWORD_HEADER = "x-9r-password";

function isCliRequest(request) {
  return Boolean(request.headers.get(CLI_TOKEN_HEADER));
}

function maskToken(token) {
  if (!token) return "";
  if (token.length <= 8) return "********";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

// Which driver is actually serving requests right now (set at boot).
function activeDriver() {
  try {
    return getAdapterSync()?.driver || "unknown";
  } catch {
    return "not-initialized";
  }
}

// GET - current external-DB connection config (token masked) + live driver.
export async function GET(request) {
  try {
    if (!isCliRequest(request) && !(await verifyDashboardPassword(request.headers.get(PASSWORD_HEADER)))) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    const cfg = getDbConfig();
    const driver = activeDriver();
    return NextResponse.json({
      url: cfg.url,
      tokenMasked: maskToken(cfg.token),
      hasToken: Boolean(cfg.token),
      syncIntervalMs: cfg.syncIntervalMs || 0,
      source: cfg.source, // "env" | "file" | "none"
      activeDriver: driver, // "libsql-turso" when the external DB is in use
      usingExternal: driver === "libsql-turso",
      // env-configured connections cannot be edited from the UI (managed by host)
      editable: cfg.source !== "env",
    });
  } catch (error) {
    console.log("Error reading db-connection:", error);
    return NextResponse.json({ error: "Failed to read DB connection" }, { status: 500 });
  }
}

// POST - save (or clear) the external-DB connection. Applied on next restart.
// Body: { password, url, token, syncIntervalMs }. Empty url clears it (revert
// to local SQLite). If the token field is left blank on an existing config,
// the stored token is preserved.
export async function POST(request) {
  try {
    const body = await request.json();
    const { password, url = "", token = "", syncIntervalMs = 0 } = body;
    if (!isCliRequest(request) && !(await verifyDashboardPassword(password))) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const current = getDbConfig();
    if (current.source === "env") {
      return NextResponse.json(
        { error: "Connection is set via environment variables and cannot be edited from the UI. Change TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in your host." },
        { status: 400 }
      );
    }

    const cleanUrl = String(url || "").trim();
    // Preserve existing token when the field is left blank and a url is kept.
    const effectiveToken = String(token || "").trim() || (cleanUrl && current.url === cleanUrl ? current.token : "");

    const result = writeFileConfig({ url: cleanUrl, token: effectiveToken, syncIntervalMs });
    return NextResponse.json({
      success: true,
      cleared: result.cleared,
      message: result.cleared
        ? "External database cleared. MaxRouter will use the local SQLite database after the next restart."
        : "External database saved. Restart MaxRouter to connect. Note: a fresh external DB starts empty - re-import your backup once.",
      restartRequired: true,
    });
  } catch (error) {
    console.log("Error saving db-connection:", error);
    return NextResponse.json({ error: error?.message || "Failed to save DB connection" }, { status: 400 });
  }
}
