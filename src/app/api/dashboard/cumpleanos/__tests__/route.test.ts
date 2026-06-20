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
  it("does NOT include the client's own birthday (only children)", async () => {
    // Client has a birthday 3 days away — should be ignored
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
    expect(body.esta_semana).toHaveLength(0);
    expect(body.proximo_mes).toHaveLength(0);
  });

  it("classifies a child birthday this week as esta_semana with parent name", async () => {
    // 2026-05-24 = 3 days from fixed date
    mockFrom.mockReturnValue(
      chain({
        data: [
          {
            id: "c1",
            nombre: "Laura",
            fecha_cumpleanos: null,
            hijos: [{ id: "h1", nombre: "Sofía", fecha_nacimiento: "2018-05-24" }],
          },
        ],
        error: null,
      })
    );

    const res = await GET();
    const body = await res.json();
    expect(body.esta_semana).toHaveLength(1);
    expect(body.esta_semana[0].nombre).toBe("Sofía");
    expect(body.esta_semana[0].tipo).toBe("hijo");
    expect(body.esta_semana[0].cliente_nombre).toBe("Laura");
    expect(body.proximo_mes).toHaveLength(0);
  });

  it("classifies a child birthday next month as proximo_mes", async () => {
    // Next month from May 21 = June → fecha 2018-06-15
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

  it("returns empty lists when no children have upcoming birthdays", async () => {
    mockFrom.mockReturnValue(
      chain({
        data: [
          {
            id: "c1",
            nombre: "Pedro",
            fecha_cumpleanos: "1985-09-10",
            hijos: [{ id: "h1", nombre: "Mateo", fecha_nacimiento: "2019-09-10" }],
          },
        ],
        error: null,
      })
    );

    const res = await GET();
    const body = await res.json();
    expect(body.esta_semana).toHaveLength(0);
    expect(body.proximo_mes).toHaveLength(0);
  });

  it("excludes client's own birthday even when fecha_cumpleanos is set and a child is also upcoming", async () => {
    // Client birthday esta semana (should be excluded); child birthday next month (included)
    mockFrom.mockReturnValue(
      chain({
        data: [
          {
            id: "c1",
            nombre: "Marta",
            fecha_cumpleanos: "1985-05-23", // 2 days away — would have been included before
            hijos: [{ id: "h1", nombre: "Lucas", fecha_nacimiento: "2020-06-10" }],
          },
        ],
        error: null,
      })
    );

    const res = await GET();
    const body = await res.json();
    // Only Lucas in proximo_mes; Marta's own birthday must NOT appear
    expect(body.proximo_mes).toHaveLength(1);
    expect(body.proximo_mes[0].nombre).toBe("Lucas");
    const allEntries = [...body.esta_semana, ...body.proximo_mes];
    expect(allEntries.every((e: { tipo: string }) => e.tipo === "hijo")).toBe(true);
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
          {
            id: "c1",
            nombre: "Ana",
            fecha_cumpleanos: null,
            hijos: [
              { id: "h1", nombre: "Zeta", fecha_nacimiento: "2019-05-27" }, // 6 days
              { id: "h2", nombre: "Alfa", fecha_nacimiento: "2020-05-23" }, // 2 days
            ],
          },
        ],
        error: null,
      })
    );

    const res = await GET();
    const body = await res.json();
    expect(body.esta_semana[0].nombre).toBe("Alfa");
    expect(body.esta_semana[1].nombre).toBe("Zeta");
  });
});
