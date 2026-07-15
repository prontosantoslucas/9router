"use client";

import { useState, useEffect } from "react";
import { Card, Button, Input } from "@/shared/components";

// External database (Turso / libSQL) connection.
// Leave the fields EMPTY to keep the default local SQLite database (best
// out-of-the-box config after install). Fill them to use a managed cloud
// database instead, so your configuration survives server restarts/redeploys.
// Applied on the next MaxRouter restart. Connection config lives in a bootstrap
// file (not the database itself), so it must be entered here or via env vars.
export default function DatabaseConnectionCard() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/db-connection")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setStatus(data);
        if (data.url) setUrl(data.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (clear = false) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/db-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          url: clear ? "" : url.trim(),
          token: clear ? "" : token.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setMsg({ type: "success", text: data.message || "Saved." });
      if (clear) {
        setUrl("");
        setToken("");
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to save" });
    } finally {
      setLoading(false);
    }
  };

  const envManaged = status?.source === "env";

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold">External Database (optional)</h3>
          <p className="text-xs sm:text-sm text-text-muted">
            Keep this empty to use the local database (default). Fill it to store your config in the cloud so it survives restarts.
          </p>
        </div>
      </div>

      {status && (
        <div className="mb-4 p-3 rounded-lg bg-bg border border-border text-xs sm:text-sm">
          <p>
            Active driver: <span className="font-mono">{status.activeDriver}</span>{" "}
            {status.usingExternal ? "(cloud / Turso)" : "(local SQLite)"}
          </p>
          {envManaged && (
            <p className="text-text-muted mt-1">
              Configured via environment variables - edit TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in your host to change it.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Database URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="libsql://your-db.turso.io  (get a free DB at turso.tech)"
            disabled={envManaged || loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Auth Token</label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={status?.hasToken ? "leave blank to keep current token" : "Turso auth token"}
            disabled={envManaged || loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Dashboard Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm your dashboard password to save"
            disabled={envManaged || loading}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="primary"
            icon="save"
            onClick={() => save(false)}
            loading={loading}
            disabled={envManaged || !url.trim() || !password}
            className="w-full sm:w-auto"
          >
            Save & use external DB
          </Button>
          <Button
            variant="outline"
            icon="restart_alt"
            onClick={() => save(true)}
            disabled={envManaged || loading || !password}
            className="w-full sm:w-auto"
          >
            Clear (use local)
          </Button>
        </div>

        <p className="text-xs text-text-muted">
          Changes apply after restarting MaxRouter. A fresh external database starts empty - import your backup once after switching.
        </p>

        {msg && (
          <p className={`text-sm ${msg.type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </Card>
  );
}
