/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

function req(body: unknown) {
  return new NextRequest("http://localhost/api/hijos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const mockHijo = {
  id: "h-1",
  cliente_id: "cli-1",
  nombre: "Sofía",
  fecha_nacimiento: "2018-06-01",
  colegio: null,
  notas: null,
};

beforeEach(() => jest.clearAllMocks());

describe("POST /api/hijos", () => {
  it("returns 201 with created hijo", async () => {
    mockFrom.mockReturnValue(chain({ data: mockHijo, error: null }));

    const res = await POST(req({ cliente_id: "cli-1", nombre: "Sofía", fecha_nacimiento: "2018-06-01" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(mockHijo);
    expect(mockFrom).toHaveBeenCalledWith("hijos");
  });

  it("returns 400 when cliente_id is missing", async () => {
    const res = await POST(req({ nombre: "Sofía", fecha_nacimiento: "2018-06-01" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cliente_id/);
  });

  it("returns 400 when nombre is missing", async () => {
    const res = await POST(req({ cliente_id: "cli-1", fecha_nacimiento: "2018-06-01" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when fecha_nacimiento is missing", async () => {
    const res = await POST(req({ cliente_id: "cli-1", nombre: "Sofía" }));
    expect(res.status).toBe(400);
  });

  it("returns 201 with colegio when provided", async () => {
    const hijoConColegio = { ...mockHijo, colegio: "Colegio San José" };
    mockFrom.mockReturnValue(chain({ data: hijoConColegio, error: null }));

    const res = await POST(req({ cliente_id: "cli-1", nombre: "Sofía", fecha_nacimiento: "2018-06-01", colegio: "Colegio San José" }));
    expect(res.status).toBe(201);
    expect((await res.json()).colegio).toBe("Colegio San José");
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "FK violation" } }));

    const res = await POST(req({ cliente_id: "cli-1", nombre: "Sofía", fecha_nacimiento: "2018-06-01" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/hijos", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
