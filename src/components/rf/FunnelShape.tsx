/* ============================================================================
 * FUNNEL SHAPE — hand-rolled SVG, honest geometry.
 * ----------------------------------------------------------------------------
 * Nothing here computes a business number. All proportions arrive from
 * `funnelGeometry()` in src/lib/rf/engine.ts.
 *
 * The diagram is a MIRRORED FUNNEL-SHAPED SANKEY ("butterfly"). A single
 * centred trunk carries the live cohort top to bottom. At every stage:
 *
 *   dropped  streams LEFT as a horizontal ribbon,
 *   pending  streams RIGHT as a horizontal ribbon,
 *   advanced continues down the trunk, which narrows by exactly what left.
 *
 * SCALE. One units-per-record scale for everything:
 *
 *   trunk width_i     = intake_i  ÷ intake_0 × MAX_W
 *   ribbon thickness  = wing.frac × MAX_W       (thickness AT THE TRUNK)
 *
 * DEPARTURE IS THICKEST AT THE TRUNK. A ribbon meets the trunk at its full
 * proportional thickness and both narrows AND fades as it travels outward to
 * its rail. The encoded value is therefore drawn at full strength exactly
 * where the volume leaves, which is what makes the trunk's narrowing caused
 * rather than asserted. The outward taper is style only and carries nothing.
 *
 * LABEL PLACEMENT is decided per band at render time from the band's own drawn
 * width: a label sits inside the trunk only when every one of its lines fits
 * with real padding on both sides, otherwise the whole block moves to a fixed
 * external rail with a leader line back to the trunk edge. No text is ever
 * given an outline stroke to survive a collision.
 *
 * TYPE. Monospace is for numerals only; words are set in the sans face.
 *
 * This file only turns fractions into pixels.
 * ==========================================================================*/

import { useState } from "react";
import {
  fmtArr,
  fmtInt,
  fmtPct,
  type FunnelBand,
  type FunnelWing,
  type StageConfig,
  type WingSliver,
} from "@/lib/rf/engine";

/* ------------------------------------------------------------ layout metrics */

const VB_W = 1100;
/** Horizontal centre of the trunk. */
const CENTER = 550;
/** Widest trunk. Units-per-record for trunk widths AND ribbon thicknesses. */
const MAX_W = 420;

const PAD_TOP = 54;
/** Minimum row height; rows grow so their thickest ribbon and label block fit. */
const ROW_MIN = 84;
const ROW_PAD = 26;
/** Straight stem below the last row, then the terminal bar and figure. */
const CAP_STEM = 20;
const CAP_BAR = 6;
const CAP_TEXT = 60;

/** Ribbon tips land on these rails; label blocks sit beyond them. */
const END_L = 225;
const END_R = 875;

/* Rail text columns. Counts are right-aligned in their own column so the
   figures form a vertical column, and the reason follows the count. */
const L_NUM_X = 70;
const L_LAB_X = 78;
const R_NUM_X = END_R + 58;
const R_LAB_X = END_R + 66;

/** Fixed rail for stage labels that cannot fit inside the trunk. */
const STAGE_RAIL_X = CENTER + MAX_W / 2 + 26;

const LINE_H = 19;

/** Below this drawn thickness a ribbon gets a dotted leader to its label. */
const THREAD_PX = 4;
/** Antialiasing minimum only — never a data floor. */
const HAIRLINE = 1.1;

/** Solid tone, used for endpoint ticks, leaders and figures. */
const WING_FILL = {
  pending: "var(--pending)",
  dropped: "var(--lost)",
} as const;

const WING_GRADIENT = {
  pending: "url(#rf-g-pending)",
  dropped: "url(#rf-g-dropped)",
} as const;

const WING_WORD = { pending: "still pending", dropped: "dropped" } as const;

/** Reason rows shown individually before the remainder is pooled. */
const MAX_REASON_ROWS = 3;

type Rec = { id: string; companyName: string; source: string; segment: string };

/* ------------------------------------------------------------------ helpers */

/** Medians are whole weeks; 0 means "inside the first week", not "instant". */
function fmtWeeks(w: number | null) {
  if (w === null) return "—";
  return w === 0 ? "<1w" : `${w}w`;
}

/**
 * Advance-width estimate. Deliberately generous (it over-estimates rather than
 * under-estimates) because it gates the inside/outside label decision and a
 * label that spills is worse than one that moved out early.
 */
