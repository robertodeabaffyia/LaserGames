/**
 * @jest-environment node
 */
import { renderTemplate, enviarEmail, enviarWhatsApp } from "../notificaciones";

// ── Module mocks ───────────────────────────────────────────────────────────────

const mockEmailSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockEmailSend },
  })),
}));

const mockMessagesSend = jest.fn();
jest.mock("@vonage/server-sdk", () => ({
  Vonage: jest.fn().mockImplementation(() => ({
    messages: { send: mockMessagesSend },
  })),
}));
jest.mock("@vonage/messages", () => ({
  WhatsAppText: jest.fn().mockImplementation((opts: unknown) => opts),
}));

beforeEach(() => jest.clearAllMocks());

// ── renderTemplate ─────────────────────────────────────────────────────────────

describe("renderTemplate", () => {
  it("replaces known variables", () => {
    const result = renderTemplate("Hola {{nombre}}, tu evento es {{fecha}}", {
      nombre: "Ana",
      fecha: "15 de junio",
    });
    expect(result).toBe("Hola Ana, tu evento es 15 de junio");
  });

  it("leaves unknown variables as-is", () => {
    const result = renderTemplate("Hola {{nombre}}, codigo: {{desconocido}}", {
      nombre: "Luis",
    });
    expect(result).toBe("Hola Luis, codigo: {{desconocido}}");
  });

  it("handles empty vars map", () => {
    const result = renderTemplate("Sin variables aquí", {});
    expect(result).toBe("Sin variables aquí");
  });

  it("handles template with no placeholders", () => {
    const result = renderTemplate("Texto plano", { nombre: "X" });
    expect(result).toBe("Texto plano");
  });

  it("replaces the same variable multiple times", () => {
    const result = renderTemplate("{{x}} y {{x}}", { x: "hola" });
    expect(result).toBe("hola y hola");
  });
});

// ── enviarEmail ────────────────────────────────────────────────────────────────

describe("enviarEmail", () => {
  it("returns ok:true on success", async () => {
    mockEmailSend.mockResolvedValue({ data: { id: "email-1" }, error: null });

    const result = await enviarEmail("dest@test.com", "Asunto", "<p>Hola</p>");
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "dest@test.com", subject: "Asunto" })
    );
  });

  it("returns ok:false with error message on Resend error", async () => {
    mockEmailSend.mockResolvedValue({ data: null, error: { message: "Invalid email" } });

    const result = await enviarEmail("bad@test.com", "Asunto", "<p>Hola</p>");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid email");
  });

  it("returns ok:false when send throws", async () => {
    mockEmailSend.mockRejectedValue(new Error("Network error"));

    const result = await enviarEmail("dest@test.com", "Asunto", "<p>Hola</p>");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Network error");
  });
});

// ── enviarWhatsApp ─────────────────────────────────────────────────────────────

describe("enviarWhatsApp", () => {
  it("returns ok:true on success", async () => {
    mockMessagesSend.mockResolvedValue({ messageUUID: "uuid-1" });

    const result = await enviarWhatsApp("+5491112345678", "Hola desde WA");
    expect(result.ok).toBe(true);
    expect(mockMessagesSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5491112345678", text: "Hola desde WA" })
    );
  });

  it("returns ok:false when Vonage throws", async () => {
    mockMessagesSend.mockRejectedValue(new Error("Invalid number"));

    const result = await enviarWhatsApp("+invalid", "msg");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid number");
  });
});
