import type { AptSortKey } from "@/lib/apt/card-types";

export function buildOrderClause(sort: AptSortKey | null | undefined): string {
  switch (sort) {
    case "deadline":   return "date_end ASC NULLS LAST, dday_end ASC NULLS LAST";
    case "ongoing":    return "(status = 'ongoing') DESC, date_end ASC NULLS LAST";
    case "name":       return "name ASC";
    case "price_asc":  return "price_per_pyeong ASC NULLS LAST";
    case "price_desc": return "price_per_pyeong DESC NULLS LAST";
    case "newest":
    default:           return "created_at DESC, id DESC";
  }
}

export function applySort<T extends { order: (column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => T }>(
  query: T, sort: AptSortKey | null | undefined,
): T {
  switch (sort) {
    case "deadline":
      return query.order("date_end", { ascending: true, nullsFirst: false })
                  .order("dday_end", { ascending: true, nullsFirst: false });
    case "ongoing":
      return query.order("date_end", { ascending: true, nullsFirst: false });
    case "name":       return query.order("name", { ascending: true });
    case "price_asc":  return query.order("price_per_pyeong", { ascending: true, nullsFirst: false });
    case "price_desc": return query.order("price_per_pyeong", { ascending: false, nullsFirst: false });
    case "newest":
    default:
      return query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }
}