function estW(text: string, size: number, mono = false) {
  return text.length * size * (mono ? 0.62 : 0.55);
}

function thicknessOf(wing: FunnelWing) {
  return Math.max(HAIRLINE, wing.frac * MAX_W);
}

/**
 * Rail rows for a wing's reason breakdown. Every record is accounted for: past
 * MAX_REASON_ROWS the tail is pooled into an explicit, labelled remainder row
 * so the rows always sum to the wing total. Nothing is silently dropped.
 */
function reasonRows(parts: WingSliver[]) {
  if (parts.length <= MAX_REASON_ROWS + 1) return parts;
  const head = parts.slice(0, MAX_REASON_ROWS);
  const tail = parts.slice(MAX_REASON_ROWS);
  return [
    ...head,
    {
      key: "__rest",
      label: `other reasons (${tail.length})`,
      count: tail.reduce((s, p) => s + p.count, 0),
      arr: tail.reduce((s, p) => s + p.arr, 0),
      share: tail.reduce((s, p) => s + p.share, 0),
    },
  ];
}

/**
 * A horizontal ribbon slab: full proportional height (yT0..yB0) where it meets
 * the trunk, narrowing to (yT1..yB1) at its rail. Both edges are cubics with
 * horizontal tangents, so the outward narrowing reads as a stream receding
 * rather than as a change of value.
 */
function ribbonPath(x0: number, xe: number, yT0: number, yB0: number, yT1: number, yB1: number) {
  const dir = xe < x0 ? -1 : 1;
  const k = Math.abs(x0 - xe) * 0.42;
  return [
    `M${x0},${yT0}`,
    `C${x0 + dir * k},${yT0} ${xe - dir * k},${yT1} ${xe},${yT1}`,
    `L${xe},${yB1}`,
    `C${xe - dir * k},${yB1} ${x0 + dir * k},${yB0} ${x0},${yB0}`,
    "Z",
  ].join(" ");
}

/** Lines a wing's rail block needs: header plus one visible reason line.
    The full reason split lives in the hover tooltip, not on the rail. */
function wingLines(wing: FunnelWing) {
  return wing.slivers.length > 0 ? 2 : 1;
}

/* -------------------------------------------------------------------- ribbon */

