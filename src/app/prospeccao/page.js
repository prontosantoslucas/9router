"use client";

import { useCallback, useEffect, useState } from "react";

const NICHES = [
  { value: "", label: "Todos nichos" },
  { value: "odonto", label: "Odonto" },
  { value: "estetica", label: "Estética" },
  { value: "vet", label: "Veterinária" },
];

const STATUSES = [
  { value: "", label: "Todos status" },
  { value: "novo", label: "Novo" },
  { value: "gerado", label: "DM gerado" },
  { value: "enviado", label: "Enviado" },
  { value: "respondeu", label: "Respondeu" },
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "descartado", label: "Descartado" },
];

const STATUS_COLOR = {
  novo: "#6b7280",
  gerado: "#2563eb",
  enviado: "#d97706",
  respondeu: "#10a37f",
  sem_resposta: "#9ca3af",
  descartado: "#ef4444",
};

function igDmUrl(handle) {
  const u = (handle || "").replace(/^@/, "").trim();
  return u ? `https://ig.me/m/${u}` : null;
}
function waUrl(phone, text) {
  const p = (phone || "").replace(/\D/g, "");
  if (!p) return null;
  const full = p.length <= 11 ? `55${p}` : p;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export default function ProspeccaoPage() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({ total: 0, byStatus: {} });
  const [filter, setFilter] = useState({ status: "", niche: "", q: "" });
  const [loading, setLoading] = useState(false);
  const [genId, setGenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", niche: "odonto", city: "", instagram: "", whatsapp: "", contactName: "", context: "" });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.niche) params.set("niche", filter.niche);
    if (filter.q) params.set("q", filter.q);
    const res = await fetch(`/api/prospeccao/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads || []);
    setStats(data.stats || { total: 0, byStatus: {} });
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    // fetch-on-mount / on-filter-change; fetchLeads gerencia seu próprio loading
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeads();
  }, [fetchLeads]);

  async function generate(id) {
    setGenId(id);
    try {
      const res = await fetch("/api/prospeccao/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "erro");
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
    } catch (e) {
      alert(e.message);
    } finally {
      setGenId(null);
    }
  }

  async function patchLead(id, patch) {
    const res = await fetch("/api/prospeccao/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json();
    if (res.ok) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
      fetchLeads();
    }
  }

  async function addLead(e) {
    e.preventDefault();
    const res = await fetch("/api/prospeccao/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", niche: "odonto", city: "", instagram: "", whatsapp: "", contactName: "", context: "" });
      setAdding(false);
      fetchLeads();
    }
  }

  function copy(text) {
    navigator.clipboard.writeText(text || "");
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "#1a1a1a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>🎯 Máquina de Prospecção</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Gera o DM personalizado. <b>Você envia</b> (Instagram/WhatsApp) — zero risco de ban.
          </p>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 13 }}>
          <span><b>{stats.total}</b> leads</span>
          {Object.entries(stats.byStatus || {}).map(([s, n]) => (
            <span key={s} style={{ color: STATUS_COLOR[s] || "#666" }}>{s}: <b>{n}</b></span>
          ))}
        </div>
      </div>

      {/* Filtros + Add */}
      <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} style={sel}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filter.niche} onChange={(e) => setFilter((f) => ({ ...f, niche: e.target.value }))} style={sel}>
          {NICHES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
        </select>
        <input placeholder="Buscar..." value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} style={{ ...inp, width: 180 }} />
        <button onClick={() => setAdding((a) => !a)} style={btnPrimary}>{adding ? "Cancelar" : "+ Adicionar lead"}</button>
        {loading && <span style={{ color: "#999", fontSize: 13 }}>carregando…</span>}
      </div>

      {adding && (
        <form onSubmit={addLead} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, background: "#f7f8fa", padding: 16, borderRadius: 12 }}>
          <input required placeholder="Nome da clínica" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
          <select value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} style={sel}>
            <option value="odonto">Odonto</option><option value="estetica">Estética</option><option value="vet">Veterinária</option>
          </select>
          <input placeholder="Cidade/UF" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inp} />
          <input placeholder="Nome do dono (opcional)" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} style={inp} />
          <input placeholder="@instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} style={inp} />
          <input placeholder="WhatsApp (só números)" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} style={inp} />
          <textarea placeholder="Contexto real da clínica (ajuda a personalizar o DM)" value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} style={{ ...inp, gridColumn: "1 / 3", minHeight: 50 }} />
          <button type="submit" style={{ ...btnPrimary, gridColumn: "1 / 3" }}>Salvar lead</button>
        </form>
      )}

      {/* Lista de leads */}
      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        {leads.map((l) => (
          <div key={l.id} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{l.name}</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                  {l.niche} · {l.city}
                  {l.contactName && <> · 👤 {l.contactName}</>}
                  {l.instagram && <> · {l.instagram}</>}
                  {l.whatsapp && <> · 📱 {l.whatsapp}</>}
                </div>
                {l.context && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, maxWidth: 640 }}>{l.context}</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#fff", background: STATUS_COLOR[l.status] || "#666" }}>
                {l.status}
              </span>
            </div>

            {/* DMs gerados */}
            {(l.dmInstagram || l.dmWhatsapp) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                {l.dmInstagram && (
                  <div style={dmBox}>
                    <div style={dmLabel}>Instagram DM</div>
                    <div style={dmText}>{l.dmInstagram}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button onClick={() => copy(l.dmInstagram)} style={btnSmall}>Copiar</button>
                      {igDmUrl(l.instagram) && <a href={igDmUrl(l.instagram)} target="_blank" rel="noreferrer" style={btnSmallLink}>Abrir DM</a>}
                    </div>
                  </div>
                )}
                {l.dmWhatsapp && (
                  <div style={dmBox}>
                    <div style={dmLabel}>WhatsApp</div>
                    <div style={dmText}>{l.dmWhatsapp}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button onClick={() => copy(l.dmWhatsapp)} style={btnSmall}>Copiar</button>
                      {waUrl(l.whatsapp, l.dmWhatsapp) && <a href={waUrl(l.whatsapp, l.dmWhatsapp)} target="_blank" rel="noreferrer" style={btnSmallLink}>Abrir WhatsApp</a>}
                    </div>
                  </div>
                )}
              </div>
            )}
            {l.followup && (
              <div style={{ ...dmBox, marginTop: 10, background: "#fffbeb" }}>
                <div style={dmLabel}>Follow-up (3-4 dias depois)</div>
                <div style={dmText}>{l.followup}</div>
                <button onClick={() => copy(l.followup)} style={{ ...btnSmall, marginTop: 8 }}>Copiar follow-up</button>
              </div>
            )}

            {/* Ações */}
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => generate(l.id)} disabled={genId === l.id} style={btnPrimary}>
                {genId === l.id ? "Gerando…" : l.dmInstagram ? "Regenerar DM" : "Gerar DM"}
              </button>
              <button onClick={() => patchLead(l.id, { status: "enviado", lastSentAt: new Date().toISOString() })} style={btn}>Marquei enviado</button>
              <button onClick={() => patchLead(l.id, { status: "respondeu" })} style={{ ...btn, color: "#10a37f" }}>Respondeu ✓</button>
              <button onClick={() => patchLead(l.id, { status: "sem_resposta" })} style={btn}>Sem resposta</button>
              <button onClick={() => patchLead(l.id, { status: "descartado" })} style={{ ...btn, color: "#ef4444" }}>Descartar</button>
            </div>
          </div>
        ))}
        {!leads.length && !loading && <p style={{ color: "#999" }}>Nenhum lead com esse filtro.</p>}
      </div>
    </div>
  );
}

const inp = { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none" };
const sel = { ...inp, background: "#fff" };
const btn = { padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 };
const btnPrimary = { ...btn, background: "#10a37f", color: "#fff", border: "1px solid #10a37f" };
const btnSmall = { padding: "5px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 };
const btnSmallLink = { ...btnSmall, background: "#10a37f", color: "#fff", border: "1px solid #10a37f", textDecoration: "none", display: "inline-flex", alignItems: "center" };
const dmBox = { background: "#f7f8fa", borderRadius: 8, padding: 10 };
const dmLabel = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 };
const dmText = { fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.45 };
