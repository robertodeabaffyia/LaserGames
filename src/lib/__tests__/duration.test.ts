import {
  formatDuration,
  parseHoras,
  parseMinutos,
  trimLeadingZeros,
  MAX_HORAS,
  MAX_MINUTOS,
} from "../duration";

// ── formatDuration ────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("shows only hours when minutes are 0", () => {
    expect(formatDuration(2, 0)).toBe("2h");
  });

  it("shows hours and minutes when both are non-zero", () => {
    expect(formatDuration(2, 30)).toBe("2h 30min");
  });

  it("shows only minutes when hours are 0", () => {
    expect(formatDuration(0, 45)).toBe("45min");
  });

  it("clamps minutes to 59", () => {
    expect(formatDuration(1, 60)).toBe("1h 59min");
  });

  it("handles 1h exactly", () => {
    expect(formatDuration(1, 0)).toBe("1h");
  });

  it("handles 1h 1min", () => {
    expect(formatDuration(1, 1)).toBe("1h 1min");
  });
});

// ── parseHoras ────────────────────────────────────────────────────────────────

describe("parseHoras", () => {
  it("parses a valid hours string", () => {
    expect(parseHoras("2")).toBe(2);
  });

  it("clamps to minHoras when below minimum", () => {
    expect(parseHoras("0", 1)).toBe(1);
  });

  it("clamps to MAX_HORAS when above maximum", () => {
    expect(parseHoras("99")).toBe(MAX_HORAS);
  });

  it("returns null for empty string", () => {
    expect(parseHoras("")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseHoras("abc")).toBeNull();
  });

  it("returns null for string with special characters", () => {
    expect(parseHoras("2.5")).toBeNull();
  });

  it("handles leading zeros as valid input", () => {
    expect(parseHoras("02")).toBe(2);
  });
});

// ── parseMinutos ──────────────────────────────────────────────────────────────

describe("parseMinutos", () => {
  it("parses a valid minutes string", () => {
    expect(parseMinutos("30")).toBe(30);
  });

  it("auto-corrects values above 59 to 59", () => {
    expect(parseMinutos("60")).toBe(MAX_MINUTOS);
    expect(parseMinutos("99")).toBe(MAX_MINUTOS);
  });

  it("accepts 0", () => {
    expect(parseMinutos("0")).toBe(0);
  });

  it("accepts 59", () => {
    expect(parseMinutos("59")).toBe(59);
  });

  it("returns null for empty string", () => {
    expect(parseMinutos("")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseMinutos("abc")).toBeNull();
  });

  it("returns null for decimal string", () => {
    expect(parseMinutos("3.5")).toBeNull();
  });

  it("handles leading zeros as valid input", () => {
    expect(parseMinutos("05")).toBe(5);
  });
});

// ── trimLeadingZeros ──────────────────────────────────────────────────────────

describe("trimLeadingZeros", () => {
  it("removes leading zeros from multi-digit string", () => {
    expect(trimLeadingZeros("030")).toBe("30");
  });

  it("leaves a single zero intact", () => {
    expect(trimLeadingZeros("0")).toBe("0");
  });

  it("leaves a string without leading zeros unchanged", () => {
    expect(trimLeadingZeros("5")).toBe("5");
  });

  it("handles multiple leading zeros", () => {
    expect(trimLeadingZeros("0030")).toBe("30");
  });

  it("handles '00' → '0'", () => {
    expect(trimLeadingZeros("00")).toBe("0");
  });

  it("returns '0' for empty string", () => {
    expect(trimLeadingZeros("")).toBe("0");
  });
});
