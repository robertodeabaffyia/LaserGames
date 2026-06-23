/**
 * @jest-environment node
 */
import { GET } from "../route";

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
  for (const m of ["select", "eq", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/usuarios/me", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the authenticated user's rol", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue(chain({ data: { rol: "admin" }, error: null }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rol).toBe("admin");
  });

  it("returns null rol when user has no usuarios row", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue(chain({ data: null, error: { code: "PGRST116" } }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rol).toBeNull();
  });

  it("returns supervisor rol correctly", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u2" } } });
    mockFrom.mockReturnValue(chain({ data: { rol: "supervisor" }, error: null }));

    const res = await GET();
    const body = await res.json();
    expect(body.rol).toBe("supervisor");
  });
});
