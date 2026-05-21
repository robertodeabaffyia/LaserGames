/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock("xlsx", () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    json_to_sheet: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn(() => Buffer.from("mock-xlsx-content")),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "gte", "lte", "order"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockRegistros = [
  {
    id: "reg-1",
    fecha: "2026-05-20",
    hora_entrada: "08:00",
    hora_salida: "16:00",
    horas_trabajadas: 8,
    notas: null,
    empleado: { id: "emp-1", nombre: "Carlos López", rol: "general", tarifa_horaria: 150 },
  },
];

function req(url: string) {
  return new NextRequest(url);
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/empleados/reporte", () => {
  it("returns xlsx monthly report with correct headers", async () => {
    mockFrom.mockReturnValue(chain({ data: mockRegistros, error: null }));

    const res = await GET(req("http://localhost/api/empleados/reporte?mes=2026-05&formato=xlsx"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/spreadsheetml/);
    expect(res.headers.get("Content-Disposition")).toMatch(/reporte_horas_2026-05\.xlsx/);
  });

  it("returns 400 when mes is missing", async () => {
    const res = await GET(req("http://localhost/api/empleados/reporte?formato=xlsx"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/mes/);
  });

  it("returns 400 for invalid mes format", async () => {
    const res = await GET(req("http://localhost/api/empleados/reporte?mes=may-2026&formato=xlsx"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported formato", async () => {
    const res = await GET(req("http://localhost/api/empleados/reporte?mes=2026-05&formato=csv"));
    expect(res.status).toBe(400);
  });

  it("uses correct date range for the month", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(req("http://localhost/api/empleados/reporte?mes=2026-02&formato=xlsx"));
    expect(c.gte).toHaveBeenCalledWith("fecha", "2026-02-01");
    expect(c.lte).toHaveBeenCalledWith("fecha", "2026-02-28"); // non-leap year
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(req("http://localhost/api/empleados/reporte?mes=2026-05&formato=xlsx"));
    expect(res.status).toBe(500);
  });
});
