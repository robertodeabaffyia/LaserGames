import { formatDuration } from "../duration";

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
