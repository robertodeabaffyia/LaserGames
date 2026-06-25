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
  for (const m of ["select", "insert", "or", "order", "limit", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockContacto = {
  id: "c1",
  nombre: "Juan Pérez",
  telefono: "+5493871234567",
  email: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

function req(method: string, body?: unknown, url = "http://localhost/api/escape/contactos") {
  return new NextRequest(url, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/escape/contactos", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(req("GET"));
    expect(res.status).toBe(401);
  });

  it("returns matching contactos for a search query", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const c = chain({ data: [mockContacto], error: null });
    mockFrom.mockReturnValue(c);

    const res = await GET(req("GET", undefined, "http://localhost/api/escape/contactos?q=Juan&limit=8"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(c.or).toHaveBeenCalledWith(
      expect.stringContaining("nombre.ilike.%Juan%")
    );
    expect(c.limit).toHaveBeenCalledWith(8);
  });

  it("lists all contactos when no query is given", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const c = chain({ data: [mockContacto], error: null });
    mockFrom.mockReturnValue(c);

    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    expect(c.or).not.toHaveBeenCalled();
  });

  it("returns 500 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(req("GET"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/escape/contactos", () => {
  const validBody = { nombre: "Juan Pérez", telefono: "+5493871234567" };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(401);
  });

  it("creates a contacto when nombre and telefono are provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: mockContacto, error: null }));

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(201);
  });

  it("creates a contacto when nombre and email are provided (no telefono)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: { ...mockContacto, telefono: null, email: "j@x.com" }, error: null }));

    const res = await POST(req("POST", { nombre: "Juan", email: "j@x.com" }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when nombre is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(req("POST", { telefono: "+5493871234567" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nombre/);
  });

  it("returns 400 when neither telefono nor email is provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(req("POST", { nombre: "Juan" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/teléfono o email/);
  });

  it("returns 400 for an invalid email", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(req("POST", { nombre: "Juan", email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid telefono", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(req("POST", { nombre: "Juan", telefono: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const badReq = new NextRequest("http://localhost/api/escape/contactos", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it("returns 400 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(400);
  });
});
