const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function clampPagination(
  page: number,
  limit: number
): { safeLimit: number; safeOffset: number } {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

  const safeLimit =
    Number.isFinite(limit) && limit > 0
      ? Math.min(Math.floor(limit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const safeOffset = (safePage - 1) * safeLimit;

  return { safeLimit, safeOffset };
}
