/**
 * @jest-environment node
 */
import { paginate, totalPages, PAGE_SIZE } from "../pagination";

describe("paginate", () => {
  const items = Array.from({ length: 15 }, (_, i) => i + 1); // [1..15]

  it("returns first 10 items on page 1 (default pageSize)", () => {
    expect(paginate(items, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("returns remaining items on last page", () => {
    expect(paginate(items, 2)).toEqual([11, 12, 13, 14, 15]);
  });

  it("returns empty array for page beyond data", () => {
    expect(paginate(items, 3)).toEqual([]);
  });

  it("returns all items when pageSize >= length", () => {
    expect(paginate(items, 1, 20)).toEqual(items);
  });

  it("handles empty array", () => {
    expect(paginate([], 1, 10)).toEqual([]);
  });

  it("paginates with custom pageSize=5 — page 1", () => {
    expect(paginate(items, 1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("paginates with custom pageSize=5 — page 2", () => {
    expect(paginate(items, 2, 5)).toEqual([6, 7, 8, 9, 10]);
  });

  it("paginates with custom pageSize=5 — page 3", () => {
    expect(paginate(items, 3, 5)).toEqual([11, 12, 13, 14, 15]);
  });

  it("handles exactly one full page", () => {
    const exact = [1, 2, 3];
    expect(paginate(exact, 1, 3)).toEqual([1, 2, 3]);
    expect(paginate(exact, 2, 3)).toEqual([]);
  });

  it("default PAGE_SIZE is 10", () => {
    expect(PAGE_SIZE).toBe(10);
    const many = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(paginate(many, 1)).toHaveLength(10);
    expect(paginate(many, 2)).toHaveLength(10);
    expect(paginate(many, 3)).toHaveLength(5);
  });

  it("works with non-numeric items (strings)", () => {
    const words = ["a", "b", "c", "d"];
    expect(paginate(words, 1, 2)).toEqual(["a", "b"]);
    expect(paginate(words, 2, 2)).toEqual(["c", "d"]);
  });
});

describe("totalPages", () => {
  it("returns 1 when count is 0", () => {
    expect(totalPages(0, 10)).toBe(1);
  });

  it("returns 1 when count < pageSize", () => {
    expect(totalPages(5, 10)).toBe(1);
  });

  it("returns 1 when count equals pageSize", () => {
    expect(totalPages(10, 10)).toBe(1);
  });

  it("returns 2 when count is 1 over pageSize", () => {
    expect(totalPages(11, 10)).toBe(2);
  });

  it("returns correct ceiling for non-divisible counts", () => {
    expect(totalPages(15, 10)).toBe(2);
    expect(totalPages(19, 10)).toBe(2);
    expect(totalPages(21, 10)).toBe(3);
  });

  it("uses default PAGE_SIZE when pageSize is omitted", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(10)).toBe(1);
    expect(totalPages(11)).toBe(2);
    expect(totalPages(25)).toBe(3);
  });

  it("works with small pageSize=2", () => {
    expect(totalPages(2, 2)).toBe(1);
    expect(totalPages(3, 2)).toBe(2);
    expect(totalPages(4, 2)).toBe(2);
    expect(totalPages(5, 2)).toBe(3);
  });
});
