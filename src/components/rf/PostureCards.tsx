/* ============================================================================
 * POSTURE CARDS — the funnel page's right rail, as small graph cards.
 * ----------------------------------------------------------------------------
 * Every card leads with a visual and renders ALREADY-DERIVED values only
 * (`derivePosture`, `wonArrByWeek`, `openArrByStage`, `cohortStats`,
 * `lineageBridge`). Code here maps values to geometry — widths, arcs, paths —
 * and never computes a metric. Each card carries a `postureExplainer()` entry.
 * ==========================================================================*/

import type { ReactNode } from "react";

import { colorAt } from "@/components/rf/Chart";
import { DeltaLine } from "@/components/rf/Delta";
import { Explainer } from "@/components/rf/Explainer";
import {
  comparisonExplainer,
  fmtArr,
  fmtInt,
  fmtPct,
  headlineComparison,
  postureExplainer,
  titleCase,
  type CohortStat,
  type LineageBridge,
  type Posture,
  type StageArr,
  type WeekValue,
  type WindowComparison,
} from "@/lib/rf/engine";

function Card({
  label,
  explain,
  className = "",
  children,
}: {
  label: string;
  explain: Parameters<typeof Explainer>[0]["items"];
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel px-4 py-3.5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        <Explainer title={label} items={explain} />
      </div>
      {children}
    </section>
  );
}

