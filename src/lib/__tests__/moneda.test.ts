import { formatMoneda } from "../moneda";

describe("formatMoneda", () => {
  it("formats an integer (no decimals)", () => {
    const result = formatMoneda(1000);
    expect(result).toMatch(/1\.000/); // thousands separator is "."
    expect(result).not.toMatch(/,00/); // no trailing decimals
  });

  it("formats a decimal value (keeps up to 2 places)", () => {
    const result = formatMoneda(1234.5);
    expect(result).toMatch(/1\.234/);
    expect(result).toMatch(/,5/);
  });

  it("formats two decimal places when needed", () => {
    const result = formatMoneda(999.99);
    expect(result).toMatch(/999,99/);
  });

  it("handles zero", () => {
    expect(formatMoneda(0)).toMatch(/0/);
  });

  it("handles null → $0", () => {
    expect(formatMoneda(null)).toBe("$0");
  });

  it("handles undefined → $0", () => {
    expect(formatMoneda(undefined)).toBe("$0");
  });

  it("formats large numbers with thousand separators", () => {
    const result = formatMoneda(1000000);
    expect(result).toMatch(/1\.000\.000/);
  });

  it("includes currency symbol", () => {
    const result = formatMoneda(500);
    expect(result).toMatch(/\$/);
  });

  it("formats negative values", () => {
    const result = formatMoneda(-250);
    expect(result).toMatch(/250/);
    expect(result).toMatch(/-/);
  });
});
