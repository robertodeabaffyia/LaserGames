/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
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

const mockConfig = {
  hora_inicio_reservas: "18:00:00",
  hora_fin_reservas: "23:00:00",
  duracion_bloque_min: 90,
};

function req(url: string) {
  return new NextRequest(url);
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/escape/turnos-disponibles", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(req("http://localhost/api/escape/turnos-disponibles?sala_id=s1&fecha=2026-07-01"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when sala_id is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await GET(req("http://localhost/api/escape/turnos-disponibles?fecha=2026-07-01"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when fecha is missing or malformed", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await GET(req("http://localhost/api/escape/turnos-disponibles?sala_id=s1&fecha=01-07-2026"));
    expect(res.status).toBe(400);
  });

  it("returns the available slots with no existing reservations", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));

    const res = await GET(req("http://localhost/api/escape/turnos-disponibles?sala_id=s1&fecha=2026-07-01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(["18:00", "19:30", "21:00"]);
  });

  it("excludes a slot already booked for that room/date", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(
        chain({
          data: [{ sala_id: "s1", fecha: "2026-07-01", hora_inicio: "19:30:00", estado: "reservada" }],
          error: null,
        })
      );

    const res = await GET(req("http://localhost/api/escape/turnos-disponibles?sala_id=s1&fecha=2026-07-01"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(["18:00", "21:00"]);
  });

  it("returns 404 when escape_config has no row", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { code: "PGRST116" } }));

    const res = await GET(req("http://localhost/api/escape/turnos-disponibles?sala_id=s1&fecha=2026-07-01"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when fetching reservas fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(req("http://localhost/api/escape/turnos-disponibles?sala_id=s1&fecha=2026-07-01"));
    expect(res.status).toBe(500);
  });
});
