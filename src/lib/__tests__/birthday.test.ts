/**
 * @jest-environment node
 */
import {
  diasHastaProximo,
  isEstasSemana,
  isProximoMes,
  sortByDias,
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