function Wing({
  wing,
  yc,
  left,
  intakeFrac,
  arrMode,
  delay,
  animKey,
  opacity,
  lit,
  onTrace,
}: {
  wing: FunnelWing;
  /** Vertical centre of the wing's row. */
  yc: number;
  left: boolean;
  /** The stage's own frac (intake ÷ first) — pct is wing.frac ÷ intakeFrac. */
  intakeFrac: number;
  arrMode: boolean;
  delay: number;
  animKey: string;
  opacity: string;
  lit: boolean;
  onTrace: () => void;
}) {
  const t = thicknessOf(wing);
  /** Outward taper: style only. The trunk-side thickness is the value. */
  const tip = Math.max(2, t * 0.42);
  const thread = t < THREAD_PX;
  const endX = left ? END_L : END_R;
  const color = WING_FILL[wing.band];
  const share = wing.frac / (intakeFrac || 1);

  const parts = wing.slivers;

  // Strand i occupies the same interval of the trunk-side thickness AND of the
  // tip, so strands nest without crossing by construction.
  let acc = 0;
  const strands = (
    parts.length > 1
      ? parts
      : [
          {
            key: wing.band,
            label: wing.slivers[0]?.label ?? WING_WORD[wing.band],
            count: wing.count,
            arr: wing.arr,
            share: 1,
          },
        ]
  ).map((p, i, all) => {
    const yT0 = yc - t / 2 + acc * t;
    const yT1 = yc - tip / 2 + acc * tip;
    const h0 = Math.max(0.6, p.share * t);
    const h1 = Math.max(0.5, p.share * tip);
    acc += p.share;
    return {
      key: p.key,
      d: ribbonPath(CENTER, endX, yT0, yT0 + h0, yT1, yT1 + h1),
      opacity: all.length > 1 ? 1 - (i * 0.5) / all.length : 1,
      title: `${p.label}: ${fmtInt(p.count)} · ${fmtArr(p.arr)}`,
    };
  });

  /* The header reads "<count> <band word> <share>". Only the leading reason is
     printed beneath it; the complete split — pooled remainder included, so it
     still reconciles to the wing total — moves to the hover tooltip. */
  const rows = reasonRows(parts);
  const headWord = WING_WORD[wing.band];
  const topReason = rows[0] ?? null;
  const splitTitle = [
    `${arrMode ? fmtArr(wing.arr) : fmtInt(wing.count)} ${headWord} (${fmtPct(share)} of stage intake)`,
    ...rows.map((p) => `${arrMode ? fmtArr(p.arr) : fmtInt(p.count)} — ${p.label}`),
  ].join("\n");

  const lines = topReason ? 2 : 1;
  const y0 = yc - ((lines - 1) * LINE_H) / 2 + 5;
  const numX = left ? L_NUM_X : R_NUM_X;
  const labX = left ? L_LAB_X : R_LAB_X;

  return (
    <g
      key={`${animKey}-${wing.band}`}
      className="rf-wing"
      style={{ animationDelay: `${delay}ms`, transformOrigin: `${CENTER}px ${yc}px` }}
      onPointerEnter={onTrace}
    >
      <g style={{ opacity, transition: "opacity 220ms ease-out" }}>
        {strands.map((s) => (
          <path
            key={s.key}
            d={s.d}
            fill={WING_GRADIENT[wing.band]}
            fillOpacity={s.opacity}
            stroke={color}
            strokeOpacity={0.28}
            strokeWidth={0.5}
          >
            <title>{s.title}</title>
          </path>
        ))}
        {!thread && (
          <path
            d={`M${CENTER},${yc} L${endX},${yc}`}
            fill="none"
            stroke={color}
            strokeWidth={lit ? 1.6 : 1}
            strokeLinecap="round"
            strokeDasharray="3 26"
            className="rf-current pointer-events-none"
            style={{ opacity: lit ? 0.9 : 0.32 }}
          />
        )}
      </g>

      {/* Endpoint tick, so hairline ribbons stay locatable at their rail. */}
      <rect
        x={left ? endX - 3 : endX}
        y={yc - Math.max(5, tip / 2)}
        width={3}
        height={Math.max(10, tip)}
        fill={color}
        fillOpacity={0.85}
      />
      {/* Leader from the rail back to the label column. */}
      <line
        x1={left ? endX - 6 : endX + 6}
        y1={yc}
        x2={left ? labX + 4 : labX - 10}
        y2={yc}
        stroke={color}
        strokeOpacity={thread ? 0.45 : 0.22}
        strokeWidth={1}
        strokeDasharray="2 4"
      />

      {/* Header: count first, then the word, then share of intake. The full
          reason split is in the hover tooltip so the rail stays two lines. */}
      <g>
        <title>{splitTitle}</title>
        <text x={numX} y={y0} textAnchor="end" fontSize="19" className="num" style={{ fill: color }}>
          {arrMode ? fmtArr(wing.arr) : fmtInt(wing.count)}
        </text>
        <text x={labX} y={y0} textAnchor="start" fontSize="13.5" style={{ fill: color }}>
          {headWord}{" "}
          <tspan className="num" style={{ opacity: 0.8 }}>
            {fmtPct(share)}
          </tspan>
        </text>
        {topReason && (
          <text
            x={labX}
            y={y0 + LINE_H}
            textAnchor="start"
            fontSize="13"
            style={{ fill: "var(--funnel-caption)" }}
          >
            {topReason.label}
            {rows.length > 1 && (
              <tspan style={{ opacity: 0.75 }}>{` · +${rows.length - 1} more`}</tspan>
            )}
          </text>
        )}
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------- diagram */

export function FunnelDiagram<T extends Rec>({
  bands,
  openKey,
  onToggle,
  arrMode,
  sideInflow,
}: {
  bands: FunnelBand<T>[];
  openKey: string | null;
  onToggle: (key: string) => void;
  arrMode: boolean;
  /** Labelled inflow into stage 0 that did not come through the funnel above. */
  sideInflow?: { count: number; label: string } | null;
}) {
  const animKey = arrMode ? "arr" : "count";
  const [traced, setTraced] = useState<string | null>(null);
  const ribbonOpacity = (key: string) =>
    traced === null
      ? "var(--ribbon-rest)"
      : traced === key
        ? "var(--ribbon-lit)"
        : "var(--ribbon-dim)";

  const n = bands.length;
  const widths = bands.map((b) => Math.max(HAIRLINE, b.frac * MAX_W));

  /* Per-band label decision, taken from the drawn width, not the stage index.
     Only the two visible lines (title + figure) gate placement; the conversion
     and median live in a hover tooltip, so they never force a label out.
     The full label is tried first; if the band is too narrow, the stage
     config's shortLabel (e.g. "SQO") is tried before moving out to the rail. */
  const labels = bands.map((band, i) => {
    const res = band.result;
    const isLast = i === n - 1;
    const cfg = res.config as StageConfig<T>;
    const advancedLabel = cfg.advancedLabel;
    const value = arrMode ? fmtArr(res.intakeArr) : fmtInt(res.intake);
    const metaA = isLast
      ? `${fmtPct(res.conversion, 1)} → ${advancedLabel.toLowerCase()}`
      : `${fmtPct(res.conversion, 1)} continued`;
    const metaB = isLast ? "" : `${fmtWeeks(res.medianWeeks)} median`;
    const tooltip = metaB ? `${metaA} · ${metaB}` : metaA;
    // Real padding on both sides, or it goes out to the rail.
    const PAD = 12;
    const valueW = estW(value, 25, true);
    const fits = (text: string) =>
      widths[i] >= Math.max(estW(text, 14), valueW) + PAD;
    let text = band.label;
    let inside = fits(text);
    if (!inside && cfg.shortLabel && fits(cfg.shortLabel)) {
      text = cfg.shortLabel;
      inside = true;
    }
    return { value, tooltip, inside, text, advancedLabel, isLast };
  });

  /* Rows sized so nothing overlaps: the ribbon needs its thickness, the rails
     need their text, and a stage block that had to move out to the rail needs
     the top of the row to itself so the streams pass below it rather than
     through it. Layout only — no width and no printed number changes. */
  const STAGE_BLOCK_H = 56;
  const rowH: number[] = [];
  const ycs: number[] = [];
  bands.forEach((b, i) => {
    const thickest = b.wings.reduce((m, w) => Math.max(m, thicknessOf(w)), 0);
    const railLines = b.wings.reduce((m, w) => Math.max(m, wingLines(w)), 1);
    const streamH = Math.max(thickest + ROW_PAD, railLines * LINE_H + 20);
    const external = !labels[i].inside;
    const h = external
      ? Math.max(ROW_MIN, Math.round(STAGE_BLOCK_H + streamH))
      : Math.max(ROW_MIN, Math.round(streamH), 66);
    rowH.push(h);
    ycs.push(external ? STAGE_BLOCK_H + (h - STAGE_BLOCK_H) / 2 : h / 2);
  });
  /* The side inflow needs headroom above the trunk: without it the ribbon
     tail crowds the column headers and crosses the dropped rail column. */
  const topPad =
    sideInflow && sideInflow.count > 0 ? PAD_TOP + 46 : PAD_TOP;
  const ys: number[] = [topPad];
  for (let i = 0; i < n; i += 1) ys.push(ys[i] + rowH[i]);
  for (let i = 0; i < n; i += 1) ycs[i] += ys[i];

  const lastR = bands[n - 1].result;
  const capValue = arrMode ? lastR.advancedArr : lastR.advanced;
  const capW = Math.max(HAIRLINE, (capValue / (bands[0].value || 1)) * MAX_W);
  const capY = ys[n] + CAP_STEM;
  const capBase = capY + CAP_BAR;
  const height = capBase + CAP_TEXT;

  const half = widths.map((w) => w / 2);
  const capHalf = capW / 2;
  const seg = (hwA: number, hwB: number, yA: number, yB: number, side: 1 | -1) => {
    const my = (yA + yB) / 2;
    return `C${CENTER + side * hwA},${my} ${CENTER + side * hwB},${my} ${CENTER + side * hwB},${yB}`;
  };
  let d = `M${CENTER - half[0]},${ys[0]}`;
  for (let i = 0; i < n; i += 1) {
    const next = i + 1 < n ? half[i + 1] : capHalf;
    d += ` ${seg(half[i], next, ys[i], ys[i + 1], -1)}`;
  }
  d += ` L${CENTER - capHalf},${capY} L${CENTER + capHalf},${capY}`;
  for (let i = n - 1; i >= 0; i -= 1) {
    const from = i + 1 < n ? half[i + 1] : capHalf;
    d += ` ${seg(from, half[i], ys[i + 1], ys[i], 1)}`;
  }
  d += " Z";

  /* Side inflow: records that enter the first band without coming through the
     funnel above. Drawn on the same units-per-record scale as everything else,
     merging into the trunk's top-left edge so it reads as an inflow. */
  const inflowT = sideInflow
    ? Math.max(2, (sideInflow.count / (bands[0].value || 1)) * MAX_W)
    : 0;
  /* Tail stays right of the dropped rail (END_L) so the inflow never crosses
     the rail column, and rides in the headroom reserved above the trunk. */
  const inflowX = Math.max(CENTER - half[0] - 90, END_L + 25);
  const inflowY = ys[0] - 34;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        width="100%"
        role="group"
        aria-label="Mirrored funnel-shaped Sankey. The centre trunk carries the live cohort; at every stage the dropped volume streams left, the still-pending volume streams right, and the remainder continues down the trunk. The equivalent stage table follows."
        className="block overflow-visible"
        onPointerLeave={() => setTraced(null)}
      >
        <defs>
          <linearGradient id="rf-g-trunk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.88" />
          </linearGradient>
          {/* Ribbons are strongest AT THE TRUNK and recede outward. The dropped
              ribbon runs rail→trunk left-to-right, the pending one trunk→rail. */}
          <linearGradient id="rf-g-dropped" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--lost)" stopOpacity="0.3" />
            <stop offset="45%" stopColor="var(--lost)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--lost)" stopOpacity="0.92" />
          </linearGradient>
          <linearGradient id="rf-g-pending" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--pending)" stopOpacity="0.92" />
            <stop offset="55%" stopColor="var(--pending)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--pending)" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Column headers: quieter than the figures they head. */}
        <text
          x={L_NUM_X}
          y={30}
          textAnchor="start"
          fontSize="12"
          letterSpacing="0.09em"
          style={{ fill: "var(--muted-foreground)" }}
        >
          DROPPED
        </text>
        <text
          x={R_NUM_X - 40}
          y={30}
          textAnchor="start"
          fontSize="12"
          letterSpacing="0.09em"
          style={{ fill: "var(--muted-foreground)" }}
        >
          PENDING
        </text>

        {/* Side inflow, drawn as an actual stream merging into band one. */}
        {sideInflow && sideInflow.count > 0 && (
          <g>
            <path
              d={ribbonPath(
                /* Land inside the trunk, not on its top-left corner: the trunk
                   edge slopes inward as it descends, so ending on the corner
                   left a visible gap. The trunk is painted after this. */
                CENTER - half[0] + 40,
                inflowX,
                ys[0] + 4,
                ys[0] + 4 + inflowT,
                inflowY - inflowT / 2,
                inflowY + inflowT / 2,
              )}
              fill="var(--primary)"
              fillOpacity={0.3}
              stroke="var(--primary)"
              strokeOpacity={0.35}
              strokeWidth={0.5}
            />
            {/* The reserved headroom keeps this clear of the column header. */}
            <text
              x={inflowX - 8}
              y={inflowY + 4}
              textAnchor="end"
              fontSize="13.5"
              style={{ fill: "var(--funnel-caption)" }}
            >
              <tspan className="num" style={{ fill: "var(--foreground)" }}>
                +{fmtInt(sideInflow.count)}
              </tspan>{" "}
              {sideInflow.label}
            </text>
          </g>
        )}

        {/* Ribbons first, so they tuck under the trunk. */}
        {bands.map((band, i) => {
          const yc = ycs[i];
          return band.wings.map((wing, wi) => (
            <Wing
              key={`${band.key}-${wing.band}`}
              wing={wing}
              yc={yc}
              left={wing.band === "dropped"}
              intakeFrac={band.frac}
              arrMode={arrMode}
              delay={i * 70 + 150 + wi * 40}
              animKey={animKey}
              opacity={ribbonOpacity(band.key)}
              lit={traced === band.key}
              onTrace={() => setTraced(band.key)}
            />
          ));
        })}

        {/* Trunk */}
        <g className="rf-band">
          <path d={d} fill="var(--funnel-plate)" />
          <path d={d} fill="url(#rf-g-trunk)" />
        </g>

        {/* Row separators — the split planes — clipped to the local width. */}
        {bands.map((band, i) => {
          if (i === 0) return null;
          return (
            <line
              key={`sep-${band.key}`}
              x1={CENTER - half[i]}
              x2={CENTER + half[i]}
              y1={ys[i]}
              y2={ys[i]}
              stroke="var(--funnel-plate)"
              strokeWidth={2.5}
            />
          );
        })}

        {/* Travelling current down the trunk. */}
        {bands.map((band, i) => {
          const lit = traced === band.key;
          return (
            <path
              key={`current-${band.key}`}
              d={`M${CENTER},${ys[i]} L${CENTER},${i === n - 1 ? capY : ys[i + 1]}`}
              fill="none"
              stroke="var(--primary-foreground)"
              strokeWidth={lit ? 1.7 : 1.1}
              strokeLinecap="round"
              strokeDasharray="3 26"
              className="rf-current pointer-events-none"
              style={{ opacity: lit ? 0.9 : 0.4 }}
            />
          );
        })}

        {/* Stage hit areas + figures. Inside the trunk when the block fits with
            padding at this width; otherwise out on the rail with a leader. */}
        {bands.map((band, i) => {
          const yc = ycs[i];
          const w = widths[i];
          const res = band.result;
          const open = openKey === band.key;
          const L = labels[i];
          const ringW = Math.max(w + 14, 260);
          const fillIn = "var(--primary-foreground)";

          return (
            <g
              key={`${animKey}-stage-${band.key}`}
              className="rf-band"
              style={{ animationDelay: `${i * 70}ms` }}
              onPointerEnter={() => setTraced(band.key)}
            >
              <g
                role="button"
                tabIndex={0}
                aria-expanded={open}
                aria-label={`${band.label}: ${arrMode ? fmtArr(res.intakeArr) : `${fmtInt(res.intake)} records`}, ${fmtPct(res.conversion, 1)} ${L.isLast ? L.advancedLabel.toLowerCase() : "continued to the next stage"}. Show disposition split.`}
                onClick={() => onToggle(band.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(band.key);
                  }
                }}
                className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {/* Conversion + median live here, surfaced on hover. */}
                <title>{`${band.label} — ${L.tooltip}`}</title>
                <rect
                  x={CENTER - Math.max(half[i], 130)}
                  y={ys[i]}
                  width={Math.max(w, 260)}
                  height={rowH[i]}
                  fill="transparent"
                />

                {L.inside ? (
                  <>
                    <text
                      x={CENTER}
                      y={yc - 11}
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight={600}
                      style={{ fill: fillIn }}
                    >
                      {L.text}
                    </text>
                    <text
                      x={CENTER}
                      y={yc + 17}
                      textAnchor="middle"
                      fontSize="25"
                      fontWeight={600}
                      className="num"
                      style={{ fill: fillIn }}
                    >
                      {L.value}
                    </text>
                  </>
                ) : (
                  <>
                    <line
                      x1={CENTER + half[i]}
                      y1={ys[i] + 24}
                      x2={STAGE_RAIL_X - 8}
                      y2={ys[i] + 24}
                      stroke="var(--muted-foreground)"
                      strokeOpacity={0.5}
                      strokeWidth={1}
                      strokeDasharray="2 3"
                    />
                    <text
                      x={STAGE_RAIL_X}
                      y={ys[i] + 17}
                      textAnchor="start"
                      fontSize="14"
                      fontWeight={600}
                      style={{ fill: "var(--foreground)" }}
                    >
                      {band.label}
                    </text>
                    <text
                      x={STAGE_RAIL_X}
                      y={ys[i] + 41}
                      textAnchor="start"
                      fontSize="22"
                      fontWeight={600}
                      className="num"
                      style={{ fill: "var(--foreground)" }}
                    >
                      {L.value}
                    </text>
                  </>
                )}

                {open && (
                  <rect
                    x={CENTER - ringW / 2}
                    y={ys[i] + 3}
                    width={ringW}
                    height={rowH[i] - 6}
                    rx={10}
                    fill="none"
                    stroke="var(--primary)"
                    strokeOpacity={0.6}
                    strokeWidth={1.5}
                  />
                )}
              </g>
            </g>
          );
        })}

        {/* Terminal cap: what survived every row, labelled at the bar itself. */}
        <g className="rf-band" style={{ animationDelay: `${n * 70}ms` }}>
          <rect
            x={CENTER - capHalf}
            y={capY}
            width={capW}
            height={CAP_BAR}
            rx={1}
            fill="var(--advanced)"
            fillOpacity={0.95}
          />
          <text
            x={CENTER}
            y={capBase + 26}
            textAnchor="middle"
            fontSize="22"
            className="num"
            style={{ fill: "var(--foreground)" }}
          >
            {arrMode ? fmtArr(capValue) : fmtInt(capValue)}
          </text>
          <text
            x={CENTER}
            y={capBase + 46}
            textAnchor="middle"
            fontSize="13.5"
            style={{ fill: "var(--funnel-caption)" }}
          >
            {(lastR.config as StageConfig<T>).advancedLabel.toLowerCase()} · leaves the funnel here
          </text>
        </g>
      </svg>

      {/* Text alternative for the diagram. */}
      <table className="sr-only">
        <caption>Stage table equivalent of the funnel diagram</caption>
        <thead>
          <tr>
            <th>Stage</th>
            <th>Intake</th>
            <th>Advanced</th>
            <th>Still pending</th>
            <th>Dropped</th>
            <th>Conversion to next</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((b) => (
            <tr key={b.key}>
              <td>{b.label}</td>
              <td>{arrMode ? fmtArr(b.result.intakeArr) : fmtInt(b.result.intake)}</td>
              <td>{fmtInt(b.result.advanced)}</td>
              <td>{fmtInt(b.result.pending)}</td>
              <td>{fmtInt(b.result.dropped)}</td>
              <td>{fmtPct(b.result.conversion, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------- compact (narrow) rendering */

/**
 * Under `md` the ribbon rails have nowhere to go, so the same proportions
 * render as a vertical trunk with the two exits as chips either side. Widths
 * are the identical `frac` values — no second geometry.
 */
export function FunnelCompact<T extends Rec>({
  bands,
  openKey,
  onToggle,
  arrMode,
  sideInflow,
}: {
  bands: FunnelBand<T>[];
  openKey: string | null;
  onToggle: (key: string) => void;
  arrMode: boolean;
  sideInflow?: { count: number; label: string } | null;
}) {
  return (
    <div className="space-y-1.5">
      {bands.map((band, i) => {
        const r = band.result;
        const open = openKey === band.key;
        const isLast = i === bands.length - 1;
        const advancedLabel = (r.config as StageConfig<T>).advancedLabel;
        return (
          <div key={band.key}>
            {i === 0 && sideInflow && sideInflow.count > 0 && (
              <p className="mb-1 text-[11px] text-muted-foreground">
                <span className="num text-foreground">+{fmtInt(sideInflow.count)}</span>{" "}
                {sideInflow.label} joins here
              </p>
            )}

            <button
              type="button"
              onClick={() => onToggle(band.key)}
              aria-expanded={open}
              aria-label={`${band.label}: ${arrMode ? fmtArr(r.intakeArr) : `${fmtInt(r.intake)} records`}. Show disposition split.`}
              style={{ width: `${Math.max(band.widthFrac, 0.5) * 100}%` }}
              className={`mx-auto block rounded-md border px-2 py-2 text-center transition-colors ${
                open ? "border-primary bg-primary/10" : "border-border bg-primary/5"
              }`}
            >
              <span className="block text-xs font-medium">{band.label}</span>

              <span className="num block text-2xl leading-tight">
                {arrMode ? fmtArr(r.intakeArr) : fmtInt(r.intake)}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                <span className="num">{fmtPct(r.conversion, 1)}</span>{" "}
                {isLast ? `→ ${advancedLabel}` : "continued"}
                {!isLast && (
                  <>
                    {" · "}
                    <span className="num">{fmtWeeks(r.medianWeeks)}</span> median
                  </>
                )}
              </span>
            </button>

            {band.wings.length > 0 && (
              <div className="mt-1 flex items-center justify-center gap-1.5">
                {[...band.wings]
                  .sort((a, b) => (a.band === "dropped" ? -1 : 1) - (b.band === "dropped" ? -1 : 1))
                  .map((wing) => (
                    <span
                      key={wing.band}
                      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] ${
                        wing.band === "pending"
                          ? "bg-pending-soft text-pending"
                          : "bg-lost-soft text-lost"
                      }`}
                    >
                      <span aria-hidden>{wing.band === "dropped" ? "←" : "→"}</span>
                      <span className="num">
                        {arrMode ? fmtArr(wing.arr) : fmtInt(wing.count)}
                      </span>{" "}
                      {WING_WORD[wing.band]}
                    </span>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