/** Shared horizontal bar row: label · value · proportional track. */
function BarRow({
  label,
  value,
  frac,
  color,
}: {
  label: string;
  value: string;
  frac: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="num text-xs text-foreground">{value}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(frac * 100, frac > 0 ? 2 : 0)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------- 1 · closed-won + spark -- */

function WonArrCard({
  posture,
  series,
  comparison,
}: {
  posture: Posture;
  series: WeekValue[];
  comparison: WindowComparison;
}) {
  const W = 240;
  const H = 56;
  const max = Math.max(...series.map((p) => p.value), 1);
  const pts = series.map((p, i) => ({
    x: series.length > 1 ? (i / (series.length - 1)) * W : W / 2,
    y: H - 4 - (p.value / max) * (H - 12),
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <Card
      label="Closed-won ARR"
      explain={[...postureExplainer("won"), ...comparisonExplainer("window")]}
    >
      <p className="num mt-1.5 text-3xl leading-none text-primary">{fmtArr(posture.closedWonArr)}</p>
      <DeltaLine
        c={headlineComparison(comparison, "closedWonArr")}
        fmt={fmtArr}
        label={`vs prior ${comparison.weeks}w · ${comparison.priorLabel}`}
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        <span className="num text-foreground">{fmtInt(posture.wonCount)}</span> deals won · ARR by
        close week
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-2 h-14 w-full"
        role="img"
        aria-label="Won ARR per week across the window"
      >
        <path d={area} fill="var(--color-primary)" opacity={0.12} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={1.75}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{series[0]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------ 2 · outcome ring --- */

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

function OutcomeRingCard({
  posture,
  comparison,
}: {
  posture: Posture;
  comparison: WindowComparison;
}) {
  const total = posture.wonCount + posture.lostCount + posture.openCount;
  const segs = [
    { label: "Won", count: posture.wonCount, color: "var(--color-advanced)" },
    { label: "Lost", count: posture.lostCount, color: "var(--color-lost)" },
    { label: "Open", count: posture.openCount, color: "var(--color-pending)" },
  ];
  let offset = 0;
  const arcs = segs.map((s) => {
    const frac = total ? s.count / total : 0;
    const arc = { ...s, frac, start: offset };
    offset += frac;
    return arc;
  });

  return (
    <Card
      label="Deal outcomes"
      explain={[...postureExplainer("outcomes"), ...comparisonExplainer("window")]}
    >
      {total === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No deals in this cohort.</p>
      ) : (
        <div className="mt-2 flex items-center gap-4">
          <svg viewBox="0 0 110 110" className="size-[104px] shrink-0" role="img" aria-label="Won, lost and open deal split">
            <circle cx="55" cy="55" r={RING_R} fill="none" stroke="var(--color-surface-sunken)" strokeWidth="11" />
            {arcs.map(
              (a) =>
                a.frac > 0 && (
                  <circle
                    key={a.label}
                    cx="55"
                    cy="55"
                    r={RING_R}
                    fill="none"
                    stroke={a.color}
                    strokeWidth="11"
                    strokeDasharray={`${Math.max(a.frac * RING_C - 2, 0.5)} ${RING_C}`}
                    strokeDashoffset={-a.start * RING_C}
                    strokeLinecap="butt"
                    transform="rotate(-90 55 55)"
                  />
                ),
            )}
            <text
              x="55"
              y="52"
              textAnchor="middle"
              className="num"
              style={{ fontSize: 19, fill: "var(--color-foreground)" }}
            >
              {fmtPct(posture.winRate, 0)}
            </text>
            <text
              x="55"
              y="66"
              textAnchor="middle"
              style={{ fontSize: 8.5, fill: "var(--color-muted-foreground)" }}
            >
              win rate · closed
            </text>
          </svg>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {segs.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="num text-foreground">{fmtInt(s.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <DeltaLine
        c={headlineComparison(comparison, "winRate")}
        fmt={(n) => `${(n * 100).toFixed(1)} pts`}
        label={`win rate vs prior ${comparison.weeks}w · ${comparison.priorLabel}`}
      />
    </Card>
  );
}

/* ------------------------------------------ 3 · open pipeline by stage ----- */

function StageBarsCard({
  rows,
  openArr,
  comparison,
}: {
  rows: StageArr[];
  openArr: number;
  comparison: WindowComparison;
}) {
  const max = Math.max(...rows.map((r) => r.arr), 1);
  const any = rows.some((r) => r.arr > 0);
  return (
    <Card
      label="Open pipeline by stage"
      explain={[...postureExplainer("stage"), ...comparisonExplainer("window")]}
    >
      <p className="num mt-1.5 text-xl leading-none text-foreground">{fmtArr(openArr)}</p>
      <DeltaLine
        c={headlineComparison(comparison, "openPipelineArr")}
        fmt={fmtArr}
        label={`vs prior ${comparison.weeks}w · ${comparison.priorLabel}`}
      />
      {any ? (
        <div className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <BarRow
              key={r.key}
              label={r.label}
              value={fmtArr(r.arr)}
              frac={r.arr / max}
              color="var(--color-pending)"
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No open deals in this cohort.</p>
      )}
    </Card>
  );
}

/* --------------------------------------------- 4 · won ARR by segment ------ */

function SegmentBarsCard({ segments, medianAcv }: { segments: CohortStat[]; medianAcv: number | null }) {
  const max = Math.max(...segments.map((s) => s.wonArr), 1);
  const any = segments.some((s) => s.wonArr > 0);
  return (
    <Card label="Won ARR by segment" explain={postureExplainer("segment")}>
      {any ? (
        <div className="mt-3 space-y-2.5">
          {segments.map((s, i) => (
            <BarRow
              key={s.key}
              label={titleCase(s.key)}
              value={fmtArr(s.wonArr)}
              frac={s.wonArr / max}
              color={colorAt(i)}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No won deals in this cohort.</p>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Median won ACV{" "}
        <span className="num text-foreground">{medianAcv === null ? "—" : fmtArr(medianAcv)}</span>{" "}
        across the cohort
      </p>
    </Card>
  );
}

/* -------------------------------------------- 5 · bridge between funnels --- */

function BridgeCard({ bridge }: { bridge: LineageBridge }) {
  const pass = bridge.sqoCount === 0 ? 0 : bridge.sqoWithDeal / bridge.sqoCount;
  return (
    <Card
      label="Bridge between the funnels"
      explain={postureExplainer("bridge")}
      className="bg-surface-sunken"
    >
      <p className="num mt-1.5 text-xl leading-none text-foreground">{fmtPct(pass)}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">of SQOs opened a deal record</p>
      <div className="mt-3 space-y-2.5">
        <BarRow
          label="SQO → deal opened"
          value={`${fmtInt(bridge.sqoWithDeal)} / ${fmtInt(bridge.sqoCount)}`}
          frac={pass}
          color="var(--color-advanced)"
        />
        {bridge.dealsNoLineage > 0 && (
          <BarRow
            label="Deals with no lead lineage"
            value={fmtInt(bridge.dealsNoLineage)}
            frac={bridge.sqoCount > 0 ? bridge.dealsNoLineage / bridge.sqoCount : 1}
            color="var(--color-chart-3)"
          />
        )}
      </div>
      {bridge.dealsNoLineage > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No-lineage deals appear as a side-inflow on the deal funnel. The two funnels do not
          reconcile, by design.
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- assembly ---- */

export function PostureCards({
  posture,
  wonSeries,
  stageArr,
  segments,
  bridge,
  comparison,
}: {
  posture: Posture;
  wonSeries: WeekValue[];
  stageArr: StageArr[];
  segments: CohortStat[];
  bridge: LineageBridge;
  comparison: WindowComparison;
}) {
  return (
    <>
      <div className="sm:col-span-2 lg:col-span-1">
        <WonArrCard posture={posture} series={wonSeries} comparison={comparison} />
      </div>
      <OutcomeRingCard posture={posture} comparison={comparison} />
      <StageBarsCard rows={stageArr} openArr={posture.openPipelineArr} comparison={comparison} />
      <SegmentBarsCard segments={segments} medianAcv={posture.medianAcv} />
      <div className="sm:col-span-2 lg:col-span-1">
        <BridgeCard bridge={bridge} />
      </div>
    </>
  );
}
