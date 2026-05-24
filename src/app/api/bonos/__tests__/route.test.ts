/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

// Mock auth-helpers so role checks don't touch the DB
jest.mock("@/lib/auth-helpers", () => {
  const actual = jest.requireActual("@/lib/auth-helpers");
  return {
    ...actual,
    getUserRol: jest.fn().mockResolvedValue("supervisor"),
  };
});

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "eq", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockBono = {
  id: "bono-1",
  empleado_id: "emp-1",
  mes: "2026-05",
  monto_bono: 500,
  descripcion: "Bono productividad",
  creado_por: "user-1",
  created_at: "2026-05-20T10:00:00Z",
};

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/bonos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

// ── GET ────────────────────────────────────────────────────────────────────────

describe("GET /api/bonos", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new NextRequest("http://localhost/api/bonos"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is general", async () => {
    const { getUserRol } = jest.requireMock("@/lib/auth-helpers");
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");
    const res = await GET(new NextRequest("http://localhost/api/bonos"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with list", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockBono], error: null }));

    const res = await GET(new NextRequest("http://localhost/api/bonos"));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("filters by empleado_id", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/bonos?empleado_id=emp-1"));
    expect(c.eq).toHaveBeenCalledWith("empleado_id", "emp-1");
  });

  it("filters by mes", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/bonos?mes=2026-05"));
    expect(c.eq).toHaveBeenCalledWith("mes", "2026-05");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(new NextRequest("http://localhost/api/bonos"));
    expect(res.status).toBe(500);
  });
});

// ── POST ───────────────────────────────────────────────────────────────────────

describe("POST /api/bonos", () => {
  const validBody = { empleado_id: "emp-1", mes: "2026-05", monto_bono: 500 };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is general", async () => {
    const { getUserRol } = jest.requireMock("@/lib/auth-helpers");
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 201 with created bono", async () => {
    mockFrom.mockReturnValue(chain({ data: mockBono, error: null }));

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.monto_bono).toBe(500);
    expect(body.mes).toBe("2026-05");
  });

  it("returns 400 when empleado_id is missing", async () => {
    const res = await POST(postReq({ mes: "2026-05", monto_bono: 500 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/empleado_id/);
  });

  it("returns 400 when mes has invalid format", async () => {
    const res = await POST(postReq({ ...validBody, mes: "2026/05" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/mes/);
  });

  it("returns 400 when monto_bono is 0", async () => {
    const res = await POST(postReq({ ...validBody, monto_bono: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/monto_bono/);
  });

  it("includes descripcion when provided", async () => {
    const c = chain({ data: mockBono, error: null });
    mockFrom.mockReturnValue(c);

    await POST(postReq({ ...validBody, descripcion: "Bono especial" }));
    expect(c.insert).toHaveBeenCalledWith(
      expect.objectContaining({ descripcion: "Bono especial" })
    );
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "FK violation" } }));

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/bonos", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
