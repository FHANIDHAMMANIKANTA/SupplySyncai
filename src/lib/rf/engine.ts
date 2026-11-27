/* ============================================================================
 * DERIVATION ENGINE — Crestline Cloud · Revenue Funnel
 * ----------------------------------------------------------------------------
 * Nothing in this file authors data. Every number the UI shows is derived here
 * from the arrays in `data.ts`, and every derivation is documented next to the
 * place it is defined (and re-exported as a plain-language string through
 * `stageExplainer()` so the UI can show a "how this is computed" popover).
 *
 * The two funnels are ORDERED CONFIGS (`LEAD_STAGES`, `DEAL_STAGES`). Pages
 * iterate over them; they never hardcode a stage. Teams with a different funnel
 * edit the configs below and the whole app follows.
 * ==========================================================================*/

import {
  CURRENT_WEEK,
  DEALS,
  LEADS,
  DISQUAL_CATEGORY_LABEL,
  LOSS_CATEGORY_LABEL,
  SEGMENTS,
  SOURCES,
  WEEKLY_TARGETS,
  weekShortLabel,
  type Deal,
  type Lead,
  type DisqualCategory,
  type LossCategory,
  type Segment,
  type Source,
} from "./data";


export type Band = "advanced" | "pending" | "dropped";

export const BAND_LABEL: Record<Band, string> = {
  advanced: "Advanced",
  pending: "Still pending",
  dropped: "Dropped",
};

/* ------------------------------------------------------------ stage configs */

export interface StageConfig<T> {
  key: string;
  label: string;
  /** Plain-language definition of what "entering" this stage means. */
  definition: string;
  /**
   * Week the record entered this stage, or null when it never entered.
   * Intake for the stage = count of records where this is non-null.
   */
  enteredWeek: (r: T) => number | null;
  /** Week the record moved past this stage, or null. Non-null => "advanced". */
  advancedWeek: (r: T) => number | null;
  /**
   * Staleness window. A record that has not advanced but entered within this
   * many weeks of "now" counts as PENDING rather than DROPPED.
   */
  staleWeeks: number;
  /** Label used for records that dropped out at this stage (lead funnel). */
  dropLabel: string;
  /** Label for the "advanced" band, e.g. "Qualified". */
  advancedLabel: string;
  /**
   * Optional compact form used only when the full label cannot fit inside a
   * narrow funnel band (e.g. "SQO" for "Sales-qualified (SQO)"). Tables,
   * rails and explainers always use the full label.
   */
  shortLabel?: string;
}

/**
 * LEAD FUNNEL: created -> qualified -> meeting -> SQO.
 * Advancing means "the next milestone week is present". A lead whose next
 * milestone is absent either has not had time yet (pending) or stopped
 * (dropped); the disposition is derived from milestone gaps, never authored.
 *
 * The stage list is a FUNCTION of the SQO->deal linkage (see
 * `deriveLeadDealLinkage`), because the last stage's "advanced" test is
 * "did this lead open a deal?". Passing the linkage in keeps that dependency
 * explicit instead of hidden in module state.
 */
export function leadStages(linkage: LeadDealLinkage): StageConfig<Lead>[] {
  return [

  {
    key: "created",
    label: "Leads created",
    definition: "Every lead record created inside the window.",
    enteredWeek: (l) => l.createdWeek,
    advancedWeek: (l) => l.qualifiedWeek,
    staleWeeks: 4,
    dropLabel: "Unqualified",
    advancedLabel: "Qualified",
  },
  {
    key: "qualified",
    label: "Qualified",
    definition: "Lead passed qualification criteria (qualifiedWeek present).",
    enteredWeek: (l) => l.qualifiedWeek,
    advancedWeek: (l) => l.meetingWeek,
    staleWeeks: 4,
    dropLabel: "No-show / no meeting booked",
    advancedLabel: "Meeting held",
  },
  {
    key: "meeting",
    label: "Meeting held",
    definition: "A first discovery meeting actually happened.",
    enteredWeek: (l) => l.meetingWeek,
    advancedWeek: (l) => l.sqoWeek,
    staleWeeks: 6,
    dropLabel: "Stalled out after meeting",
    advancedLabel: "Sales-qualified",
  },
    {
      key: "sqo",
      label: "Sales-qualified (SQO)",
      shortLabel: "SQO",
      definition: "Accepted by sales as a real opportunity candidate.",
      enteredWeek: (l) => l.sqoWeek,
      advancedWeek: (l) => linkage.get(l.id) ?? null,
      staleWeeks: 3,
      dropLabel: "No opportunity opened",
      advancedLabel: "Deal opened",
    },
  ];
}

/**
 * The sample dataset's lead stages, kept as a named export because the
 * maturity budgets below and the per-source mini-funnels only read
 * `staleWeeks` / labels, which do not vary with the linkage.
 */
export const LEAD_STAGES: StageConfig<Lead>[] = leadStages(deriveLeadDealLinkage(DEALS));


/**
 * DEAL FUNNEL: created -> discovery -> evaluation -> proposal -> negotiation
 * -> closed. Advancing means the next stage week is present (for `negotiation`
 * it means the deal closed; for `closed` it means the deal was won).
 * Dropping at a stage means the deal is `lost` and this stage is the furthest
 * stage it reached — so the dropped band decomposes by loss-reason category.
 * An open deal that has not moved past its staleness window also drops, as
 * "Stalled — no stage movement".
 */
export const DEAL_STAGES: StageConfig<Deal>[] = [
  {
    key: "created",
    label: "Deals created",
    definition: "Opportunity record opened.",
    enteredWeek: (d) => d.createdWeek,
    advancedWeek: (d) => d.discoveryWeek,
    staleWeeks: 3,
    dropLabel: "Never entered discovery",
    advancedLabel: "Discovery",
  },
  {
    key: "discovery",
    label: "Discovery",
    definition: "Scoping and technical discovery underway.",
    enteredWeek: (d) => d.discoveryWeek,
    advancedWeek: (d) => d.evaluationWeek,
    staleWeeks: 4,
    dropLabel: "Lost in discovery",
    advancedLabel: "Evaluation",
  },
  {
    key: "evaluation",
    label: "Evaluation",
    definition: "Pilot, trial or security review in flight.",
    enteredWeek: (d) => d.evaluationWeek,
    advancedWeek: (d) => d.proposalWeek,
    staleWeeks: 5,
    dropLabel: "Lost in evaluation",
    advancedLabel: "Proposal",
  },
  {
    key: "proposal",
    label: "Proposal",
    definition: "Commercial proposal issued (seats + credits).",
    enteredWeek: (d) => d.proposalWeek,
    advancedWeek: (d) => d.negotiationWeek,
    staleWeeks: 5,
    dropLabel: "Lost at proposal",
    advancedLabel: "Negotiation",
  },
  {
    key: "negotiation",
    label: "Negotiation",
    definition: "Redlines, procurement and signature path.",
    enteredWeek: (d) => d.negotiationWeek,
    advancedWeek: (d) => d.closedWeek,
    staleWeeks: 4,
    dropLabel: "Lost in negotiation",
    advancedLabel: "Reached a decision",
  },
  {
    key: "closed",
    label: "Closed",
    definition: "Deal reached a terminal outcome after negotiation.",
    // Only decisions that came through negotiation enter here; a deal lost
    // earlier is already counted as a drop at the stage it died in, so the
    // funnel stays monotonically narrowing.
    enteredWeek: (d) => (d.negotiationWeek !== null ? d.closedWeek : null),
    advancedWeek: (d) => (d.status === "won" ? d.closedWeek : null),
    staleWeeks: 0,
    dropLabel: "Closed lost",
    advancedLabel: "Closed won",
  },
];

/**
 * SQO -> deal linkage, used by the last lead stage.
 *
 * This is DERIVED FROM A DATASET, never held in module scope: `leadStages`
 * closes over a linkage map built from the deals it is given, so the lead
 * funnel's last stage can only ever describe the dataset it was derived from.
 * There is no shared mutable state, so correctness does not depend on call
 * order and nothing leaks between requests on the server.
 *
 * The linkage is built from UNFILTERED deals on purpose — a lead inside the
 * filtered cohort may have opened a deal that the filter excludes, and that
 * lead has still advanced.
 */
export type LeadDealLinkage = ReadonlyMap<string, number>;

export function deriveLeadDealLinkage(deals: readonly Deal[]): LeadDealLinkage {
  const map = new Map<string, number>();
  for (const d of deals) if (d.leadId) map.set(d.leadId, d.createdWeek);
  return map;
}


/* ----------------------------------------------------------------- filters */

/**
 * The record arrays every derivation reads from. `origin` is presentational
 * only — no derivation branches on it, so imported data flows through exactly
 * the same code path as the seeded sample.
 */
export interface Dataset {
  leads: readonly Lead[];
  deals: readonly Deal[];
  origin: "sample" | "imported";
  label: string;
}

/** The zero-configuration default: the seeded synthetic dataset. */
export const SAMPLE_DATASET: Dataset = {
  leads: LEADS,
  deals: DEALS,
  origin: "sample",
  label: "Sample data",
};

export interface Filters {
  segment: Segment | "all";
  source: Source | "all";
  weekFrom: number;
  weekTo: number;
}

