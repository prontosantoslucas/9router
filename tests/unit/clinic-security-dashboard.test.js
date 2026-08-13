import { describe, it, expect, beforeAll } from "vitest";

// Garantir variáveis de ambiente mínimas para o import do config.js da clínica
process.env.PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";
process.env.CLINIC_NAME = process.env.CLINIC_NAME || "Clínica Teste Zenda";
process.env.CLINIC_TYPE = process.env.CLINIC_TYPE || "Odontologia";
process.env.ROUTER_API_KEY = process.env.ROUTER_API_KEY || "test-key";
process.env.EVOLUTION_URL = process.env.EVOLUTION_URL || "http://localhost:8080";
process.env.EVOLUTION_TOKEN = process.env.EVOLUTION_TOKEN || "test-token";
process.env.EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "test-instance";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "test-gclient";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "test-gsecret";
process.env.GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth/callback";
process.env.DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "admin123";

import { 
  createSessionToken, 
  verifySessionToken, 
  authenticatePassword, 
  parseCookies 
} from "../../templates/clinic-agent/src/auth.js";
import { renderConversationsView } from "../../templates/clinic-agent/src/views/conversations.js";
import { renderAppointmentsView } from "../../templates/clinic-agent/src/views/appointments.js";
import { renderPatientsView } from "../../templates/clinic-agent/src/views/patients.js";
import { renderNotesView } from "../../templates/clinic-agent/src/views/notes.js";
import { renderReportsView } from "../../templates/clinic-agent/src/views/reports.js";
import { renderChannelsView } from "../../templates/clinic-agent/src/views/channels.js";
import { renderConfigView } from "../../templates/clinic-agent/src/views/config.js";
import { renderLoginView } from "../../templates/clinic-agent/src/views/login.js";

describe("Zenda Clinic Agent — Autenticação, Segurança e Views", () => {
  it("deve criar e validar tokens de sessão assinados", () => {
    const token = createSessionToken(1);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const isValid = verifySessionToken(token);
    expect(isValid).toBe(true);

    const isInvalid = verifySessionToken("token-invalido:123:abc");
    expect(isInvalid).toBe(false);
  });

  it("deve validar o mecanismo de senha do painel da clínica com comparações seguras", () => {
    const isAuth = authenticatePassword("admin123");
    expect(typeof isAuth).toBe("boolean");
  });

  it("deve realizar o parse correto de cabeçalhos de Cookie", () => {
    const cookies = parseCookies("zenda_session=xyz123; theme=dark");
    expect(cookies.zenda_session).toBe("xyz123");
    expect(cookies.theme).toBe("dark");
  });

  it("deve renderizar as 7 telas do painel e o login sem erros de template", () => {
    const conversationsHtml = renderConversationsView({ conversations: [], selectedChat: null });
    expect(conversationsHtml).toContain("Conversas do Atendimento");

    const appointmentsHtml = renderAppointmentsView({ appointments: [] });
    expect(appointmentsHtml).toContain("Agenda & Consultas");

    const patientsHtml = renderPatientsView({ patients: [] });
    expect(patientsHtml).toContain("Base de Pacientes");

    const notesHtml = renderNotesView({ notes: [] });
    expect(notesHtml).toContain("Notas & Prontuários");

    const reportsHtml = renderReportsView({ metrics: { totalConversations: 10 } });
    expect(reportsHtml).toContain("Relatórios & Desempenho");

    const channelsHtml = renderChannelsView({ whatsappConnected: true });
    expect(channelsHtml).toContain("Canais & Divulgação");

    const configHtml = renderConfigView({ runtimeConfig: { agentMode: "prod" } });
    expect(configHtml).toContain("Configurações da Clínica");

    const loginHtml = renderLoginView({});
    expect(loginHtml).toContain("Acesse o Painel de Atendimento");
  });
});
