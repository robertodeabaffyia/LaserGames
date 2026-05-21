/**
 * @jest-environment node
 */
import {
  calcularHorasTrabajadas,
  validarHorario,
  validarFechaNoFutura,
  formatearHoras,
} from "../registros-horas";

// Pin today to 2026-05-21
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-05-21T12:00:00Z"));
});
afterAll(() => jest.useRealTimers());

describe("calcularHorasTrabajadas", () => {
  it("calculates whole hours correctly", () => {
    expect(calcularHorasTrabajadas("08:00", "16:00")).toBe(8);
  });

  it("calculates fractional hours correctly", () => {
    expect(calcularHorasTrabajadas("07:00", "14:30")).toBe(7.5);
  });

  it("calculates 15-minute intervals", () => {
    expect(calcularHorasTrabajadas("09:00", "09:15")).toBe(0.25);
  });

  it("handles overnight-adjacent spans within a day", () => {
    expect(calcularHorasTrabajadas("00:00", "23:59")).toBeCloseTo(23.98, 1);
  });
});

describe("validarHorario", () => {
  it("returns true when hora_salida is after hora_entrada", () => {
    expect(validarHorario("08:00", "16:00")).toBe(true);
  });

  it("returns false when hora_salida equals hora_entrada", () => {
    expect(validarHorario("09:00", "09:00")).toBe(false);
  });

  it("returns false when hora_salida is before hora_entrada", () => {
    expect(validarHorario("16:00", "08:00")).toBe(false);
  });

  it("returns true for a 1-minute difference", () => {
    expect(validarHorario("08:00", "08:01")).toBe(true);
  });
});

describe("validarFechaNoFutura", () => {
  it("returns true for today (2026-05-21)", () => {
    expect(validarFechaNoFutura("2026-05-21")).toBe(true);
  });

  it("returns true for a past date", () => {
    expect(validarFechaNoFutura("2026-01-15")).toBe(true);
  });

  it("returns false for tomorrow", () => {
    expect(validarFechaNoFutura("2026-05-22")).toBe(false);
  });

  it("returns false for a far-future date", () => {
    expect(validarFechaNoFutura("2030-12-31")).toBe(false);
  });
});

describe("formatearHoras", () => {
  it("formats whole hours", () => {
    expect(formatearHoras(8)).toBe("8h");
  });

  it("formats hours with minutes", () => {
    expect(formatearHoras(7.5)).toBe("7h 30m");
  });

  it("formats zero hours", () => {
    expect(formatearHoras(0)).toBe("0h");
  });

  it("formats 15-minute quarter", () => {
    expect(formatearHoras(0.25)).toBe("0h 15m");
  });
});
