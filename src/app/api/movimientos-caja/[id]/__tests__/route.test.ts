/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { DELETE } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "delete", "eq", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const ID = "mov-1";
const params = { params: Promise.resolve({ id: ID }) };

function req(method: string) {
  return new NextRequest(`http://localhost/api/movimientos-caja/${ID}`, { method });
}

beforeEach(() => jest.clearAllMocks());

describe("DELETE /api/movimientos-caja/[id]", () => {
  it("returns 204 on success", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID }, error: null }))  // fetch exists
      .mockReturnValueOnce(chain({ data: null, error: null }));        // delete

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
    expect(mockFrom).toHaveBeenCalledWith("movimientos_caja");
  });

  it("returns 404 when movimiento not found", async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it("returns 400 on DB delete error", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "FK constraint" } }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
