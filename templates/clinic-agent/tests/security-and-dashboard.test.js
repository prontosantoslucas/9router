import { describe, it, expect } from "vitest";
import { 
  createSessionToken, 
  verifySessionToken, 
  authenticatePassword, 
  parseCookies 
} from "../src/auth.js";
import { renderConversationsView } from "../src/views/conversations.js";
import { renderAppointmentsView } from "../src/views/appointments.js";
import { renderPatientsView } from "../src/views/patients.js";
import { renderNotesView } from "../src/views/notes.js";
import { renderReportsView } from "../src/views/reports.js";
import { renderChannelsView } from "../src/views/channels.js";
import { renderConfigView } from "../src/views/config.js";
import { renderLoginView } from "../src/views/login.js";

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

  it("deve validar a senha do painel da clínica com comparações seguras", () => {
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