export const DEFAULT_FILTERS: Filters = {
  segment: "all",
  source: "all",
  weekFrom: 0,
  weekTo: CURRENT_WEEK,
};

/**
 * Filters are applied BEFORE any derivation, on the record's creation week, so
 * every downstream stage count, conversion and disposition describes the same
 * cohort. `dataset` defaults to the seeded sample, which is what makes the
 * zero-configuration path work unchanged.
 *
 * The lead stage configs come back with the filtered records, built from the
 * UNFILTERED deals of this same dataset, so a page can never derive the lead
 * funnel against another dataset's lineage.
 */
export function applyFilters(filters: Filters, dataset: Dataset = SAMPLE_DATASET) {
  const keep = (r: { segment: Segment; source: Source; createdWeek: number }) =>
    (filters.segment === "all" || r.segment === filters.segment) &&
    (filters.source === "all" || r.source === filters.source) &&
    r.createdWeek >= filters.weekFrom &&
    r.createdWeek <= filters.weekTo;

  return {
    leads: dataset.leads.filter(keep),
    deals: dataset.deals.filter(keep),
    leadStages: leadStages(deriveLeadDealLinkage(dataset.deals)),
  };
}



/* ----------------------------------------------------- disposition primitive */

export interface DropGroup {
  key: string;
  label: string;
  count: number;
  arr: number;
}

export interface StageRecord<T> {
  record: T;
  band: Band;
  enteredWeek: number;
  /** Weeks spent in the stage: to the advance week, else to "now". */
  weeksInStage: number;
  dropKey: string | null;
  dropLabel: string | null;
}

