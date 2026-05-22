/**
 * @jest-environment node
 */
import { rangoFromPeriodo } from "../PeriodoPicker";

jest.useFakeTimers();
jest.setSystemTime(new Date("2026-05-21T12:00:00Z")); // Thursday

describe("rangoFromPeriodo", () => {
  it("dia returns today for both desde and hasta", () => {
    const r = rangoFromPeriodo("dia");
    expect(r.desde).toBe("2026-05-21");
    expect(r.hasta).toBe("2026-05-21");
  });

  it("semana returns Monday–Sunday of the current week", () => {
    // 2026-05-21 is Thursday → Mon = 05-18, Sun = 05-24
    const r = rangoFromPeriodo("semana");
    expect(r.desde).toBe("2026-05-18");
    expect(r.hasta).toBe("2026-05-24");
  });

  it("mes returns first and last day of current month", () => {
    const r = rangoFromPeriodo("mes");
    expect(r.desde).toBe("2026-05-01");
    expect(r.hasta).toBe("2026-05-31");
  });

  it("anio returns first and last day of current year", () => {
    const r = rangoFromPeriodo("anio");
    expect(r.desde).toBe("2026-01-01");
    expect(r.hasta).toBe("2026-12-31");
  });

  it("custom returns provided rango", () => {
    const custom = { desde: "2026-03-01", hasta: "2026-03-15" };
    const r = rangoFromPeriodo("custom", custom);
    expect(r.desde).toBe("2026-03-01");
    expect(r.hasta).toBe("2026-03-15");
  });

  it("custom with no rango falls back to today", () => {
    const r = rangoFromPeriodo("custom");
    expect(r.desde).toBe("2026-05-21");
    expect(r.hasta).toBe("2026-05-21");
  });
});
