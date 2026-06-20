/**
 * @jest-environment node
 */
import {
  diasHastaProximo,
  isEstasSemana,
  isProximoMes,
  sortByDias,
  filtrarClientesPorMesHijo,
  hijosEnMes,
  type BirthdayEntry,
} from "../birthday";

// Fix current date to 2026-05-21 (Wednesday)
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-05-21T12:00:00Z"));
});

afterAll(() => {
  jest.useRealTimers();
});

describe("diasHastaProximo", () => {
  it("returns 0 when birthday is today (same month/day)", () => {
    expect(diasHastaProximo("1990-05-21")).toBe(0);
  });

  it("returns correct days when birthday is this week", () => {
    expect(diasHastaProximo("1990-05-24")).toBe(3);
  });

  it("wraps to next year when birthday already passed this year", () => {
    // 2026-01-10 already passed — next occurrence is 2027-01-10
    const dias = diasHastaProximo("1990-01-10");
    // From May 21 to Jan 10 next year: 365 - ~131 = ~234
    expect(dias).toBeGreaterThan(200);
    expect(dias).toBeLessThan(300);
  });

  it("handles December birthdays from late November (year rollover)", () => {
    const dias = diasHastaProximo("1990-12-25");
    expect(dias).toBeGreaterThan(0);
  });
});

describe("isEstasSemana", () => {
  it("returns true for 0 days (today)", () => {
    expect(isEstasSemana(0)).toBe(true);
  });

  it("returns true for exactly 7 days", () => {
    expect(isEstasSemana(7)).toBe(true);
  });

  it("returns false for 8 days", () => {
    expect(isEstasSemana(8)).toBe(false);
  });
});

describe("isProximoMes", () => {
  it("returns true for a birthday in June (next month from May)", () => {
    // June birthday, not esta semana
    expect(isProximoMes("1990-06-15", 25)).toBe(true);
  });

  it("returns false when birthday is esta semana (mutually exclusive)", () => {
    // Even if the month is June, if it's within 7 days skip proximo_mes
    expect(isProximoMes("1990-06-01", 0)).toBe(false);
  });

  it("returns false for a birthday in the same month", () => {
    expect(isProximoMes("1990-05-30", 9)).toBe(false);
  });

  it("returns false for a birthday two months away", () => {
    expect(isProximoMes("1990-07-10", 50)).toBe(false);
  });
});

// ── filtrarClientesPorMesHijo ─────────────────────────────────────────────────

describe("filtrarClientesPorMesHijo", () => {
  const hijo = (mes: number) => ({ fecha_nacimiento: `2020-${String(mes).padStart(2, "0")}-15`, nombre: "test" });

  const clientes = [
    { id: "c1", hijos: [hijo(6), hijo(9)] },  // June + September
    { id: "c2", hijos: [hijo(6)] },            // June only
    { id: "c3", hijos: [hijo(12)] },           // December only
    { id: "c4", hijos: [] },                    // no children
  ];

  it("returns all clients when mes is ''", () => {
    expect(filtrarClientesPorMesHijo(clientes, "")).toHaveLength(4);
  });

  it("returns only clients with a child birthday in the selected month", () => {
    const result = filtrarClientesPorMesHijo(clientes, 6);
    expect(result.map((c) => c.id)).toEqual(expect.arrayContaining(["c1", "c2"]));
    expect(result).toHaveLength(2);
  });

  it("excludes clients with no children", () => {
    expect(filtrarClientesPorMesHijo(clientes, 6).map((c) => c.id)).not.toContain("c4");
  });

  it("returns empty when no child matches the month", () => {
    expect(filtrarClientesPorMesHijo(clientes, 3)).toHaveLength(0);
  });

  it("matches a client with multiple children when only one matches", () => {
    const result = filtrarClientesPorMesHijo(clientes, 9);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
  });

  it("does not mutate the input array", () => {
    filtrarClientesPorMesHijo(clientes, 6);
    expect(clientes).toHaveLength(4);
  });
});

// ── hijosEnMes ────────────────────────────────────────────────────────────────

describe("hijosEnMes", () => {
  const hijos = [
    { nombre: "Lucía",   fecha_nacimiento: "2019-06-19" },
    { nombre: "Tomás",   fecha_nacimiento: "2021-06-03" },
    { nombre: "Valentina", fecha_nacimiento: "2020-09-10" },
  ];

  it("returns [] when mes is ''", () => {
    expect(hijosEnMes(hijos, "")).toHaveLength(0);
  });

  it("returns matching children with formatted dia", () => {
    const result = hijosEnMes(hijos, 6);
    expect(result).toHaveLength(2);
    expect(result.map((h) => h.nombre)).toEqual(expect.arrayContaining(["Lucía", "Tomás"]));
  });

  it("formats dia as dd/mm", () => {
    const result = hijosEnMes(hijos, 6);
    const lucia = result.find((h) => h.nombre === "Lucía");
    expect(lucia?.dia).toBe("19/06");
  });

  it("returns [] when no child matches the month", () => {
    expect(hijosEnMes(hijos, 12)).toHaveLength(0);
  });

  it("returns a single match when only one child matches", () => {
    const result = hijosEnMes(hijos, 9);
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe("Valentina");
    expect(result[0].dia).toBe("10/09");
  });
});

describe("sortByDias", () => {
  const makeEntry = (id: string, dias: number): BirthdayEntry => ({
    id,
    nombre: id,
    fecha: "1990-01-01",
    tipo: "cliente",
    cliente_id: id,
    dias_restantes: dias,
  });

  it("sorts entries ascending by dias_restantes", () => {
    const entries = [makeEntry("c", 10), makeEntry("a", 2), makeEntry("b", 5)];
    const sorted = sortByDias(entries);
    expect(sorted.map((e) => e.dias_restantes)).toEqual([2, 5, 10]);
  });

  it("does not mutate the original array", () => {
    const entries = [makeEntry("b", 5), makeEntry("a", 2)];
    sortByDias(entries);
    expect(entries[0].id).toBe("b");
  });
});
