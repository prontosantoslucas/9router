import { describe, it, expect } from "vitest";
import nativeClient from "../../apps/agent/src/channels/whatsapp/nativeClient";

describe("Cliente Nativo de WhatsApp (Baileys)", () => {
  it("deve exportar as funções principais da API do WhatsApp Nativo", () => {
    expect(typeof nativeClient.start).toBe("function");
    expect(typeof nativeClient.getQrCode).toBe("function");
    expect(typeof nativeClient.sendTextMessage).toBe("function");
    expect(typeof nativeClient.getStatus).toBe("function");
    expect(typeof nativeClient.disconnect).toBe("function");
  });

  it("deve retornar o status inicial como desconectado", () => {
    const status = nativeClient.getStatus();
    expect(status).toHaveProperty("connected");
    expect(status.connected).toBe(false);
  });
});
