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
  obtenerPago: jest.fn(),
}));
import { obtenerPago } from "@/lib/mercadopago";

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "update", "eq", "single", "maybeSingle"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockReserva = {
  id: "r1",
  estado: "pendiente_sena",
  sena_monto: 10000,
  sena_pagada: false,
  fecha: "2026-08-15",
  hora_inicio: "19:30:00",
  contacto: { nombre: "Roberto", telefono: "+5493871234567" },
  sala: { nombre: "El Conjuro" },
};

function req(body: unknown, token?: string) {
  const url = `http://localhost/api/mercadopago/webhook${token ? `?token=${token}` : ""}`;
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

describe("POST /api/mercadopago/webhook", () => {
  it("returns 401 with a wrong token when WEBHOOK_SECRET is set", async () => {
    process.env.WEBHOOK_SECRET = "supersecret";

    const res = await POST(req({ type: "payment", data: { id: "123" } }, "wrong"));
    expect(res.status).toBe(401);
  });

  it("skips non-payment notifications without calling MP", async () => {
    const res = await POST(req({ type: "merchant_order", data: { id: "123" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
    expect(obtenerPago).not.toHaveBeenCalled();
  });

  it("confirms the reserva when the payment is approved", async () => {
    (obtenerPago as jest.Mock).mockResolvedValue({
      ok: true,
      status: "approved",
      externalReference: "r1",
    });
    const updateReservaChain = chain({ data: null, error: null });
    const updateConvChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockReserva, error: null })) // fetch reserva
      .mockReturnValueOnce(updateReservaChain) // update reserva
      .mockReturnValueOnce(updateConvChain); // reset conversacion

    const res = await POST(req({ type: "payment", data: { id: "123" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).confirmada).toBe(true);

    expect(updateReservaChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sena_pagada: true,
        mp_payment_id: "123",
        estado: "reservada",
      })
    );
    expect(updateConvChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "inicio", datos: {} })
    );
    expect(enviarWhatsApp).toHaveBeenCalledWith(
      "+5493871234567",
      expect.stringContaining("confirmada")
    );
  });

  it("verifies the payment against the MP API instead of trusting the payload", async () => {
    // Payload claims approved, but the API says rejected → nothing changes.
    (obtenerPago as jest.Mock).mockResolvedValue({
      ok: true,
      status: "rejected",
      externalReference: "r1",
    });

    const res = await POST(req({ type: "payment", data: { id: "123" }, status: "approved" }));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("is idempotent for duplicate notifications (seña already paid)", async () => {
    (obtenerPago as jest.Mock).mockResolvedValue({
      ok: true,
      status: "approved",
      externalReference: "r1",
    });
    mockFrom.mockReturnValueOnce(
      chain({ data: { ...mockReserva, sena_pagada: true, estado: "reservada" }, error: null })
    );

    const res = await POST(req({ type: "payment", data: { id: "123" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("returns 500 when the MP API lookup fails, so MP retries later", async () => {
    (obtenerPago as jest.Mock).mockResolvedValue({ ok: false, error: "MP payments 500" });

    const res = await POST(req({ type: "payment", data: { id: "123" } }));
    expect(res.status).toBe(500);
  });

  it("supports the query-param notification style (?topic=payment&id=)", async () => {
    (obtenerPago as jest.Mock).mockResolvedValue({
      ok: true,
      status: "approved",
      externalReference: "r1",
    });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockReserva, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const badBodyReq = new NextRequest(
      "http://localhost/api/mercadopago/webhook?topic=payment&id=456",
      { method: "POST", body: "", headers: { "Content-Type": "text/plain" } }
    );
    const res = await POST(badBodyReq);
    expect(res.status).toBe(200);
    expect(obtenerPago).toHaveBeenCalledWith("456");
  });

  it("skips gracefully when the reserva no longer exists", async () => {
    (obtenerPago as jest.Mock).mockResolvedValue({
      ok: true,
      status: "approved",
      externalReference: "r-borrada",
    });
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await POST(req({ type: "payment", data: { id: "123" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
  });
});
