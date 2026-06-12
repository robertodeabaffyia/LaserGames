/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

// Mock xlsx so tests don't generate real binary data
jest.mock("xlsx", () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    aoa_to_sheet: jest.fn(() => ({})),
    json_to_sheet: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
    sheet_add_aoa: jest.fn(),
  },
  write: jest.fn(() => Buffer.from("mock-xlsx-content")),
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

const mockEmpleado = {
  id: "emp-1",
  nombre: "Carlos López",
  dni: "12345678",
  telefono: null,
  email: null,
  rol: "general",
  tarifa_horaria: 150,
  fecha_contratacion: "2025-01-15",
  es_activo: true,
  registros_horas: [
    { fecha: "2026-05-20", hora_entrada: "08:00", hora_salida: "16:00", horas_trabajadas: 8, notas: null },
  ],
};

const ID = "emp-1";
const params = { params: Promise.resolve({ id: ID }) };

function req(url: string) {
  return new NextRequest(url);
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/empleados/[id]/reporte", () => {
  it("returns xlsx file with correct headers", async () => {
    mockFrom.mockReturnValue(chain({ data: mockEmpleado, error: null }));

    const res = await GET(
      req(`http://localhost/api/empleados/${ID}/reporte?formato=xlsx`),
      params
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/spreadsheetml/);
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);
    expect(res.headers.get("Content-Disposition")).toMatch(/\.xlsx/);
  });

  it("returns 400 for unsupported formato", async () => {
    const res = await GET(
      req(`http://localhost/api/empleados/${ID}/reporte?formato=pdf`),
      params
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when empleado not found", async () => {
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await GET(
      req(`http://localhost/api/empleados/${ID}/reporte?formato=xlsx`),
      params
    );
    expect(res.status).toBe(404);
  });
});
