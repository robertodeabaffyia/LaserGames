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

const ID = "reg-1";
const params = { params: Promise.resolve({ id: ID }) };

const existingRegistro = {
  id: ID,
  hora_entrada: "08:00",
  hora_salida: "16:00",
};

function req(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/registros-horas/${ID}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

// ─── PUT ─────────────────────────────────────────────────────────────────────

describe("PUT /api/registros-horas/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PUT(req("PUT", { hora_salida: "17:00" }), params);
    expect(res.status).toBe(401);
  });

  function setupPut(fetchResult = { data: existingRegistro, error: null }, updateResult = { data: { ...existingRegistro, id: ID }, error: null }) {
    mockFrom
      .mockReturnValueOnce(chain(fetchResult))   // fetch existing
      .mockReturnValueOnce(chain(updateResult)); // update
    return { fetchChain: mockFrom.mock.results[0]?.value, updateChain: mockFrom.mock.results[1]?.value };
  }

  it("returns 200 with updated registro", async () => {
    setupPut();
    const res = await PUT(req("PUT", { hora_entrada: "09:00", hora_salida: "17:00" }), params);
    expect(res.status).toBe(200);
  });

  it("recalculates horas_trabajadas on update", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: existingRegistro, error: null }));
    const updateChain = chain({ data: { id: ID, horas_trabajadas: 7.5 }, error: null });
    mockFrom.mockReturnValueOnce(updateChain);

    await PUT(req("PUT", { hora_entrada: "08:00", hora_salida: "15:30" }), params);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ horas_trabajadas: 7.5 })
    );
  });

  it("allows hora_salida to be set to null (partial entry)", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: existingRegistro, error: null }));
    const updateChain = chain({ data: { id: ID, hora_salida: null }, error: null });
    mockFrom.mockReturnValueOnce(updateChain);

    const res = await PUT(req("PUT", { hora_salida: null }), params);
    expect(res.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ hora_salida: null, horas_trabajadas: 0 })
    );
  });

  it("syncs evento_ids — deletes existing then inserts new", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: existingRegistro, error: null })); // fetch
    const updateChain = chain({ data: { id: ID }, error: null });
    const deleteChain = chain({ error: null });
    const insertChain = chain({ error: null });
    mockFrom
      .mockReturnValueOnce(updateChain)   // update
      .mockReturnValueOnce(deleteChain)   // delete old links
      .mockReturnValueOnce(insertChain);  // insert new links

    await PUT(req("PUT", { hora_salida: "17:00", evento_ids: ["ev-1", "ev-2"] }), params);
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith("registro_id", ID);
    expect(insertChain.insert).toHaveBeenCalledWith([
      { registro_id: ID, evento_id: "ev-1" },
      { registro_id: ID, evento_id: "ev-2" },
    ]);
  });

  it("skips evento sync when evento_ids is not in body", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: existingRegistro, error: null }));
    mockFrom.mockReturnValueOnce(chain({ data: { id: ID }, error: null }));

    await PUT(req("PUT", { hora_salida: "17:00" }), params);
    // Only 2 mockFrom calls (fetch + update), no delete/insert
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("clears all links when evento_ids is empty array", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: existingRegistro, error: null }));
    const updateChain = chain({ data: { id: ID }, error: null });
    const deleteChain = chain({ error: null });
    mockFrom
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(deleteChain);

    await PUT(req("PUT", { evento_ids: [] }), params);
    expect(deleteChain.delete).toHaveBeenCalled();
    // No insert since array is empty — only 3 mockFrom calls
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it("returns 404 when registro not found", async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );
    const res = await PUT(req("PUT", { hora_salida: "17:00" }), params);
    expect(res.status).toBe(404);
  });

  it("returns 422 when hora_salida is before hora_entrada", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: existingRegistro, error: null }));
    const res = await PUT(req("PUT", { hora_entrada: "16:00", hora_salida: "08:00" }), params);
    expect(res.status).toBe(422);
  });

  it("returns 400 on DB update error", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: existingRegistro, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));
    const res = await PUT(req("PUT", { hora_salida: "17:00" }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest(`http://localhost/api/registros-horas/${ID}`, {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, params);
    expect(res.status).toBe(400);
  });
});

// ─── DELETE ──────────────────────────────────────────────────────────────────

describe("DELETE /api/registros-horas/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(401);
  });

  it("returns 204 on successful delete", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
  });

  it("returns 404 when registro not found", async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 on DB delete error", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "FK constraint" } }));
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
