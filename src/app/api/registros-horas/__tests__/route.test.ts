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

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "delete", "eq", "gte", "lte", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockRegistro = {
  id: "reg-1",
  empleado_id: "emp-1",
  fecha: "2026-05-20",
  hora_entrada: "08:00",
  hora_salida: "16:00",
  horas_trabajadas: 8,
  notas: null,
  creado_por: null,
  created_at: "2026-05-20T10:00:00Z",
};

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/registros-horas", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// Fix time so "today" is 2026-05-21 — past/future date tests are deterministic
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-05-21T12:00:00Z"));
});
afterAll(() => jest.useRealTimers());
beforeEach(() => jest.clearAllMocks());

describe("GET /api/registros-horas", () => {
  it("returns list of registros", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockRegistro], error: null }));

    const res = await GET(new NextRequest("http://localhost/api/registros-horas"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].horas_trabajadas).toBe(8);
  });

  it("filters by empleado_id", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/registros-horas?empleado_id=emp-1"));
    expect(c.eq).toHaveBeenCalledWith("empleado_id", "emp-1");
  });

  it("filters by mes using gte/lte on fecha", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/registros-horas?mes=2026-05"));
    expect(c.gte).toHaveBeenCalledWith("fecha", "2026-05-01");
    expect(c.lte).toHaveBeenCalledWith("fecha", "2026-05-31");
  });

  it("filters by fecha_inicio only (no mes param)", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/registros-horas?fecha_inicio=2026-05-01"));
    expect(c.gte).toHaveBeenCalledWith("fecha", "2026-05-01");
    expect(c.lte).not.toHaveBeenCalled();
  });

  it("filters by fecha_fin only (no mes param)", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/registros-horas?fecha_fin=2026-05-31"));
    expect(c.lte).toHaveBeenCalledWith("fecha", "2026-05-31");
    expect(c.gte).not.toHaveBeenCalled();
  });

  it("filters by both fecha_inicio and fecha_fin", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(
      new NextRequest(
        "http://localhost/api/registros-horas?fecha_inicio=2026-05-01&fecha_fin=2026-05-15"
      )
    );
    expect(c.gte).toHaveBeenCalledWith("fecha", "2026-05-01");
    expect(c.lte).toHaveBeenCalledWith("fecha", "2026-05-15");
  });

  it("mes=2026-02 uses 28 as last day (non-leap year)", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/registros-horas?mes=2026-02"));
    expect(c.gte).toHaveBeenCalledWith("fecha", "2026-02-01");
    expect(c.lte).toHaveBeenCalledWith("fecha", "2026-02-28");
  });

  it("ignores invalid mes format (falls through to date range path)", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/registros-horas?mes=not-a-month"));
    // invalid mes → no gte/lte applied at all (no fecha_inicio/fecha_fin either)
    expect(c.gte).not.toHaveBeenCalled();
    expect(c.lte).not.toHaveBeenCalled();
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(new NextRequest("http://localhost/api/registros-horas"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/registros-horas", () => {
  const validBody = {
    empleado_id: "emp-1",
    fecha: "2026-05-20", // past date ✓
    hora_entrada: "08:00",
    hora_salida: "16:00",
  };

  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("returns 201 with created registro and calculated horas_trabajadas", async () => {
    const insertChain = chain({ data: mockRegistro, error: null });
    mockFrom.mockReturnValue(insertChain);

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.horas_trabajadas).toBe(8);
    // Verify horas_trabajadas was calculated and passed to insert
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ horas_trabajadas: 8 })
    );
  });

  it("returns 422 when fecha is in the future", async () => {
    const res = await POST(postReq({ ...validBody, fecha: "2026-06-01" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/futuras/);
  });

  it("returns 422 when hora_salida <= hora_entrada", async () => {
    const res = await POST(
      postReq({ ...validBody, hora_entrada: "16:00", hora_salida: "08:00" })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/hora_salida/);
  });

  it("returns 422 when hora_salida equals hora_entrada", async () => {
    const res = await POST(
      postReq({ ...validBody, hora_entrada: "09:00", hora_salida: "09:00" })
    );
    expect(res.status).toBe(422);
  });

  it("returns 400 when empleado_id is missing", async () => {
    const res = await POST(postReq({ fecha: "2026-05-20", hora_entrada: "08:00", hora_salida: "16:00" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/empleado_id/);
  });

  it("returns 400 when fecha is missing", async () => {
    const res = await POST(postReq({ empleado_id: "emp-1", hora_entrada: "08:00", hora_salida: "16:00" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when hora_entrada is missing", async () => {
    const res = await POST(postReq({ empleado_id: "emp-1", fecha: "2026-05-20", hora_salida: "16:00" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "FK violation" } }));

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
  });

  it("calculates 7.5h for 08:00–15:30 shift", async () => {
    const insertChain = chain({
      data: { ...mockRegistro, hora_salida: "15:30", horas_trabajadas: 7.5 },
      error: null,
    });
    mockFrom.mockReturnValue(insertChain);

    const res = await POST(postReq({ ...validBody, hora_salida: "15:30" }));
    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ horas_trabajadas: 7.5 })
    );
  });

  it("stores notas when provided", async () => {
    const insertChain = chain({ data: { ...mockRegistro, notas: "Turno extra" }, error: null });
    mockFrom.mockReturnValue(insertChain);

    await POST(postReq({ ...validBody, notas: "Turno extra" }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ notas: "Turno extra" })
    );
  });

  it("stores creado_por from auth user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-42" } } });
    const insertChain = chain({ data: mockRegistro, error: null });
    mockFrom.mockReturnValue(insertChain);

    await POST(postReq(validBody));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ creado_por: "user-42" })
    );
  });

  it("accepts today's date (not future)", async () => {
    const insertChain = chain({ data: mockRegistro, error: null });
    mockFrom.mockReturnValue(insertChain);

    const res = await POST(postReq({ ...validBody, fecha: "2026-05-21" }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when hora_salida is missing", async () => {
    const res = await POST(
      postReq({ empleado_id: "emp-1", fecha: "2026-05-20", hora_entrada: "08:00" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/registros-horas", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
