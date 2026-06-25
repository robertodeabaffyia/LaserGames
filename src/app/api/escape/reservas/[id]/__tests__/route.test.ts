/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PUT, DELETE } from "../route";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

jest.mock("@/lib/auth-helpers", () => {
  const actual = jest.requireActual("@/lib/auth-helpers");
  return { ...actual, getUserRol: jest.fn().mockResolvedValue("supervisor") };
});
import { getUserRol } from "@/lib/auth-helpers";

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "update", "delete", "eq", "is", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockCurrent = { cantidad_personas: 4, modo_cobro: "por_persona" };
const mockUpdated = {
  id: "r1",
  sala_id: "s1",
  contacto_id: "c1",
  fecha: "2026-07-01",
  hora_inicio: "18:00:00",
  cantidad_personas: 4,
  modo_cobro: "por_persona",
  precio_total: 16000,
  estado: "reservada",
  notas: null,
};
const mockConfig = { precio_sala_completa: 30000 };
const mockPreciosPersona = [
  { cantidad: 4, precio_por_persona: 4000 },
  { cantidad: 6, precio_por_persona: 3500 },
];

function makeParams(id = "r1") {
  return { params: Promise.resolve({ id }) };
}

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/escape/reservas/r1", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("PUT /api/escape/reservas/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PUT(req("PUT", { estado: "completada" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-supervisor user", async () => {
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");

    const res = await PUT(req("PUT", { estado: "completada" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("updates estado without touching the price when only estado changes", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockCurrent, error: null })) // current
      .mockReturnValueOnce(chain({ data: { ...mockUpdated, estado: "completada" }, error: null })); // update

    const res = await PUT(req("PUT", { estado: "completada" }), makeParams());
    expect(res.status).toBe(200);
  });

  it("recomputes precio_total when cantidad_personas changes", async () => {
    const updateChain = chain({ data: { ...mockUpdated, cantidad_personas: 6, precio_total: 21000 }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockCurrent, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: mockPreciosPersona, error: null }))
      .mockReturnValueOnce(updateChain);

    const res = await PUT(req("PUT", { cantidad_personas: 6 }), makeParams());
    expect(res.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ precio_total: 21000, cantidad_personas: 6 })
    );
  });

  it("recomputes precio_total when modo_cobro changes to sala_completa", async () => {
    const updateChain = chain({ data: { ...mockUpdated, modo_cobro: "sala_completa", precio_total: 30000 }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockCurrent, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(updateChain);

    const res = await PUT(req("PUT", { modo_cobro: "sala_completa" }), makeParams());
    expect(res.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ precio_total: 30000, modo_cobro: "sala_completa" })
    );
  });

  it("returns 400 when recomputed cantidad has no configured price", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockCurrent, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [{ cantidad: 4, precio_por_persona: 4000 }], error: null }));

    const res = await PUT(req("PUT", { cantidad_personas: 9 }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid modo_cobro", async () => {
    const res = await PUT(req("PUT", { modo_cobro: "gratis" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-positive cantidad_personas", async () => {
    const res = await PUT(req("PUT", { cantidad_personas: 0 }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid estado", async () => {
    const res = await PUT(req("PUT", { estado: "en_progreso" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 404 when the reserva doesn't exist", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { code: "PGRST116" } }));

    const res = await PUT(req("PUT", { estado: "completada" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/escape/reservas/r1", {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 on DB error during update", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockCurrent, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

    const res = await PUT(req("PUT", { estado: "completada" }), makeParams());
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/escape/reservas/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(req("DELETE"), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-supervisor user", async () => {
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");

    const res = await DELETE(req("DELETE"), makeParams());
    expect(res.status).toBe(403);
  });

  it("deletes the reserva for a supervisor", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));

    const res = await DELETE(req("DELETE"), makeParams());
    expect(res.status).toBe(204);
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await DELETE(req("DELETE"), makeParams());
    expect(res.status).toBe(400);
  });
});
