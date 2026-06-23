/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT } from "../route";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "upsert", "delete", "eq", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockConfig = {
  id: "cfg-1",
  usuario_id: "user-1",
  monto_seña: 1000,
  tarjeta_recargos: { VISA: { "1": 0, "3": 3.5 } },
  recargo_transferencia_pct: 2.5,
  precio_nino_adicional: 150,
  precio_adulto_adicional: 100,
  google_maps_url: "https://maps.google.com/?cid=123",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/configuracion", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/configuracion", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns config and sets x-config-ok cookie", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: mockConfig, error: null }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.monto_seña).toBe(1000);
    expect(res.headers.get("set-cookie")).toMatch(/x-config-ok=1/);
  });

  it("returns precio_nino_adicional and precio_adulto_adicional", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: mockConfig, error: null }));

    const res = await GET();
    const body = await res.json();
    expect(body.precio_nino_adicional).toBe(150);
    expect(body.precio_adulto_adicional).toBe(100);
  });

  it("returns recargo_transferencia_pct", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: mockConfig, error: null }));

    const res = await GET();
    const body = await res.json();
    expect(body.recargo_transferencia_pct).toBe(2.5);
  });

  it("returns 404 when no config exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "No rows", code: "PGRST116" } })
    );

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "Connection failed", code: "500" } })
    );

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/configuracion", () => {
  const validBody = {
    monto_seña: 1500,
    tarjeta_recargos: { VISA: { "1": 0, "3": 4.0 } },
  };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "staff" }, error: null })); // usuarios

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/administrador/);
  });

  it("upserts config and sets x-config-ok cookie for admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null })) // usuarios
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }));       // upsert

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.monto_seña).toBe(1000); // mock returns mockConfig
    expect(res.headers.get("set-cookie")).toMatch(/x-config-ok=1/);
  });

  it("saves precio_nino_adicional and precio_adulto_adicional when provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const upsertChain = chain({ data: mockConfig, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(upsertChain);

    const res = await PUT(req("PUT", {
      ...validBody,
      precio_nino_adicional: 150,
      precio_adulto_adicional: 100,
    }));
    expect(res.status).toBe(200);
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        precio_nino_adicional: 150,
        precio_adulto_adicional: 100,
      }),
      expect.any(Object)
    );
  });

  it("saves google_maps_url when provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const upsertChain = chain({ data: mockConfig, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(upsertChain);

    await PUT(req("PUT", { ...validBody, google_maps_url: "https://maps.google.com/?cid=123" }));
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ google_maps_url: "https://maps.google.com/?cid=123" }),
      expect.any(Object)
    );
  });

  it("omits google_maps_url from upsert when not provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const upsertChain = chain({ data: mockConfig, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(upsertChain);

    await PUT(req("PUT", validBody)); // no google_maps_url
    const upsertArg = upsertChain.upsert.mock.calls[0][0];
    expect(upsertArg).not.toHaveProperty("google_maps_url");
  });

  it("omits precio fields from upsert when not provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const upsertChain = chain({ data: mockConfig, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(upsertChain);

    await PUT(req("PUT", validBody)); // no precio fields
    const upsertArg = upsertChain.upsert.mock.calls[0][0];
    expect(upsertArg).not.toHaveProperty("precio_nino_adicional");
    expect(upsertArg).not.toHaveProperty("precio_adulto_adicional");
  });

  it("saves recargo_transferencia_pct when provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const upsertChain = chain({ data: mockConfig, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(upsertChain);

    const res = await PUT(req("PUT", { ...validBody, recargo_transferencia_pct: 3.5 }));
    expect(res.status).toBe(200);
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ recargo_transferencia_pct: 3.5 }),
      expect.any(Object)
    );
  });

  it("omits recargo_transferencia_pct from upsert when not provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const upsertChain = chain({ data: mockConfig, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(upsertChain);

    await PUT(req("PUT", validBody));
    const upsertArg = upsertChain.upsert.mock.calls[0][0];
    expect(upsertArg).not.toHaveProperty("recargo_transferencia_pct");
  });

  it("returns 400 when recargo_transferencia_pct is negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { ...validBody, recargo_transferencia_pct: -1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/recargo_transferencia_pct/);
  });

  it("returns 400 when monto_seña is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { tarjeta_recargos: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/monto_seña/);
  });

  it("returns 400 when monto_seña is negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { monto_seña: -100, tarjeta_recargos: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when tarjeta_recargos is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { monto_seña: 1000 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tarjeta_recargos/);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const badReq = new NextRequest("http://localhost/api/configuracion", {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq);
    expect(res.status).toBe(400);
  });

  it("returns 400 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(400);
  });
});
