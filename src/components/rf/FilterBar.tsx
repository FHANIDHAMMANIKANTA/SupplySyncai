import { SEGMENTS, SOURCES, CURRENT_WEEK, weekShortLabel } from "@/lib/rf/data";
import type { Filters } from "@/lib/rf/engine";
import { titleCase } from "@/lib/rf/engine";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RANGES = [
  { label: "Full 26 weeks", from: 0 },
  { label: "Last 13 weeks", from: CURRENT_WEEK - 12 },
  { label: "Last 8 weeks", from: CURRENT_WEEK - 7 },
  { label: "Last 4 weeks", from: CURRENT_WEEK - 3 },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  );
}

const selectBase =
  "rounded-md border-border bg-card text-foreground transition-colors hover:border-primary/40";

/** The three filter selects, shared between every variant. */
function FilterFields({
  filters,
  onChange,
  selectClass,
  labels = true,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  selectClass: string;
  /** When false, labels move to aria-label so the row stays a single line. */
  labels?: boolean;
}) {
  const segment = (
    <Select
      value={filters.segment}
      onValueChange={(v) => onChange({ ...filters, segment: v as Filters["segment"] })}
    >
      <SelectTrigger aria-label="Segment" className={selectClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All segments</SelectItem>
        {SEGMENTS.map((s) => (
          <SelectItem key={s} value={s}>
            {titleCase(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const source = (
    <Select
      value={filters.source}
      onValueChange={(v) => onChange({ ...filters, source: v as Filters["source"] })}
    >
      <SelectTrigger aria-label="Source" className={selectClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All sources</SelectItem>
        {SOURCES.map((s) => (
          <SelectItem key={s} value={s}>
            {titleCase(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const range = (
    <Select
      value={String(filters.weekFrom)}
      onValueChange={(v) => onChange({ ...filters, weekFrom: Number(v), weekTo: CURRENT_WEEK })}
    >
      <SelectTrigger aria-label="Date range" className={selectClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGES.map((r) => (
          <SelectItem key={r.from} value={String(r.from)}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!labels) {
    return (
      <>
        {segment}
        {source}
        {range}
      </>
    );
  }

  return (
    <>
      <Field label="Segment">{segment}</Field>
      <Field label="Source">{source}</Field>
      <Field label="Date range">{range}</Field>
    </>
  );
}

export function FilterBar({
  filters,
  onChange,
  resultLabel,
  variant = "bar",
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  resultLabel: string;
  /**
   * "bar" is the full-width horizontal strip; "rail" stacks vertically for a
   * sidebar; "header" is a compact single-line row that sits inside the page
   * title band (no panel chrome).
   */
  variant?: "bar" | "rail" | "header";
}) {
  if (variant === "header") {
    return (
      <div
        className="flex flex-wrap items-center gap-2"
        title={`Filters apply to record creation week (${weekShortLabel(filters.weekFrom)} – ${weekShortLabel(filters.weekTo)}), before every derivation on this page.`}
      >
        <FilterFields
          filters={filters}
          onChange={onChange}
          labels={false}
          selectClass={`${selectBase} h-8 w-auto gap-2 text-[13px]`}
        />
        <span className="num flex h-8 items-center rounded-md border border-border bg-surface-sunken px-2.5 text-xs text-muted-foreground">
          {resultLabel}
        </span>
      </div>
    );
  }

  if (variant === "rail") {
    return (
      <div className="panel flex flex-col gap-3 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="eyebrow">Cohort filters</span>
          <span className="num text-xs text-muted-foreground">{resultLabel}</span>
        </div>
        <FilterFields
          filters={filters}
          onChange={onChange}
          selectClass={`${selectBase} h-9 w-full text-sm`}
        />
        <p className="text-[11px] text-muted-foreground">
          Applied to record creation week ({weekShortLabel(filters.weekFrom)} –{" "}
          {weekShortLabel(filters.weekTo)}), before every derivation on this page.
        </p>
      </div>
    );
  }

  return (
    <div className="panel flex flex-wrap items-end gap-4 px-4 py-3.5">
      <FilterFields
        filters={filters}
        onChange={onChange}
        selectClass={`${selectBase} h-9 w-auto min-w-[10rem] text-sm`}
      />

      <div className="ml-auto flex flex-col items-end gap-1.5 pb-1">
        <span className="eyebrow">Cohort in view</span>
        <span className="num text-sm">{resultLabel}</span>
      </div>
      <p className="w-full text-[11px] text-muted-foreground">
        Filters apply to record creation week ({weekShortLabel(filters.weekFrom)} –{" "}
        {weekShortLabel(filters.weekTo)}) and are applied before every derivation below.
      </p>
    </div>
  );
}
