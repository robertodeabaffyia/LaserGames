/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@/lib/notificaciones", () => ({
  enviarWhatsApp: jest.fn().mockResolvedValue({ ok: true }),
}));
import { enviarWhatsApp } from "@/lib/notificaciones";

jest.mock("@/lib/mercadopago", () => ({
  crearLinkPagoSena: jest.fn().mockResolvedValue({
    ok: true,
    preferenceId: "pref-1",
    initPoint: "https://mpago.la/abc",
  }),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "is", "order", "single", "maybeSingle"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

function req(body: unknown, token?: string) {
  const url = `http://localhost/api/whatsapp/webhook${token ? `?token=${token}` : ""}`;
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const originalSecret = process.env.WEBHOOK_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.WEBHOOK_SECRET;
});

afterAll(() => {
  if (originalSecret !== undefined) process.env.WEBHOOK_SECRET = originalSecret;
});

describe("POST /api/whatsapp/webhook — auth", () => {
  it("returns 401 with a wrong token when WEBHOOK_SECRET is set", async () => {
    process.env.WEBHOOK_SECRET = "supersecret";

    const res = await POST(req({ from: "549387111", text: "hola" }, "wrong"));
    expect(res.status).toBe(401);
  });

  it("accepts the correct token when WEBHOOK_SECRET is set", async () => {
    process.env.WEBHOOK_SECRET = "supersecret";
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null })) // conversacion lookup
      .mockReturnValueOnce(chain({ data: [{ id: "s1", nombre: "Sala 1" }], error: null })) // salas
      .mockReturnValueOnce(chain({ data: null, error: null })); // insert conversacion

    const res = await POST(req({ from: "549387111", text: "hola" }, "supersecret"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/whatsapp/webhook — mensajes", () => {
  it("skips payloads without from/text (status callbacks)", async () => {
    const res = await POST(req({ status: "delivered", message_uuid: "x" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("starts a new conversation and replies with the salas menu", async () => {
    const insertChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null })) // conversacion: none yet
      .mockReturnValueOnce(
        chain({ data: [{ id: "s1", nombre: "Qué pasó ayer" }, { id: "s2", nombre: "El Conjuro" }], error: null })
      ) // salas
      .mockReturnValueOnce(insertChain); // insert conversacion

    const res = await POST(req({ from: "5493871234567", text: "hola" }));
    expect(res.status).toBe(200);

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ telefono: "5493871234567", estado: "sala" })
    );
    expect(enviarWhatsApp).toHaveBeenCalledWith(
      "+5493871234567",
      expect.stringContaining("1. Qué pasó ayer")
    );
  });

  it("continues an existing conversation from its stored state", async () => {
    const updateChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(
        chain({ data: { id: "conv-1", estado: "sala", datos: {} }, error: null })
      ) // conversacion existente en estado sala
      .mockReturnValueOnce(
        chain({ data: [{ id: "s1", nombre: "Qué pasó ayer" }], error: null })
      ) // salas (para resolver la selección)
      .mockReturnValueOnce(updateChain); // update conversacion

    const res = await POST(req({ from: "5493871234567", text: "1" }));
    expect(res.status).toBe(200);

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: "fecha",
        datos: expect.objectContaining({ sala_id: "s1" }),
      })
    );
    expect(enviarWhatsApp).toHaveBeenCalledWith(
      "+5493871234567",
      expect.stringContaining("dd/mm/aaaa")
    );
  });

  it("parses the nested Vonage payload shape", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: [{ id: "s1", nombre: "Sala 1" }], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await POST(
      req({ from: { number: "549387999" }, message: { content: { text: "hola" } } })
    );
    expect(res.status).toBe(200);
    expect(enviarWhatsApp).toHaveBeenCalledWith("+549387999", expect.any(String));
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      body: "no-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
