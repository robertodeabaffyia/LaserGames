/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PUT, DELETE } from "../route";

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

const ID = "h-1";
const params = { params: Promise.resolve({ id: ID }) };

function req(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/hijos/${ID}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

const mockHijo = {
  id: ID,
  cliente_id: "cli-1",
  nombre: "Sofía",
  fecha_nacimiento: "2018-06-01",
};

beforeEach(() => jest.clearAllMocks());

describe("PUT /api/hijos/[id]", () => {
  it("returns 200 with updated hijo", async () => {
    const updated = { ...mockHijo, nombre: "Sofía M." };
    mockFrom.mockReturnValue(chain({ data: updated, error: null }));

    const res = await PUT(req("PUT", { nombre: "Sofía M." }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).nombre).toBe("Sofía M.");
  });

  it("returns 404 when not found", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not found", code: "PGRST116" } }));

    const res = await PUT(req("PUT", { nombre: "X" }), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Constraint", code: "23000" } }));

    const res = await PUT(req("PUT", { nombre: "X" }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest(`http://localhost/api/hijos/${ID}`, {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, params);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/hijos/[id]", () => {
  it("returns 204 on success", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
    expect(mockFrom).toHaveBeenCalledWith("hijos");
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Error" } }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
