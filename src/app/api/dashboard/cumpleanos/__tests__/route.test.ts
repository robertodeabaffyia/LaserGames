/**
 * @jest-environment node
 */
import { GET } from "../route";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "eq", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

// Fix "today" to 2026-05-21 (Wednesday) for deterministic birthday tests
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-05-21T12:00:00Z"));
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => jest.clearAllMocks());

describe("GET /api/dashboard/cumpleanos", () => {
  it("classifies a client birthday 3 days away as esta_semana", async () => {
    // 2026-05-24 = 3 days from fixed date
    mockFrom.mockReturnValue(
      chain({
        data: [
          { id: "c1", nombre: "Laura", fecha_cumpleanos: "1990-05-24", hijos: [] },
        ],
        error: null,
      })
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.esta_semana).toHaveLength(1);
    expect(body.esta_semana[0].nombre).toBe("Laura");
    expect(body.esta_semana[0].tipo).toBe("cliente");
    expect(body.proximo_mes).toHaveLength(0);
  });

  it("classifies a child birthday next month as proximo_mes", async () => {
    // Next month from May 21 = June → fecha 1990-06-15
    mockFrom.mockReturnValue(
      chain({
        data: [
          {
            id: "c1",
            nombre: "Ana",
            fecha_cumpleanos: null,
            hijos: [{ id: "h1", nombre: "Sofía", fecha_nacimiento: "2018-06-15" }],
          },
        ],
        error: null,
      })
    );

    const res = await GET();
    const body = await res.json();
    expect(body.proximo_mes).toHaveLength(1);
    expect(body.proximo_mes[0].nombre).toBe("Sofía");
    expect(body.proximo_mes[0].tipo).toBe("hijo");
    expect(body.proximo_mes[0].cliente_nombre).toBe("Ana");
    expect(body.esta_semana).toHaveLength(0);
  });

  it("returns empty lists when no upcoming birthdays", async () => {
    // Birthday far in the future (not this week, not next month)
    mockFrom.mockReturnValue(
      chain({
        data: [
          { id: "c1", nombre: "Pedro", fecha_cumpleanos: "1985-09-10", hijos: [] },
        ],
        error: null,
      })
    );

    const res = await GET();
    const body = await res.json();
    expect(body.esta_semana).toHaveLength(0);
    expect(body.proximo_mes).toHaveLength(0);
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("results are sorted by dias_restantes ascending", async () => {
    mockFrom.mockReturnValue(
      chain({
        data: [
          { id: "c1", nombre: "Z7", fecha_cumpleanos: "1990-05-27", hijos: [] }, // 6 days
          { id: "c2", nombre: "Z2", fecha_cumpleanos: "1990-05-23", hijos: [] }, // 2 days
        ],
        error: null,
      })
    );

    const res = await GET();
    const body = await res.json();
    expect(body.esta_semana[0].nombre).toBe("Z2");
    expect(body.esta_semana[1].nombre).toBe("Z7");
  });
});
