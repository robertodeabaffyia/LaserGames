/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { DELETE } from "../route";

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
  for (const m of ["select", "delete", "eq", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const ID = "pago-1";
const params = { params: Promise.resolve({ id: ID }) };

function req(method: string) {
  return new NextRequest(`http://localhost/api/pagos/${ID}`, { method });
}

beforeEach(() => jest.clearAllMocks());

describe("DELETE /api/pagos/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(401);
  });

  it("returns 204 on successful delete", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null })) // fetch
      .mockReturnValueOnce(chain({ data: null, error: null }));                          // delete

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
  });

  it("returns 404 when pago not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 on DB delete error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "FK constraint" } }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
