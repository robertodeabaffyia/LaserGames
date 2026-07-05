/**
 * @jest-environment node
 */
import { crearLinkPagoSena, obtenerPago } from "../mercadopago";

const originalEnv = { ...process.env };

function mockFetchOnce(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  process.env.MP_ACCESS_TOKEN = "TEST-TOKEN";
  process.env.APP_BASE_URL = "https://app.example.com";
  process.env.WEBHOOK_SECRET = "whsec";
});

afterAll(() => {
  process.env = originalEnv;
});

describe("crearLinkPagoSena", () => {
  it("creates a preference with external_reference and notification_url", async () => {
    mockFetchOnce(201, { id: "pref-1", init_point: "https://mpago.la/abc" });

    const res = await crearLinkPagoSena({ reservaId: "r1", titulo: "Seña", monto: 10000 });
    expect(res).toEqual({ ok: true, preferenceId: "pref-1", initPoint: "https://mpago.la/abc" });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    expect(init.headers.Authorization).toBe("Bearer TEST-TOKEN");
    const body = JSON.parse(init.body);
    expect(body.external_reference).toBe("r1");
    expect(body.items[0]).toEqual({ title: "Seña", quantity: 1, unit_price: 10000, currency_id: "ARS" });
    expect(body.notification_url).toBe("https://app.example.com/api/mercadopago/webhook?token=whsec");
  });

  it("returns an error when MP responds non-2xx", async () => {
    mockFetchOnce(400, { message: "bad request" });

    const res = await crearLinkPagoSena({ reservaId: "r1", titulo: "Seña", monto: 100 });
    expect(res.ok).toBe(false);
  });

  it("returns an error when MP_ACCESS_TOKEN is missing", async () => {
    delete process.env.MP_ACCESS_TOKEN;

    const res = await crearLinkPagoSena({ reservaId: "r1", titulo: "Seña", monto: 100 });
    expect(res.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an error when fetch throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    const res = await crearLinkPagoSena({ reservaId: "r1", titulo: "Seña", monto: 100 });
    expect(res).toEqual({ ok: false, error: "network down" });
  });
});

describe("obtenerPago", () => {
  it("fetches the payment and returns status + external_reference", async () => {
    mockFetchOnce(200, { status: "approved", external_reference: "r1" });

    const res = await obtenerPago("123");
    expect(res).toEqual({ ok: true, status: "approved", externalReference: "r1" });
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.mercadopago.com/v1/payments/123");
  });

  it("returns an error on non-2xx", async () => {
    mockFetchOnce(404, {});

    const res = await obtenerPago("123");
    expect(res.ok).toBe(false);
  });

  it("returns an error when MP_ACCESS_TOKEN is missing", async () => {
    delete process.env.MP_ACCESS_TOKEN;

    const res = await obtenerPago("123");
    expect(res.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
