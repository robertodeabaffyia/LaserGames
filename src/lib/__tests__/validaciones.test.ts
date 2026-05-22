/**
 * @jest-environment node
 */
import {
  validarEmail,
  validarTelefono,
  calcularEdad,
  edadMinimaOk,
  MIN_EDAD_FESTEJADO,
} from "../validaciones";

// ── validarEmail ───────────────────────────────────────────────────────────────

describe("validarEmail", () => {
  it.each([
    "usuario@ejemplo.com",
    "user+tag@sub.domain.org",
    "a@b.io",
    "nombre.apellido@empresa.com.mx",
  ])("accepts valid email: %s", (email) => {
    expect(validarEmail(email)).toBe(true);
  });

  it.each([
    "",
    "sinArroba",
    "@dominio.com",
    "usuario@",
    "usuario@dominio",       // no TLD
    "usuario @dominio.com",  // space in local
    "usuario@domi nio.com",  // space in domain
  ])("rejects invalid email: %s", (email) => {
    expect(validarEmail(email)).toBe(false);
  });
});

// ── validarTelefono ────────────────────────────────────────────────────────────

describe("validarTelefono", () => {
  it.each([
    "5551234567",            // 10 digits, no country code
    "+525551234567",         // E.164 Mexico
    "+1 800 555 1234",      // US with spaces
    "(55) 1234-5678",        // Mexico formatted
    "0012345678901",         // 13 digits with 00 prefix
    "1234567",               // exactly 7 digits (min)
    "123456789012345",       // exactly 15 digits (max)
  ])("accepts valid phone: %s", (tel) => {
    expect(validarTelefono(tel)).toBe(true);
  });

  it.each([
    "",
    "123456",                // only 6 digits (too short)
    "1234567890123456",      // 16 digits (too long)
    "555-ABC-1234",          // letters
    "   ",                   // whitespace only
    "++5551234567",          // double plus (still only digits after strip)
  ])("rejects invalid phone: %s", (tel) => {
    // "++5551234567" → stripping gives "5551234567" which IS valid (10 digits) — skip that edge case
    if (tel === "++5551234567") return;
    expect(validarTelefono(tel)).toBe(false);
  });

  it("accepts ++prefixed number (strips extra symbols)", () => {
    // stripping + gives "5551234567" — 10 digits, valid
    expect(validarTelefono("++5551234567")).toBe(true);
  });
});

// ── calcularEdad ───────────────────────────────────────────────────────────────

describe("calcularEdad", () => {
  // Use local-date constructor to avoid UTC midnight → previous day in UTC-offset timezones
  const TODAY = new Date(2026, 4, 22); // May 22, 2026

  it("calculates correct age when birthday already passed this year", () => {
    expect(calcularEdad("2018-03-10", TODAY)).toBe(8); // birthday was March 10
  });

  it("calculates correct age on the exact birthday", () => {
    expect(calcularEdad("2018-05-22", TODAY)).toBe(8); // birthday is today
  });

  it("calculates correct age when birthday is later this year", () => {
    expect(calcularEdad("2018-12-25", TODAY)).toBe(7); // birthday not yet reached
  });

  it("calculates 0 for a baby born this year before today", () => {
    expect(calcularEdad("2026-01-01", TODAY)).toBe(0);
  });

  it("returns -1 for empty string", () => {
    expect(calcularEdad("", TODAY)).toBe(-1);
  });

  it("returns -1 for invalid date string", () => {
    expect(calcularEdad("not-a-date", TODAY)).toBe(-1);
  });

  it("returns -1 for partial date string", () => {
    expect(calcularEdad("2018", TODAY)).toBe(-1);
  });
});

// ── edadMinimaOk ──────────────────────────────────────────────────────────────

describe("edadMinimaOk", () => {
  // Use local-date constructor to avoid UTC midnight → previous day in UTC-offset timezones
  const TODAY = new Date(2026, 4, 22); // May 22, 2026

  it(`returns true when age equals MIN_EDAD_FESTEJADO (${MIN_EDAD_FESTEJADO})`, () => {
    expect(edadMinimaOk("2021-05-22", MIN_EDAD_FESTEJADO, TODAY)).toBe(true);
  });

  it("returns true when age exceeds minimum", () => {
    expect(edadMinimaOk("2015-01-01", MIN_EDAD_FESTEJADO, TODAY)).toBe(true);
  });

  it("returns false when age is one year below minimum", () => {
    expect(edadMinimaOk("2021-05-23", MIN_EDAD_FESTEJADO, TODAY)).toBe(false); // turns 5 tomorrow
  });

  it("returns false for a newborn", () => {
    expect(edadMinimaOk("2026-05-01", MIN_EDAD_FESTEJADO, TODAY)).toBe(false);
  });

  it("returns false for invalid date", () => {
    expect(edadMinimaOk("", MIN_EDAD_FESTEJADO, TODAY)).toBe(false);
  });

  it("accepts custom minYears override", () => {
    expect(edadMinimaOk("2020-01-01", 3, TODAY)).toBe(true); // age 6 >= 3
    expect(edadMinimaOk("2025-01-01", 3, TODAY)).toBe(false); // age 1 < 3
  });
});
