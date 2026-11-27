/* ============================================================================
 * DELTA CHIP — renders an already-derived `Comparison` from engine.ts.
 * ----------------------------------------------------------------------------
 * Presentation only. It never subtracts, never decides a period, and never
 * infers meaning from the sign: `delta.tone` already carries whether the move
 * is favourable, and a `neutral` tone stays uncoloured on purpose. When the
 * engine returns no delta the chip shows the engine's own note instead, so a
 * suppressed or unavailable comparison is visible rather than silent.
 * ==========================================================================*/

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import type { Comparison } from "@/lib/rf/engine";

const TONE_CLASS = {
  good: "text-advanced",
  bad: "text-lost",
  neutral: "text-foreground",
} as const;

export function DeltaChip({
  c,
  fmt,
  label = "vs prior week",
  align = "right",
}: {
  c: Comparison;
  /** Formats the absolute change in the metric's own units. */
  fmt: (n: number) => string;
  label?: string;
  align?: "left" | "right";
}) {
  const side = align === "right" ? "text-right" : "text-left";

  if (!c.delta) {
    return (
      <div className={`${side} max-w-[13rem]`}>
        <p className="eyebrow">{label}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {c.note ?? "not available"}
        </p>
      </div>
    );
  }

  const d = c.delta;
  const Icon = d.absolute > 0 ? ArrowUpRight : d.absolute < 0 ? ArrowDownRight : ArrowRight;
  const sign = d.absolute > 0 ? "+" : d.absolute < 0 ? "−" : "";

  return (
    <div className={`${side} max-w-[13rem]`}>
      <p className="eyebrow">{label}</p>
      <p
        className={`num mt-1 flex items-center gap-1 text-lg leading-none ${
          align === "right" ? "justify-end" : ""
        } ${TONE_CLASS[d.tone]}`}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {sign}
        {fmt(Math.abs(d.absolute))}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {c.priorLabel && c.currentLabel ? `${c.currentLabel} vs ${c.priorLabel}` : null}
        {d.ratio !== null && (
          <>
            {" · "}
            <span className="num">
              {d.absolute > 0 ? "+" : d.absolute < 0 ? "−" : ""}
              {(Math.abs(d.ratio) * 100).toFixed(0)}%
            </span>
          </>
        )}
        {c.excludedInProgress && (
          <>
            <br />
            in-progress week excluded
          </>
        )}
      </p>
    </div>
  );
}

/** One-line variant for inside a small card, under an existing headline figure. */
export function DeltaLine({ c, fmt, label }: { c: Comparison; fmt: (n: number) => string; label: string }) {
  if (!c.delta)
    return (
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        No comparison — {c.note ?? "not available"}
      </p>
    );
  const d = c.delta;
  const sign = d.absolute > 0 ? "+" : d.absolute < 0 ? "−" : "";
  return (
    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
      <span className={`num ${TONE_CLASS[d.tone]}`}>
        {sign}
        {fmt(Math.abs(d.absolute))}
      </span>{" "}
      {label}
    </p>
  );
}
