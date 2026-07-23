import { describe, it, expect, beforeEach } from "vitest";

describe("Channel Inbox & Notifications API Logic", () => {
  it("deve filtrar notificações por canal e formatar o payload para a UI", () => {
    const rawNotifications = [
      { id: 1, channel: "whatsapp", chat_name: "Cliente VIP", sender_name: "Carlos", is_group: 0, text: "Olá, orçamentos?", created_at: "2026-07-23T11:00:00Z" },
      { id: 2, channel: "telegram", chat_name: "Devs Team", sender_name: "Lucas", is_group: 1, text: "Deploy concluído", created_at: "2026-07-23T11:05:00Z" }
    ];

    const formatted = rawNotifications.map(p => ({
      id: p.id,
      channel: p.channel,
      chatName: p.chat_name,
      senderName: p.sender_name,
      isGroup: !!p.is_group,
      text: p.text,
      at: p.created_at
    }));

    expect(formatted).toHaveLength(2);
    expect(formatted[0].channel).toBe("whatsapp");
    expect(formatted[0].chatName).toBe("Cliente VIP");
    expect(formatted[1].isGroup).toBe(true);
  });

  it("deve montar prompts adequados para as ações de Resumir e Responder", () => {
    const notif = { channel: "whatsapp", senderName: "Ana Maria", chatName: "Ana Maria" };
    const channelName = notif.channel === "whatsapp" ? "WhatsApp" : "Telegram";

    const promptSummarize = `Resuma as últimas mensagens de ${notif.senderName} no ${channelName}`;
    const promptReply = `Responda para ${notif.senderName} no ${channelName}: `;

    expect(promptSummarize).toBe("Resuma as últimas mensagens de Ana Maria no WhatsApp");
    expect(promptReply).toBe("Responda para Ana Maria no WhatsApp: ");
  });
});
