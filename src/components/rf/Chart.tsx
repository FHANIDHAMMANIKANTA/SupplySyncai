/* ============================================================================
 * CHART PRIMITIVES — hand-rolled SVG, no chart library.
 * ----------------------------------------------------------------------------
 * Every primitive takes already-derived values (see src/lib/rf/engine.ts) and
 * only maps them to geometry. Axes, gridlines and series colours come from the
 * design-system tokens so both themes stay AA-legible.
 * ==========================================================================*/

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Explainer } from "@/components/rf/Explainer";
import type { MetricExplainer } from "@/lib/rf/engine";

/** Series palette — semantic tokens only, in a fixed order. */
export const SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-lost)",
];

export function colorAt(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

export function ChartCard({
  title,
  subtitle,
  explain,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  explain: MetricExplainer[];
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel rf-rise px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-[16rem] flex-1">
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="ml-auto flex items-start gap-3">
          {right}
          <Explainer title={title} items={explain} />
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 rounded-full"
            style={
              it.dashed
                ? { backgroundImage: `repeating-linear-gradient(to right, ${it.color} 0 3px, transparent 3px 6px)` }
                : { backgroundColor: it.color }
            }
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Tiny inline trend line for KPI tiles. Takes an already-derived series and
 * only maps it to geometry — presentation only, no values computed here.
 */
export function Sparkline({
  values,
  color = "var(--color-chart-1)",
  w = 96,
  h = 32,
}: {
  values: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    2 + (i / (values.length - 1)) * (w - 8),
    h - 4 - ((v - min) / span) * (h - 9),
  ]);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden className="shrink-0">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
        className="rf-draw"
      />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}

/* -------------------------------------------------------------- geometry --- */

const PAD = { top: 16, right: 14, bottom: 30, left: 54 };

/**
 * Measured container width, so every chart fills its card instead of centring
 * a fixed 720-unit viewBox inside it (which left symmetric dead gutters).
 * SSR and the first client render use the 720 default; a ResizeObserver takes
 * over after mount. Presentation only — geometry re-maps, no value changes.
 */
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setW(Math.max(320, Math.round(width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

/** Week labels roughly every 90px of drawn width, never denser than every point. */
function labelCadence(n: number, w: number): number {
  return Math.max(1, Math.ceil(n / Math.max(6, Math.floor((w - PAD.left - PAD.right) / 90))));
}

/** Round a max up so the four gridline ticks land on readable round numbers. */
function niceMax(value: number, count = 4): number {
  if (value <= 0) return count;
  const rough = value / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  return step * count;
}

function gridTicks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max * i) / count);
}

function Axes({
  w,
  h,
  max,
  fmt,
  labels,
  labelEvery,
}: {
  w: number;
  h: number;
  max: number;
  fmt: (n: number) => string;
  labels: string[];
  labelEvery: number;
}) {
  const innerH = h - PAD.top - PAD.bottom;
  const innerW = w - PAD.left - PAD.right;
  return (
    <g aria-hidden>
      {gridTicks(max).map((t, i) => {
        const y = PAD.top + innerH - (max ? (t / max) * innerH : 0);
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={w - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y + 4}
              textAnchor="end"
              className="num"
              fontSize={11}
              fill="var(--color-muted-foreground)"
            >
              {fmt(t)}
            </text>
          </g>
        );
      })}
      {labels.map((label, i) =>
        i % labelEvery === 0 ? (
          <text
            key={i}
            x={PAD.left + (labels.length > 1 ? (i / (labels.length - 1)) * innerW : innerW / 2)}
            y={h - 10}
            textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="var(--color-muted-foreground)"
          >
            {label}
          </text>
        ) : null,
      )}
    </g>
  );
}

/** Shaded band marking the trailing cohorts that are still maturing. */
function MaturingBand({
  w,
  h,
  points,
  maturing,
}: {
  w: number;
  h: number;
  points: number;
  maturing: number;
}) {
  if (maturing <= 0 || points < 2) return null;
  const innerW = w - PAD.left - PAD.right;
  const step = innerW / (points - 1);
  const x = PAD.left + (points - maturing) * step - step / 2;
  return (
    <g>
      <rect
        x={Math.max(PAD.left, x)}
        y={PAD.top}
        width={Math.min(innerW, w - PAD.right - Math.max(PAD.left, x))}
        height={h - PAD.top - PAD.bottom}
        fill="var(--color-pending)"
        opacity={0.12}
      />
      <text
        x={w - PAD.right - 4}
        y={PAD.top + 11}
        textAnchor="end"
        fontSize={11}
        fill="var(--color-muted-foreground)"
      >
        still maturing
      </text>
    </g>
  );
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface Series {
  key: string;
  label: string;
  color: string;
  points: SeriesPoint[];
  /**
   * Index of the first point inside this series' own maturity budget. Points
   * from here on are drawn dashed with hollow markers: still maturing.
   */
  maturingFrom?: number;
}

/* ------------------------------------------------------------- line chart -- */

export function LineChart({
  series,
  max,
  fmt,
  maturingCount = 0,
  height = 300,
}: {
  series: Series[];
  max: number;
  fmt: (n: number) => string;
  maturingCount?: number;
  height?: number;
}) {
  const { ref, w } = useMeasuredWidth();
  const h = height;
  const innerW = w - PAD.left - PAD.right;
  const innerH = h - PAD.top - PAD.bottom;
  const n = series[0]?.points.length ?? 0;
  const x = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (max ? (v / max) * innerH : 0);

  return (
    <div ref={ref}>
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Line chart: ${series.map((s) => s.label).join(", ")}`}
    >
      <Axes
        w={w}
        h={h}
        max={max}
        fmt={fmt}
        labels={series[0]?.points.map((p) => p.label) ?? []}
        labelEvery={labelCadence(n, w)}
      />
      <MaturingBand w={w} h={h} points={n} maturing={maturingCount} />
      {series.map((s) => {
        const cut = s.maturingFrom ?? s.points.length;
        const path = (from: number, to: number) =>
          s.points
            .slice(from, to)
            .map((p, i) => `${i ? "L" : "M"}${x(from + i)} ${y(p.value)}`)
            .join(" ");
        return (
          <g key={s.key}>
            <path
              className="rf-draw"
              d={path(0, Math.min(cut + 1, s.points.length))}
              fill="none"
              stroke={s.color}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {cut < s.points.length && (
              <path
                d={path(cut, s.points.length)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray="4 3"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.75}
              />
            )}
            {s.points.map((p, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={3}
                fill={i >= cut ? "var(--color-card)" : s.color}
                stroke={s.color}
                strokeWidth={i >= cut ? 1.5 : 0}
              >
                <title>{`${s.label} · ${p.label}: ${fmt(p.value)}${i >= cut ? " (still maturing)" : ""}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/* -------------------------------------------------------- grouped bars ----- */

export function BarChart({
  series,
  max,
  fmt,
  maturingCount = 0,
  height = 200,
}: {
  series: Series[];
  max: number;
  fmt: (n: number) => string;
  maturingCount?: number;
  height?: number;
}) {
  const { ref, w } = useMeasuredWidth();
  const h = height;
  const innerW = w - PAD.left - PAD.right;
  const innerH = h - PAD.top - PAD.bottom;
  const n = series[0]?.points.length ?? 0;
  const slot = n ? innerW / n : innerW;
  const barW = Math.max(2, (slot - 3) / series.length);

  return (
    <div ref={ref}>
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Bar chart: ${series.map((s) => s.label).join(", ")}`}
    >
      <Axes
        w={w}
        h={h}
        max={max}
        fmt={fmt}
        labels={series[0]?.points.map((p) => p.label) ?? []}
        labelEvery={labelCadence(n, w)}
      />
      <MaturingBand w={w} h={h} points={n} maturing={maturingCount} />
      {series.map((s, si) =>
        s.points.map((p, i) => {
          const bh = max ? (p.value / max) * innerH : 0;
          return (
            <rect
              key={`${s.key}-${i}`}
              className="rf-grow-y"
              x={PAD.left + i * slot + 1.5 + si * barW}
              y={PAD.top + innerH - bh}
              width={barW}
              height={Math.max(0, bh)}
              fill={s.color}
              rx={1}
            >
              <title>{`${s.label} · ${p.label}: ${fmt(p.value)}`}</title>
            </rect>
          );
        }),
      )}
    </svg>
    </div>
  );
}

/* -------------------------------------------------------- stacked bars ----- */

export function StackedBarChart({
  buckets,
  keys,
  fmt,
  height = 280,
  maturingCount = 0,
}: {
  buckets: { label: string; total: number; parts: { key: string; value: number }[] }[];
  keys: string[];
  fmt: (n: number) => string;
  height?: number;
  maturingCount?: number;
}) {
  const { ref, w } = useMeasuredWidth();
  const h = height;
  const innerW = w - PAD.left - PAD.right;
  const innerH = h - PAD.top - PAD.bottom;
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const slot = buckets.length ? innerW / buckets.length : innerW;
  const barW = Math.max(3, slot - 4);

  return (
    <div ref={ref}>
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Stacked bar chart"
    >
      <Axes
        w={w}
        h={h}
        max={max}
        fmt={fmt}
        labels={buckets.map((b) => b.label)}
        labelEvery={labelCadence(buckets.length, w)}
      />
      <MaturingBand w={w} h={h} points={buckets.length} maturing={maturingCount} />
      {buckets.map((b, i) => {
        let acc = 0;
        return (
          <g key={i} className="rf-grow-y">
            {b.parts.map((part) => {
              const ph = (part.value / max) * innerH;
              const yTop = PAD.top + innerH - acc - ph;
              acc += ph;
              if (part.value <= 0) return null;
              return (
                <rect
                  key={part.key}
                  x={PAD.left + i * slot + (slot - barW) / 2}
                  y={yTop}
                  width={barW}
                  height={ph}
                  fill={colorAt(keys.indexOf(part.key))}
                >
                  <title>{`${part.key} · ${b.label}: ${fmt(part.value)}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/* ----------------------------------------------------------------- scatter - */

export interface ScatterPoint {
  label: string;
  x: number;
  y: number;
  size: number;
}

export function ScatterChart({
  points,
  xMedian,
  yMedian,
  fmtX,
  fmtY,
  fmtSize,
  xLabel,
  yLabel,
  height = 380,
}: {
  points: ScatterPoint[];
  xMedian: number;
  yMedian: number;
  fmtX: (n: number) => string;
  fmtY: (n: number) => string;
  fmtSize: (n: number) => string;
  xLabel: string;
  yLabel: string;
  height?: number;
}) {
  const { ref, w } = useMeasuredWidth();
  const h = height;
  const innerW = w - PAD.left - PAD.right;
  const innerH = h - PAD.top - PAD.bottom;
  const xMax = Math.max(1, ...points.map((p) => p.x)) * 1.15;
  const yMax = Math.max(0.01, ...points.map((p) => p.y)) * 1.2;
  const sizeMax = Math.max(1, ...points.map((p) => p.size));
  const px = (v: number) => PAD.left + (v / xMax) * innerW;
  const py = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  // Area-scaled radius so a doubled ARR does not read as a quadrupled dot.
  const pr = (v: number) => 5 + 16 * Math.sqrt(v / sizeMax);

  return (
    <div ref={ref}>
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Scatter: ${xLabel} versus ${yLabel}`}
    >
      <Axes
        w={w}
        h={h}
        max={yMax}
        fmt={fmtY}
        labels={gridTicks(xMax).map((t) => fmtX(t))}
        labelEvery={1}
      />
      {/* Quadrant hints, derived from the medians of the plotted values. */}
      <line
        x1={px(xMedian)}
        x2={px(xMedian)}
        y1={PAD.top}
        y2={h - PAD.bottom}
        stroke="var(--color-muted-foreground)"
        strokeDasharray="3 3"
        strokeWidth={1}
        opacity={0.6}
      />
      <line
        x1={PAD.left}
        x2={w - PAD.right}
        y1={py(yMedian)}
        y2={py(yMedian)}
        stroke="var(--color-muted-foreground)"
        strokeDasharray="3 3"
        strokeWidth={1}
        opacity={0.6}
      />
      <text x={w - PAD.right - 4} y={PAD.top + 11} textAnchor="end" fontSize={11} fill="var(--color-muted-foreground)">
        high volume · high win rate
      </text>
      <text x={PAD.left + 4} y={h - PAD.bottom - 5} fontSize={11} fill="var(--color-muted-foreground)">
        low volume · low win rate
      </text>
      {points.map((p) => (
        <g key={p.label} className="rf-rise">
          <circle
            cx={px(p.x)}
            cy={py(p.y)}
            r={pr(p.size)}
            fill="var(--color-chart-2)"
            opacity={0.28}
            stroke="var(--color-chart-2)"
          >
            <title>{`${p.label}: ${fmtX(p.x)} leads · ${fmtY(p.y)} win rate · ${fmtSize(p.size)} won ARR`}</title>
          </circle>
          <text
            x={px(p.x)}
            y={py(p.y) - pr(p.size) - 4}
            textAnchor="middle"
            fontSize={12}
            fill="var(--color-foreground)"
          >
            {p.label}
          </text>
        </g>
      ))}
      <text x={w / 2} y={h - 2} textAnchor="middle" fontSize={11} fill="var(--color-muted-foreground)">
        {xLabel}
      </text>
    </svg>
    </div>
  );
}

/* ------------------------------------------------- single-metric weekly ---- */

/**
 * ONE METRIC, ONE CHART. Weekly counts as bars, an authored target as a clearly
 * distinct reference line, and at most one optional rate overlay on a right
 * axis. No maturing treatment: counts are final once a week closes, and the
 * caller cannot ask for one here — that is deliberate, not an omission.
 */
export function WeeklyMetricChart({
  points,
  fmt,
  color = "var(--color-chart-1)",
  target,
  targetLabel,
  overlay,
  height = 260,
}: {
  points: SeriesPoint[];
  fmt: (n: number) => string;
  color?: string;
  target?: number | null;
  targetLabel?: string;
  overlay?: {
    label: string;
    color?: string;
    /** `defined: false` breaks the line — the rate has no denominator that week. */
    points: (SeriesPoint & { defined?: boolean })[];
    fmt: (n: number) => string;
    max: number;
  };
  height?: number;
}) {
  const { ref, w } = useMeasuredWidth();
  const h = height;
  const rightPad = overlay ? 52 : PAD.right;
  const innerW = Math.max(40, w - PAD.left - rightPad);
  const innerH = h - PAD.top - PAD.bottom;
  const dataMax = Math.max(1, ...points.map((p) => p.value), target ?? 0);
  const max = niceMax(dataMax * 1.08);
  const slot = points.length ? innerW / points.length : innerW;
  const barW = Math.max(3, slot - 4);
  const yFor = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const overlayColor = overlay?.color ?? "var(--color-chart-4)";
  const oy = (v: number) =>
    PAD.top + innerH - (overlay && overlay.max ? (v / overlay.max) * innerH : 0);
  const ox = (i: number) => PAD.left + i * slot + slot / 2;

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Weekly bar chart${overlay ? ` with ${overlay.label} overlay` : ""}`}
      >
        <Axes
          w={w - (rightPad - PAD.right)}
          h={h}
          max={max}
          fmt={fmt}
          labels={points.map((p) => p.label)}
          labelEvery={labelCadence(points.length, w)}
        />
        {points.map((p, i) => {
          const bh = (p.value / max) * innerH;
          return (
            <rect
              key={i}
              className="rf-grow-y"
              x={PAD.left + i * slot + (slot - barW) / 2}
              y={PAD.top + innerH - bh}
              width={barW}
              height={Math.max(0, bh)}
              fill={color}
              rx={1.5}
            >
              <title>{`${p.label}: ${fmt(p.value)}`}</title>
            </rect>
          );
        })}
        {typeof target === "number" && target > 0 && (
          <g>
            <line
              x1={PAD.left}
              x2={w - rightPad}
              y1={yFor(target)}
              y2={yFor(target)}
              stroke="var(--color-foreground)"
              strokeWidth={1.5}
              strokeDasharray="7 4"
              opacity={0.85}
            />
            <text
              x={PAD.left + 4}
              y={yFor(target) - 6}
              fontSize={12}
              className="num"
              fill="var(--color-foreground)"
            >
              {targetLabel ?? `target ${fmt(target)}`}
            </text>
          </g>
        )}
        {overlay && (
          <g>
            <path
              className="rf-draw"
              d={overlay.points
                .map((p, i) =>
                  p.defined === false
                    ? ""
                    : `${i === 0 || overlay.points[i - 1]?.defined === false ? "M" : "L"}${ox(i)} ${oy(p.value)}`,
                )
                .filter(Boolean)
                .join(" ")}
              fill="none"
              stroke={overlayColor}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {overlay.points.map((p, i) =>
              p.defined === false ? null : (
                <circle key={i} cx={ox(i)} cy={oy(p.value)} r={3} fill={overlayColor}>
                  <title>{`${overlay.label} · ${p.label}: ${overlay.fmt(p.value)}`}</title>
                </circle>
              ),
            )}
            {gridTicks(overlay.max, 2).map((t, i) => (
              <text
                key={i}
                x={w - rightPad + 8}
                y={oy(t) + 4}
                fontSize={11}
                className="num"
                fill={overlayColor}
              >
                {overlay.fmt(t)}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
