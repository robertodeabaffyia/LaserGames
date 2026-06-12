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
  for (const m of ["select", "eq", "in", "order", "limit", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockEvento = {
  id: "ev-1",
  fecha_evento: "2026-06-15T14:00:00Z",
  estado: "confirmado",
  nombre_festejado: "Mateo",
  precio_total: 3500,
  cliente: { id: "cli-1", nombre: "Ana García", telefono: "5551234567" },
  paquete: { nombre: "Paquete Premium" },
};

beforeEach(() => jest.clearAllMocks());

describe("GET /api/dashboard/eventos-pendientes", () => {
  it("returns total and eventos list", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockEvento], error: null }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.eventos).toHaveLength(1);
    expect(body.eventos[0].nombre_festejado).toBe("Mateo");
  });

  it("filters by cotizacion and confirmado states", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET();

    expect(c.in).toHaveBeenCalledWith("estado", ["cotizacion", "confirmado"]);
  });

  it("returns total=0 and empty array when no pending events", async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));

    const res = await GET();
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.eventos).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Connection error" } }));

    const res = await GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Connection error");
  });
});
