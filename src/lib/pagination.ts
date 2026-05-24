export const PAGE_SIZE = 10;

/** Returns the slice of `items` for the given 1-based `page`. */
export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Total number of pages, always at least 1. */
export function totalPages(count: number, pageSize = PAGE_SIZE): number {
  if (count === 0) return 1;
  return Math.ceil(count / pageSize);
}
