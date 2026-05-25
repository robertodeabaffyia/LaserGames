/**
 * @jest-environment node
 */
import { diasHastaCumple, formatFechaCumple } from "../cumpleanos";

describe("diasHastaCumple", () => {
  it("returns 0 when today is the birthday", () => {
    const hoy = new Date(2026, 6, 15); // July 15 2026
    expect(diasHastaCumple("2000-07-15", hoy)).toBe(0);
  });

  it("returns correct days within the same year", () => {
    const hoy = new Date(2026, 6, 1); // July 1 2026
    expect(diasHastaCumple("2000-07-15", hoy)).toBe(14);
  });

  it("wraps around the year boundary correctly", () => {
    const hoy = new Date(2026, 11, 28); // Dec 28 2026
    // Birthday is Jan 3 → 6 days away
    expect(diasHastaCumple("2000-01-03", hoy)).toBe(6);
  });

  it("handles birthday already passed this year", () => {
    const hoy = new Date(2026, 6, 20); // Jul 20 2026
    // Birthday was Jul 10 → next one is Jul 10 2027 → 355 days
    const result = diasHastaCumple("2000-07-10", hoy);
    // Between 354 and 366 (accounting for leap year)
    expect(result).toBeGreaterThan(350);
    expect(result).toBeLessThan(366);
  });

  it("handles Feb 29 birthday in non-leap year", () => {
    const hoy = new Date(2026, 1, 15); // Feb 15 2026 (not leap)
    // Feb 29 doesn't exist in 2026, JS Date rolls it to Mar 1
    const result = diasHastaCumple("2000-02-29", hoy);
    // Should still return a positive number
    expect(result).toBeGreaterThan(0);
  });
});

describe("formatFechaCumple", () => {
  it("formats birthday as 'day de month' in Spanish", () => {
    const hoy = new Date(2026, 5, 1); // Jun 1 2026
    const result = formatFechaCumple("2000-08-15", hoy);
    expect(result).toMatch(/15/);
    expect(result.toLowerCase()).toMatch(/agosto/);
  });

  it("handles upcoming birthday in current year", () => {
    const hoy = new Date(2026, 0, 1); // Jan 1 2026
    const result = formatFechaCumple("2000-03-20", hoy);
    expect(result.toLowerCase()).toMatch(/marzo/);
    expect(result).toMatch(/20/);
  });
});
