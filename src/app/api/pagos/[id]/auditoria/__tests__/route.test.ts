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
  for (const m of ["select", "eq", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const PAGO_ID = "pago-1";
const params = { params: Promise.resolve({ id: PAGO_ID }) };

const mockAuditoriaEntries = [
  {
    id: "aud-1",
    pago_id: PAGO_ID,
    accion: "crear",
    fecha: "2026-06-01T10:00:00Z",
    usuario_id: "user-1",
    cambios: { monto: 1000, metodo: "efectivo" },
  },
  {
    id: "aud-2",
    pago_id: PAGO_ID,
    accion: "editar",
    fecha: "2026-06-02T11:00:00Z",
    usuario_id: "user-1",
    cambios: { antes: { notas: null }, despues: { notas: "Comprobante #12" } },
  },
];

function req() {
  return new NextRequest(`http://localhost/api/pagos/${PAGO_ID}/auditoria`);
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/pagos/[id]/auditoria", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when pago is not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await GET(req(), params);
    expect(res.status).toBe(404);
  });

  it("returns 200 with sorted audit entries", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: PAGO_ID }, error: null })) // pago verify
      .mockReturnValueOnce(chain({ data: mockAuditoriaEntries, error: null })); // auditoria

    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].accion).toBe("crear");
    expect(body[1].accion).toBe("editar");
  });

  it("returns empty array when no audit entries exist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: PAGO_ID }, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));

    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 500 on DB error fetching auditoria", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: PAGO_ID }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(req(), params);
    expect(res.status).toBe(500);
  });

  it("queries pagos_auditoria filtered by pago_id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { id: PAGO_ID }, error: null }));
    const auditChain = chain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(auditChain);

    await GET(req(), params);
    expect(mockFrom).toHaveBeenCalledWith("pagos_auditoria");
    expect(auditChain.eq).toHaveBeenCalledWith("pago_id", PAGO_ID);
    expect(auditChain.order).toHaveBeenCalledWith("fecha", { ascending: true });
  });
});
