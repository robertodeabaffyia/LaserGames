/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "upsert", "eq", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockDesusc = {
  id: "ds-1",
  cliente_id: "cli-1",
  tipo_notificacion: "evento_recordatorio",
  desuscrito: true,
  updated_at: "2026-05-21T00:00:00Z",
};

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/desuscripciones", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/desuscripciones", () => {
  it("returns 200 with list", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockDesusc], error: null }));
    const res = await GET(new NextRequest("http://localhost/api/desuscripciones"));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("filters by cliente_id", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);
    await GET(new NextRequest("http://localhost/api/desuscripciones?cliente_id=cli-1"));
    expect(c.eq).toHaveBeenCalledWith("cliente_id", "cli-1");
  });

  it("filters by tipo", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);
    await GET(new NextRequest("http://localhost/api/desuscripciones?tipo=confirmacion_evento"));
    expect(c.eq).toHaveBeenCalledWith("tipo_notificacion", "confirmacion_evento");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));
    const res = await GET(new NextRequest("http://localhost/api/desuscripciones"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/desuscripciones", () => {
  const validBody = { cliente_id: "cli-1", tipo_notificacion: "evento_recordatorio" };

  it("returns 200 with upserted record", async () => {
    mockFrom.mockReturnValue(chain({ data: mockDesusc, error: null }));
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(200);
    expect((await res.json()).desuscrito).toBe(true);
  });

  it("returns 400 when cliente_id is missing", async () => {
    const res = await POST(postReq({ tipo_notificacion: "evento_recordatorio" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cliente_id/);
  });

  it("returns 400 when tipo_notificacion is invalid", async () => {
    const res = await POST(postReq({ ...validBody, tipo_notificacion: "invalido" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tipo_notificacion/);
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Constraint" } }));
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/desuscripciones", {
      method: "POST", body: "bad", headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/desuscripciones", () => {
  it("returns 204 on success", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    const res = await DELETE(
      new NextRequest("http://localhost/api/desuscripciones?cliente_id=cli-1&tipo=evento_recordatorio",
        { method: "DELETE" })
    );
    expect(res.status).toBe(204);
  });

  it("returns 400 when params are missing", async () => {
    const res = await DELETE(
      new NextRequest("http://localhost/api/desuscripciones", { method: "DELETE" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));
    const res = await DELETE(
      new NextRequest("http://localhost/api/desuscripciones?cliente_id=cli-1&tipo=evento_recordatorio",
        { method: "DELETE" })
    );
    expect(res.status).toBe(400);
  });
});
