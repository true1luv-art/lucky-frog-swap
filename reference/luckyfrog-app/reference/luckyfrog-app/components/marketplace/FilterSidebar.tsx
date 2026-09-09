"use client";

/**
 * components/marketplace/FilterSidebar.tsx
 *
 * Filter sidebar for the marketplace browse view. §4.3-E
 *
 * Exposes price range (min/max) and sort order.
 * All filter state is lifted to the parent MarketplaceClient via onChange callbacks.
 *
 * Collapses to a sheet/drawer on small screens — the parent renders a trigger button.
 *
 * Reference: docs/implementation_plans/phase-04-marketplace.md §4.3-E
 */

const SORT_OPTIONS = [
  { value: "newest",       label: "Newest first" },
  { value: "oldest",       label: "Oldest first" },
  { value: "price_asc",    label: "Price: low to high" },
  { value: "price_desc",   label: "Price: high to low" },
  { value: "quantity_desc",label: "Quantity: most first" },
] as const;

export interface FilterState {
  sort:     string;
  minPrice: string;
  maxPrice: string;
}

interface FilterSidebarProps {
  filters:        FilterState;
  onChange:       (next: Partial<FilterState>) => void;
  onReset:        () => void;
}

export const DEFAULT_FILTERS: FilterState = {
  sort:     "newest",
  minPrice: "",
  maxPrice: "",
};

export function FilterSidebar({ filters, onChange, onReset }: FilterSidebarProps) {
  const hasActive =
    filters.sort !== "newest" ||
    filters.minPrice !== "" ||
    filters.maxPrice !== "";

  return (
    <aside className="flex flex-col gap-5" aria-label="Listing filters">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-pixel text-[9px] uppercase text-foreground">Filters</span>
        {hasActive && (
          <button
            type="button"
            onClick={onReset}
            className="text-[9px] font-sans text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Sort */}
      <div className="flex flex-col gap-2">
        <label className="font-pixel text-[8px] uppercase text-muted-foreground">
          Sort
        </label>
        <select
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          className="border-2 border-border bg-card text-foreground text-xs font-sans px-2 py-1.5 focus:outline-none focus:border-primary"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Price range */}
      <div className="flex flex-col gap-2">
        <label className="font-pixel text-[8px] uppercase text-muted-foreground">
          Price (LFRG)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => onChange({ minPrice: e.target.value })}
            className="w-full border-2 border-border bg-card text-foreground text-xs font-sans px-2 py-1.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground/60"
          />
          <span className="text-muted-foreground text-xs shrink-0">—</span>
          <input
            type="number"
            min={0}
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => onChange({ maxPrice: e.target.value })}
            className="w-full border-2 border-border bg-card text-foreground text-xs font-sans px-2 py-1.5 focus:outline-none focus:border-primary placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

    </aside>
  );
}
