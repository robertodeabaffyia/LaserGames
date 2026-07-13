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
  for (const m of ["select", "insert", "update", "eq", "limit", "single", "maybeSingle"]) {
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
    const cajaChain = chain({ data: null, error: null });
    const updateConvChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockReserva, error: null })) // fetch reserva
      .mockReturnValueOnce(updateReservaChain) // update reserva
      .mockReturnValueOnce(chain({ data: { usuario_id: "u1" }, error: null })) // resolverUsuarioId
      .mockReturnValueOnce(cajaChain) // movimientos_caja insert
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
    // The seña must land in the Caja as an income movement.
    expect(cajaChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "ingreso", categoria: "pago_evento", monto: 10000 })
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
      .mockReturnValueOnce(chain({ data: mockReserva, error: null })) // fetch reserva
      .mockReturnValueOnce(chain({ data: null, error: null })) // update reserva
      .mockReturnValueOnce(chain({ data: { usuario_id: "u1" }, error: null })) // resolverUsuarioId
      .mockReturnValueOnce(chain({ data: null, error: null })) // caja insert
      .mockReturnValueOnce(chain({ data: null, error: null })); // reset conversacion

    const badBodyReq = new NextRequest(
      "http://localhost/api/mercadopago/webhook?topic=payment&id=456",
      { method: "POST", body: "", headers: { "Content-Type": "text/plain" } }
    );
    const res = await POST(badBodyReq);
    expect(res.status).toBe(200);
    expect(obtenerPago).toHaveBeenCalledWith("456");
  });

  it("skips gracefully when neither a reserva nor an evento exists", async () => {
    (obtenerPago as jest.Mock).mockResolvedValue({
      ok: true,
      status: "approved",
      externalReference: "ref-borrada",
    });
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null })) // escape_reservas: none
      .mockReturnValueOnce(chain({ data: null, error: null })); // eventos: none

    const res = await POST(req({ type: "payment", data: { id: "123" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
  });
});

describe("POST /api/mercadopago/webhook — cumpleaños", () => {
  const mockEvento = {
    id: "ev1",
    sena_monto: 15000,
    mp_payment_id: null,
    fecha_evento: "2026-08-15T19:00:00Z",
    nombre_festejado: "Mateo",
    cliente: { nombre: "Roberto", telefono: "+5493871234567" },
    paquete: { nombre: "Fiesta Full" },
  };

  it("registers the seña as a pago and confirms the evento when approved", async () => {
    (obtenerPago as jest.Mock).mockResolvedValue({
      ok: true,
      status: "approved",
      externalReference: "ev1",
    });
    const insertPagoChain = chain({ data: { id: "pago1" }, error: null });
    const cajaChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null })) // escape_reservas: none → fall through
      .mockReturnValueOnce(chain({ data: mockEvento, error: null })) // eventos fetch
      .mockReturnValueOnce(insertPagoChain) // insert pago (returns id)
      .mockReturnValueOnce(chain({ data: null, error: null })) // update evento mp_payment_id
      .mockReturnValueOnce(chain({ data: { usuario_id: "u1" }, error: null })) // resolverUsuarioId
      .mockReturnValueOnce(cajaChain) // movimientos_caja insert
      // recalcularEstadoEvento internals:
      .mockReturnValueOnce(chain({ data: { id: "ev1", precio_total: 50000, estado: "pendiente" }, error: null }))
      .mockReturnValueOnce(chain({ data: [{ monto: 15000, monto_final: null }], error: null }))
      .mockReturnValueOnce(chain({ data: { "monto_seña": 15000 }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null })) // update evento estado
      .mockReturnValueOnce(chain({ data: null, error: null })); // reset conversacion

    const res = await POST(req({ type: "payment", data: { id: "789" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.confirmada).toBe(true);
    expect(body.tipo).toBe("cumpleanos");

    expect(insertPagoChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ evento_id: "ev1", monto: 15000, metodo: "mercadopago" })
    );
    // The seña must also land in the Caja, linked to the evento + pago.
    expect(cajaChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ingreso",
        categoria: "pago_evento",
        monto: 15000,
        evento_id: "ev1",
        pago_id: "pago1",
      })
    );
    expect(enviarWhatsApp).toHaveBeenCalledWith(
      "+5493871234567",
      expect.stringContaining("cumpleaños")
    );
  });

  it("is idempotent when the evento already has an mp_payment_id", async () => {
    (obtenerPago as jest.Mock).mockResolvedValue({
      ok: true,
      status: "approved",
      externalReference: "ev1",
    });
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null })) // escape_reservas: none
      .mockReturnValueOnce(chain({ data: { ...mockEvento, mp_payment_id: "789" }, error: null })); // evento already paid

    const res = await POST(req({ type: "payment", data: { id: "789" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });
});
