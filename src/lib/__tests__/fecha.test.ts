/**
 * @jest-environment node
 */
import {
  formatFecha,
  formatFechaHora,
  formatFechaMes,
  formatDiaMes,
  formatHora,
  parseFecha,
} from "../fecha";

// Use local-time constructor to keep tests timezone-independent
const D = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  new Date(y, mo - 1, d, h, mi, 0);

// ─── formatFecha ──────────────────────────────────────────────────────────────

describe("formatFecha", () => {
  it("formats a Date object", () => {
    expect(formatFecha(D(2026, 5, 23))).toBe("23/05/2026");
  });

  it("pads single-digit day and month", () => {
    expect(formatFecha(D(2026, 1, 3))).toBe("03/01/2026");
  });

  it("formats a YYYY-MM-DD string without timezone shift", () => {
    expect(formatFecha("2026-05-23")).toBe("23/05/2026");
  });

  it("formats a single-digit day in YYYY-MM-DD", () => {
    expect(formatFecha("2026-01-03")).toBe("03/01/2026");
  });

  it("formats December correctly", () => {
    expect(formatFecha("2026-12-31")).toBe("31/12/2026");
  });

  it("returns — for null", () => {
    expect(formatFecha(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(formatFecha(undefined)).toBe("—");
  });

  it("returns — for an invalid string", () => {
    expect(formatFecha("not-a-date")).toBe("—");
  });

  it("returns — for empty string", () => {
    expect(formatFecha("")).toBe("—");
  });
});

// ─── formatFechaHora ──────────────────────────────────────────────────────────

describe("formatFechaHora", () => {
  it("formats date and time", () => {
    expect(formatFechaHora(D(2026, 5, 23, 15, 30))).toBe("23/05/2026 15:30");
  });

  it("pads single-digit hours and minutes", () => {
    expect(formatFechaHora(D(2026, 1, 3, 8, 5))).toBe("03/01/2026 08:05");
  });

  it("formats midnight as 00:00", () => {
    expect(formatFechaHora(D(2026, 5, 23, 0, 0))).toBe("23/05/2026 00:00");
  });

  it("returns — for null", () => {
    expect(formatFechaHora(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(formatFechaHora(undefined)).toBe("—");
  });

  it("returns — for an invalid string", () => {
    expect(formatFechaHora("garbage")).toBe("—");
  });
});

// ─── formatFechaMes ───────────────────────────────────────────────────────────

describe("formatFechaMes", () => {
  it("formats with Spanish month name", () => {
    expect(formatFechaMes(D(2026, 5, 23))).toBe("23 de mayo 2026");
  });

  it("handles all 12 months", () => {
    const expected = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    expected.forEach((mes, i) => {
      expect(formatFechaMes(D(2026, i + 1, 1))).toBe(`1 de ${mes} 2026`);
    });
  });

  it("does not pad the day", () => {
    expect(formatFechaMes(D(2026, 5, 3))).toBe("3 de mayo 2026");
  });

  it("returns — for null", () => {
    expect(formatFechaMes(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(formatFechaMes(undefined)).toBe("—");
  });
});

// ─── formatDiaMes ─────────────────────────────────────────────────────────────

describe("formatDiaMes", () => {
  it("returns day and month name without year", () => {
    expect(formatDiaMes(D(2026, 5, 23))).toBe("23 de mayo");
  });

  it("works for YYYY-MM-DD strings", () => {
    expect(formatDiaMes("2026-01-15")).toBe("15 de enero");
  });

  it("returns — for null", () => {
    expect(formatDiaMes(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(formatDiaMes(undefined)).toBe("—");
  });
});

// ─── formatHora ───────────────────────────────────────────────────────────────

describe("formatHora", () => {
  it("formats HH:mm from a Date", () => {
    expect(formatHora(D(2026, 5, 23, 15, 30))).toBe("15:30");
  });

  it("pads single-digit hour and minutes", () => {
    expect(formatHora(D(2026, 5, 23, 8, 5))).toBe("08:05");
  });

  it("formats midnight as 00:00", () => {
    expect(formatHora(D(2026, 5, 23, 0, 0))).toBe("00:00");
  });

  it("returns — for null", () => {
    expect(formatHora(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(formatHora(undefined)).toBe("—");
  });
});

// ─── parseFecha ───────────────────────────────────────────────────────────────

describe("parseFecha", () => {
  it("parses dd/mm/yyyy into a Date", () => {
    const d = parseFecha("23/05/2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4); // 0-based
    expect(d!.getDate()).toBe(23);
  });

  it("parses single-digit day and month", () => {
    const d = parseFecha("3/1/2026");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(3);
  });

  it("returns null for null", () => {
    expect(parseFecha(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseFecha(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseFecha("")).toBeNull();
  });

  it("returns null for wrong format (YYYY-MM-DD)", () => {
    expect(parseFecha("2026-05-23")).toBeNull();
  });

  it("returns null for an impossible date (31/02/2026)", () => {
    expect(parseFecha("31/02/2026")).toBeNull();
  });

  it("round-trips with formatFecha", () => {
    const original = D(2026, 5, 23);
    const formatted = formatFecha(original);
    const parsed = parseFecha(formatted);
    expect(parsed).not.toBeNull();
    expect(formatFecha(parsed!)).toBe(formatted);
  });
});