export interface StageResult<T> {
  config: StageConfig<T>;
  intake: number;
  advanced: number;
  pending: number;
  dropped: number;
  /** advanced / intake */
  conversion: number;
  /** intake relative to the first stage's intake */
  ofFirst: number;
  /** median weeks in stage across records that advanced */
  medianWeeks: number | null;
  intakeArr: number;
  advancedArr: number;
  pendingArr: number;
  droppedArr: number;
  dropGroups: DropGroup[];
  records: StageRecord<T>[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function isDeal(r: unknown): r is Deal {
  return typeof r === "object" && r !== null && "arr" in (r as Deal);
}

/** A lead is the person-level record; it carries `disqualReason`, never `arr`. */
function isLead(r: unknown): r is Lead {
  return typeof r === "object" && r !== null && "disqualReason" in (r as Lead);
}

/** Furthest stage key a deal actually reached — used to place its loss. */
function furthestDealStage(d: Deal): string {
  let key = "created";
  for (const stage of DEAL_STAGES) {
    if (stage.key === "closed") continue;
    if (stage.enteredWeek(d) !== null) key = stage.key;
  }
  return key;
}

/**
 * THE CORE PRIMITIVE — per-stage disposition split.
 *
 *   advanced = the next milestone / stage week is present
 *   pending  = no later milestone AND entered within `staleWeeks` of now
 *   dropped  = the remainder (decomposed by loss reason for deal stages,
 *              by derived lead disposition for lead stages)
 *
 * The three bands are exhaustive and mutually exclusive, so
 * advanced + pending + dropped === intake for every stage, always.
 */
export function deriveStage<T extends { id: string }>(
  config: StageConfig<T>,
  records: T[],
  firstIntake: number | null,
): StageResult<T> {
  const out: StageRecord<T>[] = [];
  const arr = (r: T) => (isDeal(r) ? r.arr : 0);

  let advanced = 0;
  let pending = 0;
  let dropped = 0;
  let intakeArr = 0;
  let advancedArr = 0;
  let pendingArr = 0;
  let droppedArr = 0;
  const groups = new Map<string, DropGroup>();
  const advanceGaps: number[] = [];

  for (const r of records) {
    const entered = config.enteredWeek(r);
    if (entered === null) continue;
    const advWeek = config.advancedWeek(r);
    intakeArr += arr(r);

    if (advWeek !== null) {
      advanced++;
      advancedArr += arr(r);
      advanceGaps.push(Math.max(0, advWeek - entered));
      out.push({
        record: r,
        band: "advanced",
        enteredWeek: entered,
        weeksInStage: Math.max(0, advWeek - entered),
        dropKey: null,
        dropLabel: null,
      });
      continue;
    }

    const age = CURRENT_WEEK - entered;
    const deal = isDeal(r) ? (r as Deal) : null;
    const lostHere = deal?.status === "lost" && furthestDealStage(deal) === config.key;
    const closedStageLoss = deal?.status === "lost" && config.key === "closed";
    const isLoss = Boolean(lostHere || closedStageLoss);

    if (!isLoss && age <= config.staleWeeks) {
      pending++;
      pendingArr += arr(r);
      out.push({
        record: r,
        band: "pending",
        enteredWeek: entered,
        weeksInStage: age,
        dropKey: null,
        dropLabel: null,
      });
      continue;
    }

    dropped++;
    droppedArr += arr(r);
    let key: string;
    let label: string;
    if (deal && isLoss && deal.lossReason) {
      key = deal.lossReason.category;
      label = LOSS_CATEGORY_LABEL[deal.lossReason.category as LossCategory];
    } else if (deal) {
      key = "stalled";
      label = "Stalled, no stage movement";
    } else if (isLead(r) && r.disqualReason) {
      // LEAD DISQUALIFICATION — mirrors the deal side exactly: the category is
      // a member of the fixed `DisqualCategory` union, so the group set can
      // never contain an invented key. The reason explains the drop; the drop
      // itself was already decided by the milestone gaps above.
      key = r.disqualReason.category;
      label = DISQUAL_CATEGORY_LABEL[r.disqualReason.category as DisqualCategory];
    } else {
      // Dropped, but nobody recorded a reason. Pooled honestly so the parts
      // still sum to the stage's dropped count.
      key = `unrecorded_${config.key}`;
      label = "Reason not recorded";
    }
    const g = groups.get(key) ?? { key, label, count: 0, arr: 0 };
    g.count++;
    g.arr += arr(r);
    groups.set(key, g);
    out.push({
      record: r,
      band: "dropped",
      enteredWeek: entered,
      weeksInStage: deal?.closedWeek != null ? Math.max(0, deal.closedWeek - entered) : age,
      dropKey: key,
      dropLabel: label,
    });
  }

  const intake = advanced + pending + dropped;
  return {
    config,
    intake,
    advanced,
    pending,
    dropped,
    conversion: intake ? advanced / intake : 0,
    ofFirst: firstIntake ? intake / firstIntake : 1,
    medianWeeks: median(advanceGaps),
    intakeArr,
    advancedArr,
    pendingArr,
    droppedArr,
    dropGroups: [...groups.values()].sort((a, b) => b.count - a.count),
    records: out,
  };
}

export function deriveFunnel<T extends { id: string }>(
  stages: StageConfig<T>[],
  records: T[],
): StageResult<T>[] {
  const first = deriveStage(stages[0], records, null);
  const results = [first];
  for (let i = 1; i < stages.length; i++) {
    results.push(deriveStage(stages[i], records, first.intake));
  }
  return results;
}

/* --------------------------------------------------------------- headline */

export interface Posture {
  openPipelineArr: number;
  closedWonArr: number;
  leadToWin: number;
  leadCount: number;
  dealCount: number;
  wonCount: number;
  lostCount: number;
  openCount: number;
  winRate: number;
  medianAcv: number | null;
}

export function derivePosture(leads: Lead[], deals: Deal[]): Posture {
  const won = deals.filter((d) => d.status === "won");
  const lost = deals.filter((d) => d.status === "lost");
  const open = deals.filter((d) => d.status === "open");
  const closed = won.length + lost.length;
  return {
    openPipelineArr: open.reduce((s, d) => s + d.arr, 0),
    closedWonArr: won.reduce((s, d) => s + d.arr, 0),
    // Blended lead -> win: won deals with lead lineage over all leads.
    leadToWin: leads.length ? won.filter((d) => d.leadId).length / leads.length : 0,
    leadCount: leads.length,
    dealCount: deals.length,
    wonCount: won.length,
    lostCount: lost.length,
    openCount: open.length,
    winRate: closed ? won.length / closed : 0,
    medianAcv: median(won.map((d) => d.arr)),
  };
}

export interface CohortStat {
  key: string;
  volume: number;
  closed: number;
  winRate: number;
  medianAcv: number | null;
  wonArr: number;
}

/** Win rate and median ACV by any categorical deal key. */
export function cohortStats(deals: Deal[], by: "source" | "segment"): CohortStat[] {
  const map = new Map<string, Deal[]>();
  for (const d of deals) {
    const k = d[by];
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  return [...map.entries()]
    .map(([key, group]) => {
      const won = group.filter((d) => d.status === "won");
      const closed = group.filter((d) => d.status !== "open").length;
      return {
        key,
        volume: group.length,
        closed,
        winRate: closed ? won.length / closed : 0,
        medianAcv: median(won.map((d) => d.arr)),
        wonArr: won.reduce((s, d) => s + d.arr, 0),
      };
    })
    .sort((a, b) => b.volume - a.volume);
}

/* ------------------------------------------------ "how this is computed" ---- */

export interface MetricExplainer {
  metric: string;
  computedFrom: string;
}

/**
 * Registry: assembled from the stage config and its thresholds so the string
 * can never drift from the math above.
 */
export function stageExplainer<T>(
  config: StageConfig<T>,
  next: StageConfig<T> | undefined,
): MetricExplainer[] {
  const advanceRule = next
    ? `\`${next.key}\` week is present on the record`
    : "the record reached a won outcome";
  return [
    { metric: "Stage definition", computedFrom: config.definition },
    {
      metric: "Intake (count)",
      computedFrom: `records where the \`${config.key}\` week is non-null, after segment / source / week filters`,
    },
    {
      metric: "Advanced",
      computedFrom: `${advanceRule} → counts as advanced`,
    },
    {
      metric: "Pending",
      computedFrom: `no later milestone and entered within ${config.staleWeeks}w of the current week`,
    },
    {
      metric: "Dropped",
      computedFrom: `the remainder (intake − advanced − pending); decomposed by recorded reason category — \`lossReason\` for deals, \`disqualReason\` for leads — with drops that carry no recorded reason pooled as "Reason not recorded". The parts always sum back to dropped`,
    },
    {
      metric: "Reason",
      computedFrom:
        "a categorical value from a fixed union with a fixed detail list; it explains a drop and never determines one — disposition stays derived from milestone gaps",
    },
    {
      metric: "Conversion to next",
      computedFrom: "advanced ÷ intake for this stage",
    },
    {
      metric: "Median weeks in stage",
      computedFrom: "median of (advance week − entry week) across records that advanced",
    },
    {
      metric: "ARR-weighted variants",
      computedFrom: "same bands, summing each record's `arr` instead of counting rows",
    },
  ];
}

/**
 * Registry for the diagram-level methodology popover — the single ⓘ on the
 * funnel plate. Scale and conservation rules for the Sankey as a whole.
 * Per-stage math stays in `stageExplainer` and surfaces in the drill-down
 * panel that opens when a stage is clicked.
 */
export function funnelDiagramExplainer(): MetricExplainer[] {
  return [
    {
      metric: "One scale",
      computedFrom:
        "trunk width = stage intake ÷ first-stage intake; ribbon thickness where it meets the trunk uses the identical units-per-record scale (ARR mode: the same ratios on intake ARR)",
    },
    {
      metric: "Ribbon direction",
      computedFrom:
        "a ribbon is thickest and strongest exactly where the volume departs the trunk, and narrows and fades as it travels out to its rail — the outward taper is style and encodes nothing",
    },
    {
      metric: "Conservation",
      computedFrom:
        "advanced + pending + dropped = intake at every stage, and advanced here = intake of the next stage — so the trunk narrows by exactly the two ribbon thicknesses that leave it, never by a drawn taper",
    },
    {
      metric: "Reason rows",
      computedFrom:
        "the dropped rail lists reasons largest first; past the third the tail is pooled into a labelled 'other reasons (n)' row, so the listed counts always sum to the dropped total — nothing is silently cut",
    },
    {
      metric: "Label placement",
      computedFrom:
        "a stage block sits inside the trunk only when every line fits at the band's own drawn width with padding on both sides; otherwise the whole block moves to the outer rail with a leader line — decided per band at render, never by stage index, and text is never given an outline",
    },
    {
      metric: "Terminal bar",
      computedFrom:
        "the bar under the last stage is what advanced out of the funnel entirely (won, or sales-qualified on the lead funnel), on the same width scale",
    },
    {
      metric: "Tiny ribbons",
      computedFrom:
        "ribbons render at their true thickness down to a 1.1px antialiasing minimum and are never inflated; a ribbon thinner than 4px gets a dotted leader and an endpoint tick so it stays findable",
    },
    {
      metric: "Row heights",
      computedFrom:
        "a stage row is as tall as its thickest ribbon and its rail text need so nothing overlaps — layout only, it changes no width and no printed number",
    },
    {
      metric: "Narrow-screen fallback",
      computedFrom: `below the md breakpoint the same fractions render as stacked bars with a legibility floor (never below ${Math.round(FUNNEL_MIN_BAND_FRACTION * 100)}% of the widest, and at least half the column so the label block fits); the desktop diagram is never floored`,
    },
  ];
}

/* ------------------------------------------------------------ funnel geometry */

/**
 * MINIMUM RENDER WIDTH — the one place geometry is allowed to leave the data.
 *
 * Band width is strictly proportional to intake, so a very late stage holding a
 * couple of percent of stage-one intake would render as a hairline. Widths are
 * therefore floored at this fraction of the widest band. Labels do NOT depend on
 * this floor: every stage carries its name and metric line on a fixed left rail,
 * so ONE labelling system holds at any width and the floor stays small enough
 * that the funnel visibly tapers. The floor is a legibility device only: it never
 * changes a printed number, it is disclosed in every stage explainer, and outflow
 * bars keep the unfloored scale so an outflow can never look bigger than the band
 * it left.
 */
export const FUNNEL_MIN_BAND_FRACTION = 0.06;



export interface WingSliver {
  key: string;
  label: string;
  count: number;
  arr: number;
  /** share of the wing's own thickness */
  share: number;
}

export interface FunnelWing {
  band: Extract<Band, "pending" | "dropped">;
  count: number;
  arr: number;
  /** thickness on the band scale: value ÷ first-stage value (never floored) */
  frac: number;
  slivers: WingSliver[];
}

export interface FunnelBand<T> {
  result: StageResult<T>;
  key: string;
  label: string;
  /** the value driving the width: count, or ARR in ARR mode */
  value: number;
  /** value ÷ first-stage value — the honest proportion */
  frac: number;
  /** frac after the minimum-render-width floor — what is actually drawn */
  widthFrac: number;
  wings: FunnelWing[];
}

/**
 * Turns funnel results into pure proportions. Every width on screen comes from
 * here, so the shape cannot drift from the engine:
 *
 *   frac_i      = value_i / value_0                (value = count | intakeArr)
 *   widthFrac_i = max(frac_i, FUNNEL_MIN_BAND_FRACTION)
 *   wing.frac   = band value / value_0             (same scale, no floor)
 *
 * Wings are emitted only when their count is non-zero. The dropped wing carries
 * `result.dropGroups` as slivers, in the same order the disposition panel
 * lists them, each sized as a share of the wing's own thickness.
 */
export function funnelGeometry<T>(
  results: StageResult<T>[],
  arrMode: boolean,
): FunnelBand<T>[] {
  const valueOf = (r: StageResult<T>) => (arrMode ? r.intakeArr : r.intake);
  const first = valueOf(results[0]) || 1;

  return results.map((r) => {
    const frac = valueOf(r) / first;
    const wings: FunnelWing[] = [];

    const pendingValue = arrMode ? r.pendingArr : r.pending;
    if (r.pending > 0) {
      wings.push({
        band: "pending",
        count: r.pending,
        arr: r.pendingArr,
        frac: pendingValue / first,
        slivers: [],
      });
    }

    const droppedValue = arrMode ? r.droppedArr : r.dropped;
    if (r.dropped > 0) {
      const denom = (arrMode ? r.droppedArr : r.dropped) || 1;
      wings.push({
        band: "dropped",
        count: r.dropped,
        arr: r.droppedArr,
        frac: droppedValue / first,
        slivers: r.dropGroups.map((g) => ({
          key: g.key,
          label: g.label,
          count: g.count,
          arr: g.arr,
          share: (arrMode ? g.arr : g.count) / denom,
        })),
      });
    }

    return {
      result: r,
      key: r.config.key,
      label: r.config.label,
      value: valueOf(r),
      frac,
      widthFrac: Math.max(frac, FUNNEL_MIN_BAND_FRACTION),
      wings,
    };
  });
}

export interface AdvanceLink {
  from: string;
  advanced: number;
  nextIntake: number;
  ok: boolean;
}

/**
 * MONOTONICITY CHECK — the taper's warrant.
 *
 * The connector between two bands is drawn as "the advancing cohort", which is
 * only honest if advanced_N === intake_{N+1}. That holds by construction (a
 * record advances exactly when the next stage's week is present, which is also
 * the next stage's intake test) — this returns the evidence so the page can log
 * it once per funnel instead of asserting it in prose.
 */
export function advanceChain<T>(results: StageResult<T>[]): AdvanceLink[] {
  const links: AdvanceLink[] = [];
  for (let i = 0; i < results.length - 1; i++) {
    links.push({
      from: results[i].config.key,
      advanced: results[i].advanced,
      nextIntake: results[i + 1].intake,
      ok: results[i].advanced === results[i + 1].intake,
    });
  }
  return links;
}

export interface DropReconciliation {
  stage: string;
  dropped: number;
  groupSum: number;
  ok: boolean;
}

/**
 * DROP DECOMPOSITION CHECK — the warrant for subdividing a dropped wing.
 *
 * Every dropped record contributes to exactly one `dropGroups` entry (loss
 * reason for deals, disqualification reason for leads, or the pooled
 * "Reason not recorded" bucket), so Σ group counts === dropped for every
 * stage. This returns the evidence so the page can log it rather than assert
 * it in prose.
 */
export function dropReconciliation<T>(results: StageResult<T>[]): DropReconciliation[] {
  return results.map((r) => {
    const groupSum = r.dropGroups.reduce((s, g) => s + g.count, 0);
    return { stage: r.config.key, dropped: r.dropped, groupSum, ok: groupSum === r.dropped };
  });
}

export interface LineageBridge {
  /** leads in the cohort that reached SQO */
  sqoCount: number;
  /** SQOs that have a deal record pointing back at them */
  sqoWithDeal: number;
  /** deals whose `leadId` resolves to a lead in the cohort */
  dealsFromLeads: number;
  /** deals created with no lead lineage at all (imported / ABM) */
  dealsNoLineage: number;
  /** deals whose `leadId` is set but whose lead is outside the filtered cohort */
  dealsLeadOutsideCohort: number;
}

/**
 * THE SQO → DEAL BRIDGE.
 *
 * The two funnels do not reconcile and the UI must not pretend they do: some
 * SQOs never get an opportunity record, and some deals are created with no lead
 * lineage (`leadId === null`). This derives both sides so the connector between
 * the funnels can state the pass-through and show the lineage-less deals as a
 * labelled side-inflow into the deal funnel's first band.
 */
export function lineageBridge(leads: Lead[], deals: Deal[]): LineageBridge {
  const sqo = leads.filter((l) => l.sqoWeek !== null);
  const sqoIds = new Set(sqo.map((l) => l.id));
  const linkedSqoIds = new Set<string>();
  let dealsNoLineage = 0;
  let dealsLeadOutsideCohort = 0;

  for (const d of deals) {
    if (d.leadId === null) {
      dealsNoLineage++;
    } else if (sqoIds.has(d.leadId)) {
      linkedSqoIds.add(d.leadId);
    } else {
      dealsLeadOutsideCohort++;
    }
  }

  return {
    sqoCount: sqo.length,
    sqoWithDeal: linkedSqoIds.size,
    dealsFromLeads: deals.length - dealsNoLineage - dealsLeadOutsideCohort,
    dealsNoLineage,
    dealsLeadOutsideCohort,
  };
}


/* ------------------------------------------------------------- formatting */

export function fmtArr(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

export function titleCase(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ============================================================================
 * PHASE 2 DERIVATIONS
 * ----------------------------------------------------------------------------
 * Trends, closed-lost and channel-quality figures. Same rule as above: nothing
 * here authors a number, and every derivation is documented where it is
 * defined and exposed to the UI through an `*Explainer()` registry entry.
 * ==========================================================================*/

/* ------------------------------------------------------- cohort maturity ---- */

/**
 * MATURITY CUTOFF — derived, never hardcoded.
 *
 * A weekly cohort can only be judged once its members have had time to walk the
 * whole funnel. The time budget for that walk is already declared per stage as
 * `staleWeeks` (the window inside which "hasn't moved yet" still counts as
 * pending). Summing those windows along a funnel gives the number of trailing
 * weeks whose cohorts are structurally too young to be conclusive.
 *
 * Change a stage's `staleWeeks` and the maturity flag on the charts moves with
 * it automatically.
 */
export function maturityWeeks<T>(stages: StageConfig<T>[]): number {
  return stages.reduce((sum, s) => sum + s.staleWeeks, 0);
}

export const LEAD_MATURITY_WEEKS = maturityWeeks(LEAD_STAGES);
export const DEAL_MATURITY_WEEKS = maturityWeeks(DEAL_STAGES);

/**
 * PER-MILESTONE MATURITY — the whole-funnel budget above is the worst case. A
 * cohort judged only on "did it reach qualified?" needs the staleness windows
 * of the stages BEFORE qualified, not the windows of the stages after it. So
 * each milestone gets its own budget: the cumulative `staleWeeks` of every
 * stage preceding it. Shallow milestones therefore mature earlier than deep
 * ones, and each series flags its own tail.
 */
export function milestoneMaturity<T>(stages: StageConfig<T>[]): Record<string, number> {
  const out: Record<string, number> = {};
  let cumulative = 0;
  for (const stage of stages) {
    out[stage.key] = cumulative;
    cumulative += stage.staleWeeks;
  }
  return out;
}

export const LEAD_MILESTONE_MATURITY = milestoneMaturity(LEAD_STAGES);
export const DEAL_MILESTONE_MATURITY = milestoneMaturity(DEAL_STAGES);

/** Weeks a cohort needs before its "ever won" rate is conclusive. */
export const WON_MATURITY_WEEKS = DEAL_MATURITY_WEEKS;

/** First week whose cohort is still maturing, for a given maturity budget. */
export function maturingFrom(budget: number): number {
  return CURRENT_WEEK - budget + 1;
}

/* ------------------------------------------------------- weekly cohort ------ */

export interface WeeklyCohort {
  week: number;
  label: string;
  leads: number;
  deals: number;
  /** Share of the week's leads that EVENTUALLY reached each milestone. */
  qualifiedShare: number;
  meetingShare: number;
  sqoShare: number;
  /** Share of the week's deals that eventually reached a won outcome. */
  wonShare: number;
  dealArr: number;
  /** True when the cohort is younger than the derived maturity budget. */
  leadMaturing: boolean;
  dealMaturing: boolean;
  /** Per-milestone maturity, keyed by stage key (plus `won`). */
  maturingBy: Record<string, boolean>;
}

/**
 * WEEKLY COHORT CONVERSION — cohorts are keyed by CREATION week, and the
 * conversion numerator is "ever reached the milestone", regardless of when.
 * That is what makes the series a cohort curve rather than a weekly activity
 * count: a lead created in week 3 that qualifies in week 9 credits week 3.
 */
export function weeklyCohorts(leads: Lead[], deals: Deal[], filters: Filters): WeeklyCohort[] {
  const leadMaturingFrom = maturingFrom(LEAD_MATURITY_WEEKS);
  const dealMaturingFrom = maturingFrom(DEAL_MATURITY_WEEKS);
  const out: WeeklyCohort[] = [];

  for (let week = filters.weekFrom; week <= filters.weekTo; week++) {
    const lc = leads.filter((l) => l.createdWeek === week);
    const dc = deals.filter((d) => d.createdWeek === week);
    const share = (n: number) => (lc.length ? n / lc.length : 0);
    out.push({
      week,
      label: weekShortLabel(week),
      leads: lc.length,
      deals: dc.length,
      qualifiedShare: share(lc.filter((l) => l.qualifiedWeek !== null).length),
      meetingShare: share(lc.filter((l) => l.meetingWeek !== null).length),
      sqoShare: share(lc.filter((l) => l.sqoWeek !== null).length),
      wonShare: dc.length ? dc.filter((d) => d.status === "won").length / dc.length : 0,
      dealArr: dc.reduce((s, d) => s + d.arr, 0),
      leadMaturing: week >= leadMaturingFrom,
      dealMaturing: week >= dealMaturingFrom,
      maturingBy: {
        qualified: week >= maturingFrom(LEAD_MILESTONE_MATURITY.qualified),
        meeting: week >= maturingFrom(LEAD_MILESTONE_MATURITY.meeting),
        sqo: week >= maturingFrom(LEAD_MILESTONE_MATURITY.sqo),
        won: week >= maturingFrom(WON_MATURITY_WEEKS),
      },
    });
  }
  return out;
}

/* --------------------------------------------------- pipeline created ------ */

export interface StackedWeek {
  week: number;
  label: string;
  total: number;
  parts: { key: string; value: number }[];
  maturing: boolean;
}

/**
 * PIPELINE CREATED PER WEEK — ARR of deals whose `createdWeek` is that week,
 * split by segment. Deals are counted at creation, so the series is unaffected
 * by later stage movement or outcome.
 */
export function pipelineByWeek(deals: Deal[], filters: Filters): StackedWeek[] {
  const dealMaturingFrom = maturingFrom(DEAL_MATURITY_WEEKS);
  const out: StackedWeek[] = [];
  for (let week = filters.weekFrom; week <= filters.weekTo; week++) {
    const dc = deals.filter((d) => d.createdWeek === week);
    const parts = SEGMENTS.map((seg) => ({
      key: seg,
      value: dc.filter((d) => d.segment === seg).reduce((s, d) => s + d.arr, 0),
    }));
    out.push({
      week,
      label: weekShortLabel(week),
      total: parts.reduce((s, p) => s + p.value, 0),
      parts,
      maturing: week >= dealMaturingFrom,
    });
  }
  return out;
}

/* ------------------------------------------------------- biggest mover ----- */

export interface Mover {
  series: string;
  fromLabel: string;
  toLabel: string;
  from: number;
  to: number;
  delta: number;
  direction: "up" | "down" | "flat";
}

/**
 * BIGGEST WEEK-OVER-WEEK MOVER — scans consecutive pairs of a series and keeps
 * the pair with the largest absolute delta. Cohorts inside the maturity budget
 * are excluded so an incomplete week can never win the callout.
 */
export function biggestMover(
  series: string,
  points: { label: string; value: number; maturing?: boolean }[],
): Mover | null {
  const usable = points.filter((p) => !p.maturing);
  let best: Mover | null = null;
  for (let i = 1; i < usable.length; i++) {
    const from = usable[i - 1];
    const to = usable[i];
    const delta = to.value - from.value;
    if (best === null || Math.abs(delta) > Math.abs(best.delta)) {
      best = {
        series,
        fromLabel: from.label,
        toLabel: to.label,
        from: from.value,
        to: to.value,
        delta,
        direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
      };
    }
  }
  return best;
}

/* ============================================================== closed-lost */

export type LossGrouping = "segment" | "source" | "size";

export const LOSS_GROUPING_LABEL: Record<LossGrouping, string> = {
  segment: "Segment",
  source: "Source",
  size: "Deal-size band",
};

export interface SizeBands {
  /** Upper bound (inclusive) of the small band and of the mid band. */
  cut1: number;
  cut2: number;
  labels: [string, string, string];
}

/**
 * DEAL-SIZE BANDS — TERCILE RULE.
 *
 * Bands are not fixed dollar buckets: they are the terciles of the ARR of the
 * LOST deals currently in view. Sort lost ARR ascending, take the values at the
 * 1/3 and 2/3 positions as the two cut points, then:
 *
 *   small  = arr <= cut1        mid = cut1 < arr <= cut2        large = arr > cut2
 *
 * So each band holds ~a third of the lost deals for any filter combination, and
 * the bands re-derive whenever the filters change.
 */
export function lostSizeBands(lost: Deal[]): SizeBands {
  const sorted = lost.map((d) => d.arr).sort((a, b) => a - b);
  const at = (q: number) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0;
  const cut1 = at(1 / 3);
  const cut2 = at(2 / 3);
  return {
    cut1,
    cut2,
    labels: [`≤ ${fmtArr(cut1)}`, `${fmtArr(cut1)}–${fmtArr(cut2)}`, `> ${fmtArr(cut2)}`],
  };
}

export function sizeBandOf(arr: number, bands: SizeBands): string {
  if (arr <= bands.cut1) return bands.labels[0];
  if (arr <= bands.cut2) return bands.labels[1];
  return bands.labels[2];
}

export interface MatrixCell {
  row: string;
  col: string;
  arr: number;
  count: number;
  deals: Deal[];
}

export interface LossMatrix {
  grouping: LossGrouping;
  rows: { key: string; label: string; arr: number; count: number }[];
  cols: { key: string; label: string; arr: number; count: number }[];
  cells: Map<string, MatrixCell>;
  totalArr: number;
  totalCount: number;
  bands: SizeBands;
  /** True when every cell sums back to the headline lost ARR. */
  reconciles: boolean;
}

/**
 * ARR-WEIGHTED LOSS MATRIX — rows are loss categories, columns are one of the
 * three switchable groupings. Every lost deal lands in exactly one cell, so
 * row totals, column totals and the sum of all cells all equal the headline
 * lost ARR; `reconciles` asserts that rather than trusting it.
 */
export function lossMatrix(lostDeals: Deal[], grouping: LossGrouping): LossMatrix {
  const bands = lostSizeBands(lostDeals);
  const colOf = (d: Deal) =>
    grouping === "size" ? sizeBandOf(d.arr, bands) : titleCase(d[grouping]);
  const colOrder =
    grouping === "size"
      ? [...bands.labels]
      : grouping === "segment"
        ? SEGMENTS.map(titleCase)
        : SOURCES.map(titleCase);

  const cells = new Map<string, MatrixCell>();
  const rowTotals = new Map<string, { arr: number; count: number }>();
  const colTotals = new Map<string, { arr: number; count: number }>();

  for (const d of lostDeals) {
    if (!d.lossReason) continue;
    const row = d.lossReason.category;
    const col = colOf(d);
    const key = `${row}|${col}`;
    const cell = cells.get(key) ?? { row, col, arr: 0, count: 0, deals: [] };
    cell.arr += d.arr;
    cell.count += 1;
    cell.deals.push(d);
    cells.set(key, cell);
    const rt = rowTotals.get(row) ?? { arr: 0, count: 0 };
    rowTotals.set(row, { arr: rt.arr + d.arr, count: rt.count + 1 });
    const ct = colTotals.get(col) ?? { arr: 0, count: 0 };
    colTotals.set(col, { arr: ct.arr + d.arr, count: ct.count + 1 });
  }

  const totalArr = lostDeals.reduce((s, d) => s + d.arr, 0);
  const cellSum = [...cells.values()].reduce((s, c) => s + c.arr, 0);

  return {
    grouping,
    rows: [...rowTotals.entries()]
      .map(([key, t]) => ({
        key,
        label: LOSS_CATEGORY_LABEL[key as LossCategory],
        arr: t.arr,
        count: t.count,
      }))
      .sort((a, b) => b.arr - a.arr),
    cols: colOrder
      .filter((c) => colTotals.has(c))
      .map((c) => ({ key: c, label: c, ...colTotals.get(c)! })),
    cells,
    totalArr,
    totalCount: lostDeals.length,
    bands,
    reconciles: cellSum === totalArr,
  };
}

export interface DetailRow {
  category: LossCategory;
  categoryLabel: string;
  detail: string;
  arr: number;
  count: number;
}

/**
 * REASON DETAIL BREAKDOWN — the fixed per-category detail labels from the data
 * layer, ranked by lost ARR inside their category. Details are categorical, so
 * this is a group-and-sum, never text analysis.
 */
export function lossDetails(lostDeals: Deal[]): DetailRow[] {
  const map = new Map<string, DetailRow>();
  for (const d of lostDeals) {
    if (!d.lossReason) continue;
    const { category, detail } = d.lossReason;
    const key = `${category}|${detail}`;
    const row =
      map.get(key) ??
      ({
        category,
        categoryLabel: LOSS_CATEGORY_LABEL[category],
        detail,
        arr: 0,
        count: 0,
      } satisfies DetailRow);
    row.arr += d.arr;
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort(
    (a, b) => a.categoryLabel.localeCompare(b.categoryLabel) || b.arr - a.arr,
  );
}

/**
 * LOSS MIX OVER TIME — lost ARR bucketed into fixed 4-week blocks by CLOSE
 * week (when the loss was booked, not when the deal was created) and split by
 * category. Buckets are aligned to the start of the filtered window.
 */
export function lossMixOverTime(
  lostDeals: Deal[],
  filters: Filters,
  bucketWeeks = 4,
): StackedWeek[] {
  const out: StackedWeek[] = [];
  const categories = [...new Set(lostDeals.map((d) => d.lossReason!.category))];
  for (let start = filters.weekFrom; start <= filters.weekTo; start += bucketWeeks) {
    const end = Math.min(start + bucketWeeks - 1, filters.weekTo);
    const inBucket = lostDeals.filter(
      (d) => d.closedWeek !== null && d.closedWeek >= start && d.closedWeek <= end,
    );
    const parts = categories.map((c) => ({
      key: LOSS_CATEGORY_LABEL[c],
      value: inBucket.filter((d) => d.lossReason!.category === c).reduce((s, d) => s + d.arr, 0),
    }));
    out.push({
      week: start,
      label: `${weekShortLabel(start)}`,
      total: parts.reduce((s, p) => s + p.value, 0),
      parts,
      maturing: false,
    });
  }
  return out;
}

/* ================================================================= sources */

export interface SourceQuality extends CohortStat {
  /** Leads attributed to the source (lead-side volume). */
  leadVolume: number;
  /** Leads that reached SQO ÷ leads created. */
  leadToSqo: number;
  dealsOpened: number;
}

/**
 * CHANNEL QUALITY — extends `cohortStats` (still the single source of truth for
 * deal-side win rate, median won ACV and won ARR) with the lead-side volume and
 * lead→SQO pass-through for the same key, so both halves of a channel's story
 * come from one derivation.
 */
export function sourceQuality(leads: Lead[], deals: Deal[]): SourceQuality[] {
  const dealStats = new Map(cohortStats(deals, "source").map((s) => [s.key, s]));
  return SOURCES.map((src) => {
    const ls = leads.filter((l) => l.source === src);
    const base =
      dealStats.get(src) ??
      ({ key: src, volume: 0, closed: 0, winRate: 0, medianAcv: null, wonArr: 0 } as CohortStat);
    return {
      ...base,
      leadVolume: ls.length,
      leadToSqo: ls.length ? ls.filter((l) => l.sqoWeek !== null).length / ls.length : 0,
      dealsOpened: base.volume,
    };
  }).filter((s) => s.leadVolume > 0 || s.dealsOpened > 0);
}

export interface SourceShape {
  source: Source;
  stages: { key: string; label: string; count: number; ofFirst: number }[];
}

/**
 * PER-SOURCE FUNNEL SHAPE — runs the same `deriveFunnel` over each source's
 * leads, so the mini-funnels are the Funnel page's math restricted to a
 * channel, not a second implementation.
 */
export function sourceShapes(leads: Lead[], stages: StageConfig<Lead>[] = LEAD_STAGES): SourceShape[] {
  return SOURCES.map((source) => {
    const results = deriveFunnel(stages, leads.filter((l) => l.source === source));
    return {
      source,
      stages: results.map((r) => ({
        key: r.config.key,
        label: r.config.label,
        count: r.intake,
        ofFirst: r.ofFirst,
      })),
    };
  }).filter((s) => s.stages[0].count > 0);
}

/* --------------------------------------------------------- median helper --- */

/** Median of a numeric list — exposed for quadrant hints derived from plots. */
export function medianOf(values: number[]): number | null {
  return median(values);
}

/* ----------------------------------------- phase 2 explainer registries ---- */

export function trendExplainer(kind: "cohort" | "volume" | "pipeline" | "mover"): MetricExplainer[] {
  const maturity: MetricExplainer = {
    metric: "Still-maturing flag",
    computedFrom: `each series flags the trailing weeks inside ITS OWN budget — the cumulative \`staleWeeks\` of the stages preceding that milestone (qualified ${LEAD_MILESTONE_MATURITY.qualified}w, met ${LEAD_MILESTONE_MATURITY.meeting}w, SQO ${LEAD_MILESTONE_MATURITY.sqo}w, won ${WON_MATURITY_WEEKS}w); nothing is hardcoded`,
  };
  if (kind === "cohort")
    return [
      {
        metric: "Cohort",
        computedFrom:
          "records grouped by the week they were CREATED, after the global filters — the x-axis is when the lead arrived, not when it converted",
      },
      {
        metric: "Reached qualified / booked a meeting / reached SQO",
        computedFrom:
          "leads created that week that later reached the milestone, at any point since ÷ leads created that week",
      },
      {
        metric: "Went on to win",
        computedFrom: "deals created that week that later closed won ÷ deals created that week",
      },
      maturity,
    ];
  if (kind === "volume")
    return [
      { metric: "Leads created", computedFrom: "count of leads whose `createdWeek` is that week" },
      { metric: "Deals created", computedFrom: "count of deals whose `createdWeek` is that week" },
      maturity,
    ];
  if (kind === "pipeline")
    return [
      {
        metric: "Pipeline created",
        computedFrom: "sum of `arr` over deals opened that week, counted at creation",
      },
      { metric: "Stack", computedFrom: "the same weekly ARR split by the deal's segment" },
      maturity,
    ];
  return [
    {
      metric: "Biggest mover",
      computedFrom:
        "largest absolute week-over-week delta in the series, scanning consecutive weeks",
    },
    maturity,
  ];
}

export function lossExplainer(kind: "headline" | "matrix" | "detail" | "mix"): MetricExplainer[] {
  if (kind === "headline")
    return [
      { metric: "Lost deals / lost ARR", computedFrom: "deals with `status = lost`, count and Σ`arr`" },
      {
        metric: "Share of closed ARR lost",
        computedFrom: "lost ARR ÷ (lost ARR + closed-won ARR); open deals are excluded",
      },
      { metric: "Top category", computedFrom: "loss category with the highest Σ`arr`" },
    ];
  if (kind === "matrix")
    return [
      { metric: "Rows", computedFrom: "the loss category on each lost deal's `lossReason`" },
      {
        metric: "Columns",
        computedFrom: "segment, source, or deal-size band — switchable, same underlying deals",
      },
      {
        metric: "Deal-size bands",
        computedFrom:
          "terciles of the lost-deal ARR in view: cuts at the 1/3 and 2/3 positions of ascending ARR, so each band holds ~a third of lost deals and re-derives with the filters",
      },
      { metric: "Cell", computedFrom: "Σ`arr` of the deals in that category × column, count beneath" },
      {
        metric: "Reconciliation",
        computedFrom:
          "every lost deal lands in exactly one cell, so Σcells = Σrows = Σcolumns = headline lost ARR (asserted, and logged to the console)",
      },
    ];
  if (kind === "detail")
    return [
      {
        metric: "Detail rows",
        computedFrom: "the fixed categorical detail label on `lossReason`, grouped and summed by ARR",
      },
      { metric: "Rank", computedFrom: "descending Σ`arr` inside each category" },
    ];
  return [
    {
      metric: "Bucket",
      computedFrom: "4-week blocks aligned to the start of the filtered window, keyed by close week",
    },
    { metric: "Stack", computedFrom: "lost ARR in the bucket split by loss category" },
  ];
}

export function sourceExplainer(kind: "table" | "shape" | "scatter"): MetricExplainer[] {
  if (kind === "table")
    return [
      { metric: "Leads", computedFrom: "leads attributed to the source, after the global filters" },
      { metric: "Lead → SQO", computedFrom: "leads with an `sqoWeek` ÷ leads created" },
      { metric: "Deals opened", computedFrom: "deals attributed to the source" },
      {
        metric: "Win rate · closed",
        computedFrom: "won ÷ (won + lost) for the source — open deals excluded (via `cohortStats`)",
      },
      { metric: "Median won ACV", computedFrom: "median `arr` across won deals for the source" },
      { metric: "Won ARR", computedFrom: "Σ`arr` across won deals for the source" },
    ];
  if (kind === "shape")
    return [
      {
        metric: "Mini-funnel",
        computedFrom: "the lead funnel derivation re-run over that source's leads only",
      },
      { metric: "Bar length", computedFrom: "stage intake ÷ the source's leads-created intake" },
    ];
  return [
    { metric: "X", computedFrom: "lead volume for the source" },
    { metric: "Y", computedFrom: "win rate on closed deals for the source" },
    { metric: "Point size", computedFrom: "won ARR, area-scaled against the largest source" },
    {
      metric: "Quadrant hints",
      computedFrom: "medians of the plotted x and y values themselves — they move with the filters",
    },
  ];
}

/* ============================================================================
 * POSTURE CARDS — funnel-page rail derivations
 * ----------------------------------------------------------------------------
 * Small series backing the visual cards beside the funnel. Same rule as
 * everything above: derived from the filtered cohort, documented here, and
 * exposed through `postureExplainer()` so the UI popover cannot drift.
 * ==========================================================================*/

export interface WeekValue {
  week: number;
  label: string;
  value: number;
}

/**
 * WON ARR PER WEEK — Σ`arr` of the cohort's won deals, keyed by `closedWeek`.
 * A close recorded in week N is final: unlike the creation-cohort series on
 * /trends, a past week can never gain more closes, so no maturity dimming
 * applies here. Weeks with no closes render as zero, never as gaps.
 */
export function wonArrByWeek(deals: Deal[], filters: Filters): WeekValue[] {
  const out: WeekValue[] = [];
  for (let week = filters.weekFrom; week <= filters.weekTo; week++) {
    out.push({
      week,
      label: weekShortLabel(week),
      value: deals
        .filter((d) => d.status === "won" && d.closedWeek === week)
        .reduce((s, d) => s + d.arr, 0),
    });
  }
  return out;
}

export interface StageArr {
  key: string;
  label: string;
  arr: number;
  count: number;
}

/**
 * OPEN ARR BY CURRENT STAGE — an open deal's current stage is the FURTHEST
 * `DEAL_STAGES` entry whose `enteredWeek` is non-null. Iterates the same stage
 * config as the funnel, so adding or renaming a stage follows automatically.
 * The terminal `closed` stage can never hold an open deal and is omitted.
 */
export function openArrByStage(deals: Deal[]): StageArr[] {
  const rows: StageArr[] = DEAL_STAGES.filter((s) => s.key !== "closed").map((s) => ({
    key: s.key,
    label: s.label,
    arr: 0,
    count: 0,
  }));
  for (const d of deals) {
    if (d.status !== "open") continue;
    let idx = -1;
    rows.forEach((row, i) => {
      const stage = DEAL_STAGES[i];
      if (stage.enteredWeek(d) !== null) idx = i;
    });
    if (idx >= 0) {
      rows[idx].arr += d.arr;
      rows[idx].count += 1;
    }
  }
  return rows;
}

export function postureExplainer(
  kind: "won" | "outcomes" | "stage" | "segment" | "bridge",
): MetricExplainer[] {
  if (kind === "won")
    return [
      {
        metric: "Closed-won ARR",
        computedFrom: "Σ`arr` across the cohort's won deals (via `derivePosture`)",
      },
      {
        metric: "Sparkline",
        computedFrom:
          "Σ`arr` of won deals keyed by `closedWeek`, one point per window week (`wonArrByWeek`). Closes are final at close week, so no maturity dimming applies",
      },
    ];
  if (kind === "outcomes")
    return [
      {
        metric: "Ring segments",
        computedFrom: "won / lost / open deal counts from the filtered cohort (`derivePosture`)",
      },
      {
        metric: "Win rate · closed",
        computedFrom: "won ÷ (won + lost) — open deals excluded",
      },
    ];
  if (kind === "stage")
    return [
      {
        metric: "Bar per stage",
        computedFrom:
          "Σ`arr` of OPEN deals whose furthest entered stage is that stage (`openArrByStage`); iterates `DEAL_STAGES`, terminal stage omitted",
      },
      { metric: "Bar length", computedFrom: "stage ARR ÷ the largest stage ARR in view" },
    ];
  if (kind === "segment")
    return [
      {
        metric: "Bar per segment",
        computedFrom: "Σ`arr` across won deals for the segment (via `cohortStats`)",
      },
      { metric: "Bar length", computedFrom: "segment won ARR ÷ the largest segment in view" },
      { metric: "Median won ACV", computedFrom: "median `arr` across ALL won deals in the cohort" },
    ];
  return [
    {
      metric: "SQO → deal",
      computedFrom:
        "cohort SQOs whose lead id appears on a deal record ÷ all cohort SQOs (`lineageBridge`); linkage uses unfiltered deals on purpose",
    },
    {
      metric: "No lead lineage",
      computedFrom:
        "deals in the cohort with no `leadId` — the side-inflow on the deal funnel. The two funnels do NOT reconcile, by design",
    },
  ];
}

/* ============================================================================
 * WEEKLY TIME SERIES — "is this up or down?"
 * ----------------------------------------------------------------------------
 * These are ACTIVITY counts, not cohort curves. A record is counted in the week
 * the event happened: a lead created in week 3 that qualifies in week 9 adds to
 * `leadsCreated` in week 3 and to `qualified` in week 9. That is the opposite
 * anchoring to `weeklyCohorts()` below-the-fold, and it is the whole reason the
 * two live in different sections of the page.
 *
 * MATURITY DOES NOT APPLY HERE. Once a week has closed, the number of leads
 * created in it is final; it can never grow. Dimming these counts would imply
 * an uncertainty that does not exist. The maturing convention (dashed line,
 * hollow markers, `MaturingBand`) applies only to RATES and cohort shares,
 * where the denominator's cohort is genuinely still converting.
 * ==========================================================================*/

export interface ActivityWeek {
  week: number;
  label: string;
  leadsCreated: number;
  qualified: number;
  sqo: number;
  dealsCreated: number;
  wonDeals: number;
}

export type WeeklyMetricKey = keyof Omit<ActivityWeek, "week" | "label">;

export function weeklyActivity(
  leads: Lead[],
  deals: Deal[],
  filters: Filters,
): ActivityWeek[] {
  const out: ActivityWeek[] = [];
  for (let week = filters.weekFrom; week <= filters.weekTo; week++) {
    out.push({
      week,
      label: weekShortLabel(week),
      leadsCreated: leads.filter((l) => l.createdWeek === week).length,
      qualified: leads.filter((l) => l.qualifiedWeek === week).length,
      sqo: leads.filter((l) => l.sqoWeek === week).length,
      dealsCreated: deals.filter((d) => d.createdWeek === week).length,
      wonDeals: deals.filter((d) => d.status === "won" && d.closedWeek === week).length,
    });
  }
  return out;
}

/**
 * WEEKLY SERIES CONFIG — one entry per chart, in render order. Adding a weekly
 * series means adding an entry here plus a field on `ActivityWeek`; the page
 * iterates this config and never names a metric itself.
 *
 * `target` reads straight from the authored `WEEKLY_TARGETS` in `data.ts`.
 */
export interface WeeklyMetricConfig {
  key: WeeklyMetricKey;
  label: string;
  /** The plain-language question the chart answers, shown as the subtitle. */
  question: string;
  side: "lead" | "deal";
  /** Whether a rising count is favourable — drives delta colour, never the sign. */
  direction: DeltaDirection;
  target: number | null;
  computedFrom: string;
}

export const WEEKLY_METRICS: WeeklyMetricConfig[] = [
  {
    key: "leadsCreated",
    label: "Leads created",
    question: "How many new leads arrived each week?",
    side: "lead",
    direction: "up-good",
    target: WEEKLY_TARGETS.leadsCreated,
    computedFrom: "count of leads whose `createdWeek` is that week",
  },
  {
    key: "qualified",
    label: "Leads qualified",
    question: "How many leads did we qualify each week?",
    side: "lead",
    direction: "up-good",
    target: WEEKLY_TARGETS.qualified,
    computedFrom:
      "count of leads whose `qualifiedWeek` is that week — the week the qualification happened, not the week the lead arrived",
  },
  {
    key: "sqo",
    label: "Sales-qualified (SQO)",
    question: "How many leads reached sales-qualified each week?",
    side: "lead",
    direction: "up-good",
    target: WEEKLY_TARGETS.sqo,
    computedFrom: "count of leads whose `sqoWeek` is that week",
  },
  {
    key: "dealsCreated",
    label: "Deals created",
    question: "How many new deals were opened each week?",
    side: "deal",
    direction: "up-good",
    target: WEEKLY_TARGETS.dealsCreated,
    computedFrom: "count of deals whose `createdWeek` is that week",
  },
  {
    key: "wonDeals",
    label: "Deals won",
    question: "How many deals closed won each week?",
    side: "deal",
    direction: "up-good",
    target: WEEKLY_TARGETS.wonDeals,
    computedFrom: "count of deals with `status = won` whose `closedWeek` is that week",
  },
];

export function weeklySeries(activity: ActivityWeek[], key: WeeklyMetricKey): WeekValue[] {
  return activity.map((a) => ({ week: a.week, label: a.label, value: a[key] }));
}

/* ------------------------------------------------------ target attainment -- */

export interface Attainment {
  target: number;
  /** Mean of the weekly actuals in view. */
  average: number;
  /** average ÷ target. */
  ratio: number;
  weeksAtOrAbove: number;
  weeks: number;
}

/**
 * ATTAINMENT — derived here, never authored. The target itself is the only
 * authored half (`WEEKLY_TARGETS` in `data.ts`); everything below is computed
 * from the same series the chart draws, over exactly the filtered weeks in view.
 */
export function targetAttainment(values: WeekValue[], target: number | null): Attainment | null {
  if (target === null || target <= 0 || values.length === 0) return null;
  const total = values.reduce((s, v) => s + v.value, 0);
  const average = total / values.length;
  return {
    target,
    average,
    ratio: average / target,
    weeksAtOrAbove: values.filter((v) => v.value >= target).length,
    weeks: values.length,
  };
}

/* ------------------------------------------------------------- win rate ---- */

export interface WinRateWeek extends WeekValue {
  /** Deals closed (won + lost) that week — the denominator behind `value`. */
  closed: number;
  won: number;
}

/**
 * WIN RATE BY CLOSE WEEK — won ÷ (won + lost) among deals CLOSED that week.
 * This is the one rate on the page whose numerator and denominator share the
 * chart's own anchoring (the close week), which is why it is allowed to overlay
 * the closed-won count and no other rate is. A closed week is settled, so this
 * rate carries no maturing tail either; weeks with nothing closed are `null`
 * territory and render as a gap in the count's own zero, with `closed = 0`.
 */
export function winRateByCloseWeek(deals: Deal[], filters: Filters): WinRateWeek[] {
  const out: WinRateWeek[] = [];
  for (let week = filters.weekFrom; week <= filters.weekTo; week++) {
    const closedThisWeek = deals.filter(
      (d) => d.closedWeek === week && (d.status === "won" || d.status === "lost"),
    );
    const won = closedThisWeek.filter((d) => d.status === "won").length;
    out.push({
      week,
      label: weekShortLabel(week),
      closed: closedThisWeek.length,
      won,
      value: closedThisWeek.length ? won / closedThisWeek.length : 0,
    });
  }
  return out;
}

/* --------------------------------------------------- weekly explainers ----- */

export function weeklyExplainer(metric: WeeklyMetricConfig): MetricExplainer[] {
  const items: MetricExplainer[] = [
    { metric: metric.label, computedFrom: metric.computedFrom },
    {
      metric: "Anchoring",
      computedFrom:
        "each record counts in the week its event happened, after the global filters — this is an activity count, not a creation cohort",
    },
    {
      metric: "No maturing flag",
      computedFrom:
        "a closed week's count is final and cannot grow, so no dashed tail or shading is applied; that convention is reserved for rates and cohort shares",
    },
  ];
  if (metric.target !== null)
    items.push({
      metric: "Target line",
      computedFrom:
        "authored per week in `WEEKLY_TARGETS` (src/lib/rf/data.ts) — a plan, not a derivation; attainment is `mean(weekly actual) ÷ target` over the weeks in view",
    });
  if (metric.key === "wonDeals")
    items.push({
      metric: "Win rate overlay",
      computedFrom:
        "won ÷ (won + lost) among deals CLOSED that week — the only rate sharing this chart's anchoring, which is why it is the only overlay permitted here",
    });
  return items;
}

/* ============================================================================
 * PERIOD-OVER-PERIOD COMPARISON — "and versus what?"
 * ----------------------------------------------------------------------------
 * Two comparisons, one rule set. Nothing here is authored: every figure is
 * re-derived from the same records, through the same code path, over a
 * different span of weeks.
 *
 * THE PARTIAL-PERIOD RULE (the important one).
 * `CURRENT_WEEK` is "now", so that week is still in progress: its counts are a
 * few days of a seven-day week. Comparing it to a completed week produces a
 * confident-looking decline that is an artefact of the calendar, not the
 * business. So the in-progress week is EXCLUDED FROM EVERY COMPARISON, on both
 * sides of it. The chart still draws the week — the bar is real data — but the
 * delta is measured on the last COMPLETE week and says so. Nothing is
 * projected, extrapolated or run-rated: inventing the rest of the week would be
 * a different lie in the same place.
 *
 * THE MOVING-RATE RULE.
 * A delta on a rate whose cohort is still converting compares two numbers that
 * are both still moving. Wherever the series itself carries the maturing flag,
 * the delta is SUPPRESSED and the reason is shown in its place. Raw activity
 * counts for a closed week are final, so they show their delta plainly.
 *
 * THE DIRECTION RULE.
 * Sign is not sentiment. Every compared metric declares whether up is
 * favourable; rising dropped leads and rising lost ARR are `up-bad`, volume
 * without an obvious reading stays `neutral` and is never coloured.
 * ==========================================================================*/

/** The week that has not finished yet. Excluded from every comparison. */
export const IN_PROGRESS_WEEK = CURRENT_WEEK;
/** The most recent week whose counts are final. */
export const LAST_COMPLETE_WEEK = CURRENT_WEEK - 1;

export type DeltaDirection = "up-good" | "up-bad" | "neutral";
export type DeltaTone = "good" | "bad" | "neutral";

export interface Delta {
  current: number;
  prior: number;
  /** current − prior, in the metric's own units. */
  absolute: number;
  /** absolute ÷ prior, or null when the prior period is zero (no base). */
  ratio: number | null;
  direction: DeltaDirection;
  /** What the sign MEANS, after applying `direction`. Never derived from sign alone. */
  tone: DeltaTone;
}

export interface Comparison {
  /** A delta is present only when a valid, complete comparison period exists. */
  delta: Delta | null;
  /** Why there is no delta, or why the one shown is qualified. Rendered verbatim. */
  note: string | null;
  currentLabel: string;
  priorLabel: string;
  /** True when the in-progress week was held out of the comparison. */
  excludedInProgress: boolean;
}

function makeDelta(current: number, prior: number, direction: DeltaDirection): Delta {
  const absolute = current - prior;
  const tone: DeltaTone =
    direction === "neutral" || absolute === 0
      ? "neutral"
      : absolute > 0 === (direction === "up-good")
        ? "good"
        : "bad";
  return {
    current,
    prior,
    absolute,
    ratio: prior === 0 ? null : absolute / prior,
    direction,
    tone,
  };
}

/* ------------------------------------------------------- week over week ---- */

/**
 * WEEK OVER WEEK — the last COMPLETE week in view against the one before it.
 * `values` is the series the chart already draws; this only picks two of its
 * points. `maturingFrom` is the series' own maturing threshold (a week index):
 * pass it for rates and cohort shares, omit it for activity counts.
 */
export function weekOverWeek(
  values: WeekValue[],
  direction: DeltaDirection,
  opts: { maturingFrom?: number } = {},
): Comparison {
  const excludedInProgress = values.some((v) => v.week >= IN_PROGRESS_WEEK);
  const usable = values.filter((v) => v.week <= LAST_COMPLETE_WEEK);
  const base: Comparison = {
    delta: null,
    note: null,
    currentLabel: "",
    priorLabel: "",
    excludedInProgress,
  };

  if (usable.length < 2)
    return { ...base, note: "not enough completed weeks in view to compare" };

  const current = usable[usable.length - 1];
  const prior = usable[usable.length - 2];
  const labels = { currentLabel: current.label, priorLabel: prior.label };

  if (opts.maturingFrom !== undefined && current.week >= opts.maturingFrom)
    return {
      ...base,
      ...labels,
      note: `${current.label} is still converting — a delta here would compare two moving numbers`,
    };

  return {
    ...base,
    ...labels,
    delta: makeDelta(current.value, prior.value, direction),
  };
}

/* --------------------------------------------------- window over window ---- */

export type HeadlineMetricKey =
  | "leadCount"
  | "dealCount"
  | "closedWonArr"
  | "wonCount"
  | "winRate"
  | "openPipelineArr"
  | "lostArr"
  | "lostCount";

/** Up is favourable, unfavourable, or genuinely ambiguous. Declared, never guessed. */
export const HEADLINE_DIRECTION: Record<HeadlineMetricKey, DeltaDirection> = {
  leadCount: "neutral",
  dealCount: "neutral",
  closedWonArr: "up-good",
  wonCount: "up-good",
  winRate: "up-good",
  openPipelineArr: "up-good",
  lostArr: "up-bad",
  lostCount: "up-bad",
};

export interface WindowComparison extends Comparison {
  /** The compared metrics, empty when no valid prior window exists. */
  metrics: Partial<Record<HeadlineMetricKey, Delta>>;
  /** Weeks in each side of the comparison. Both sides are always equal length. */
  weeks: number;
}

function headlineValues(leads: Lead[], deals: Deal[]): Record<HeadlineMetricKey, number> {
  const p = derivePosture(leads, deals);
  return {
    leadCount: p.leadCount,
    dealCount: p.dealCount,
    closedWonArr: p.closedWonArr,
    wonCount: p.wonCount,
    winRate: p.winRate,
    openPipelineArr: p.openPipelineArr,
    lostArr: deals.filter((d) => d.status === "lost").reduce((s, d) => s + d.arr, 0),
    lostCount: p.lostCount,
  };
}

/**
 * WINDOW OVER WINDOW — the filtered window against the immediately preceding
 * window OF EQUAL LENGTH. A 26-week view compares to the 26 weeks before it, an
 * 8-week view to the 8 weeks before it.
 *
 * The current window is first trimmed to the last complete week (partial-period
 * rule above), and the prior window is measured back from that trimmed length,
 * so both sides always span the same number of finished weeks.
 *
 * If the prior window would start before week 0 there is no equal-length period
 * to compare against. This returns NO delta and says so, rather than comparing
 * against a short or empty period, which would read as a collapse.
 *
 * Segment and source filters are held constant across both windows; only the
 * week span moves. Records are re-filtered through `applyFilters`, so the prior
 * window travels the identical derivation path as the current one.
 */
export function windowOverWindow(
  filters: Filters,
  dataset: Dataset = SAMPLE_DATASET,
): WindowComparison {
  const to = Math.min(filters.weekTo, LAST_COMPLETE_WEEK);
  const from = filters.weekFrom;
  const weeks = to - from + 1;
  const excludedInProgress = filters.weekTo >= IN_PROGRESS_WEEK;
  const base: WindowComparison = {
    delta: null,
    note: null,
    metrics: {},
    weeks: Math.max(0, weeks),
    currentLabel: weeks > 0 ? `${weekShortLabel(from)} – ${weekShortLabel(to)}` : "",
    priorLabel: "",
    excludedInProgress,
  };

  if (weeks < 1)
    return { ...base, note: "the selected window contains no completed weeks" };

  const priorFrom = from - weeks;
  const priorTo = from - 1;
  if (priorFrom < 0)
    return {
      ...base,
      note: `no prior ${weeks}-week period in the dataset — the window starts at the first week on record`,
    };

  const current = applyFilters({ ...filters, weekFrom: from, weekTo: to }, dataset);
  const prior = applyFilters({ ...filters, weekFrom: priorFrom, weekTo: priorTo }, dataset);
  const cv = headlineValues(current.leads, current.deals);
  const pv = headlineValues(prior.leads, prior.deals);

  const metrics: Partial<Record<HeadlineMetricKey, Delta>> = {};
  for (const key of Object.keys(HEADLINE_DIRECTION) as HeadlineMetricKey[])
    metrics[key] = makeDelta(cv[key], pv[key], HEADLINE_DIRECTION[key]);

  return {
    ...base,
    metrics,
    priorLabel: `${weekShortLabel(priorFrom)} – ${weekShortLabel(priorTo)}`,
  };
}

/* ------------------------------------------------- comparison explainers --- */

export function comparisonExplainer(kind: "week" | "window"): MetricExplainer[] {
  const shared: MetricExplainer[] = [
    {
      metric: "Partial period",
      computedFrom: `week ${IN_PROGRESS_WEEK} (${weekShortLabel(IN_PROGRESS_WEEK)}) is still in progress, so it is excluded from BOTH sides of every comparison. Nothing is projected or run-rated — the bar is still drawn, only the delta holds it out`,
    },
    {
      metric: "Direction",
      computedFrom:
        "each metric declares whether up is favourable (`HEADLINE_DIRECTION`); colour follows that declaration, never the sign. Volume metrics with no clear reading stay neutral and uncoloured",
    },
  ];
  if (kind === "week")
    return [
      {
        metric: "Week over week",
        computedFrom:
          "the last COMPLETE week in view minus the week before it, on the series the chart already draws (`weekOverWeek`). It is a header figure, never a second series",
      },
      ...shared,
      {
        metric: "Moving rates",
        computedFrom:
          "if the compared week is inside the series' own maturing budget, the delta is suppressed — two still-converting numbers cannot be compared. Activity counts for a closed week are final and always show theirs",
      },
    ];
  return [
    {
      metric: "Window over window",
      computedFrom:
        "the filtered window (trimmed to its last complete week) against the immediately preceding window OF EQUAL LENGTH, re-derived through `applyFilters` + `derivePosture` (`windowOverWindow`)",
    },
    ...shared,
    {
      metric: "No prior window",
      computedFrom:
        "if the preceding equal-length period would start before the first week on record, no delta is shown at all — a comparison against a short or empty period would read as a collapse",
    },
    {
      metric: "Cohort caveat",
      computedFrom:
        "both windows are creation cohorts, so the current window's most recent weeks are still converting. That affects both sides asymmetrically and is why outcome metrics move slowly here; it is disclosed, not corrected",
    },
  ];
}

/**
 * Narrows a window comparison to one headline metric, keeping the window's own
 * labels and partial-period flag so the chip can state what was compared.
 */
export function headlineComparison(w: WindowComparison, key: HeadlineMetricKey): Comparison {
  return {
    delta: w.metrics[key] ?? null,
    note: w.note,
    currentLabel: w.currentLabel,
    priorLabel: w.priorLabel,
    excludedInProgress: w.excludedInProgress,
  };
}
