/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

jest.useFakeTimers();
jest.setSystemTime(new Date("2026-05-21T12:00:00Z"));

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

// Mock auth-helpers so role checks don't touch the DB
jest.mock("@/lib/auth-helpers", () => {
  const actual = jest.requireActual("@/lib/auth-helpers");
  return {
    ...actual,
    getUserRol: jest.fn().mockResolvedValue("supervisor"),
  };
});

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of [
    "select", "insert", "update", "delete", "eq", "gte", "lte",
    "order", "single", "not", "filter",
  ]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockEmpleados = [
  { id: "emp-1", nombre: "Ana López", tarifa_horaria: 100 },
  { id: "emp-2", nombre: "Luis Pérez", tarifa_horaria: 80 },
];

const mockRegistros = [
  { empleado_id: "emp-1", horas_trabajadas: 40 },
  { empleado_id: "emp-1", horas_trabajadas: 8 },
  { empleado_id: "emp-2", horas_trabajadas: 30 },
];

const mockBonos = [
  { empleado_id: "emp-1", monto_bono: 500 },
];

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/salarios/procesar-nomina", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("POST /api/salarios/procesar-nomina", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(postReq({ mes: "2026-05" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is general", async () => {
    const { getUserRol } = jest.requireMock("@/lib/auth-helpers");
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");
    const res = await POST(postReq({ mes: "2026-05" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when mes is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/mes/);
  });

  it("returns 400 when mes has invalid format", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(postReq({ mes: "05-2026" }));
    expect(res.status).toBe(400);
  });

  it("returns empty procesados when no active employees with tarifa", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })); // empleados query

    const res = await POST(postReq({ mes: "2026-05" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.procesados).toHaveLength(0);
  });

  it("creates salary and bono egresos and returns procesados", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const insertSalario1Chain = chain({ data: null, error: null });
    const insertBono1Chain    = chain({ data: null, error: null });
    const insertSalario2Chain = chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(chain({ data: mockEmpleados, error: null }))  // empleados
      .mockReturnValueOnce(chain({ data: mockRegistros, error: null }))  // registros_horas
      .mockReturnValueOnce(chain({ data: mockBonos, error: null }))      // bonos
      .mockReturnValueOnce(insertSalario1Chain)                          // insert salario emp-1
      .mockReturnValueOnce(insertBono1Chain)                             // insert bono emp-1
      .mockReturnValueOnce(insertSalario2Chain);                         // insert salario emp-2

    const res = await POST(postReq({ mes: "2026-05" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.mes).toBe("2026-05");
    expect(body.procesados).toHaveLength(2);

    const ana = body.procesados.find((p: { nombre: string }) => p.nombre === "Ana López");
    expect(ana.horas).toBe(48);           // 40 + 8
    expect(ana.total_salario).toBe(4800); // 48 × 100
    expect(ana.total_bonos).toBe(500);
    expect(ana.total_egreso).toBe(5300);

    const luis = body.procesados.find((p: { nombre: string }) => p.nombre === "Luis Pérez");
    expect(luis.horas).toBe(30);
    expect(luis.total_salario).toBe(2400); // 30 × 80
    expect(luis.total_bonos).toBe(0);
    expect(luis.total_egreso).toBe(2400);

    // Verify salary insert called with correct data for emp-1
    expect(insertSalario1Chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "egreso",
        categoria: "salario",
        empleado_id: "emp-1",
        monto: 4800,
      })
    );

    // Verify bono insert called for emp-1
    expect(insertBono1Chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "egreso",
        categoria: "bono",
        empleado_id: "emp-1",
        monto: 500,
      })
    );
  });

  it("skips salary insert when employee has 0 hours worked", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const empSinHoras = [{ id: "emp-3", nombre: "Sin horas", tarifa_horaria: 100 }];

    mockFrom
      .mockReturnValueOnce(chain({ data: empSinHoras, error: null })) // empleados
      .mockReturnValueOnce(chain({ data: [], error: null }))          // no registros
      .mockReturnValueOnce(chain({ data: [], error: null }));         // no bonos

    const res = await POST(postReq({ mes: "2026-05" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const emp = body.procesados[0];
    expect(emp.total_salario).toBe(0);
    expect(emp.total_egreso).toBe(0);
    // No movimientos_caja insert should have been called
    expect(mockFrom).toHaveBeenCalledTimes(3); // empleados + registros + bonos only
  });

  it("returns 500 on empleados DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

    const res = await POST(postReq({ mes: "2026-05" }));
    expect(res.status).toBe(500);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const badReq = new NextRequest("http://localhost/api/salarios/procesar-nomina", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
