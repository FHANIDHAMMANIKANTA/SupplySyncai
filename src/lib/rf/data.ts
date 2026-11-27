/* ============================================================================
 * TEMPLATE DATA LAYER — Crestline Cloud · Revenue Funnel
 * ----------------------------------------------------------------------------
 * This file is the ONLY place fictional data is authored. Everything else in
 * the app derives from it.
 *
 * SWAP PATH (how to put your own data in):
 *   1. Replace `LEADS` and `DEALS` with your own arrays conforming to the
 *      `Lead` and `Deal` interfaces below. Keep the field names. A `Lead` is a
 *      PERSON at a company: `contactName`, `contactTitle` and `seniority`
 *      identify the human, `companyName` is the account they work at.
 *   1b. Disqualification reasons are categorical. `Lead.disqualReason` takes a
 *      `DisqualCategory` plus a `detail` string drawn from
 *      `DISQUAL_DETAILS[category]` — never free text. Leave it `null` for
 *      leads that advanced, leads still in play, and drops where no reason was
 *      recorded (the engine pools those as "Reason not recorded"). The reason
 *      only EXPLAINS a drop; disposition is still derived from milestone gaps.
 *   2. Week numbers are integers `0 .. WEEK_COUNT - 1`, where 0 is the oldest
 *      week in the window and `CURRENT_WEEK` is "now". Convert your dates to
 *      that index (see `weekLabel` for the reverse mapping) and set
 *      `WINDOW_START_ISO` to your window's first Monday.
 *   3. A `null` milestone / stage week means the record never reached that
 *      step. The engine decides whether that is "pending" (entered recently,
 *      inside the staleness window) or "dropped" — you never author that.
 *   4. Stages, conversions, dispositions, filters, ARR weighting and every
 *      page then derive automatically. No page edits required.
 *   5. Different funnel shape? Stage definitions are editable configs in
 *      `src/lib/rf/engine.ts` (`LEAD_STAGES` / `DEAL_STAGES`). Add, remove or
 *      rename stages there and the UI iterates over the new configs. Nothing
 *      downstream is hardcoded: the Funnel, Trends, Closed-lost and Sources
 *      pages all iterate the configs and re-derive from `LEADS` / `DEALS`.
 *   6. WEEKLY TARGETS are the ONLY other authored input in this file. They are
 *      a plan, not an observation, so they cannot be derived — edit
 *      `WEEKLY_TARGETS` below (one object, one number per weekly series) and
 *      every reference line and attainment figure on /trends follows. Set a
 *      value to `null` to hide that metric's target line entirely.
 *

 * WEEK-INDEX CONVENTION — worked example:
 *   `WINDOW_START_ISO` is the Monday of week 0. With the value below
 *   ("2025-01-06") and `WEEK_COUNT = 26`, the window runs Mon 2025-01-06
 *   (week 0) through Sun 2025-07-06, and `CURRENT_WEEK = 25` is "now"
 *   (Monday 2025-06-30 — see `weekLabel(25)`).
 *
 *     week 0  -> 2025-01-06     week 12 -> 2025-03-31
 *     week 25 -> 2025-06-30  (CURRENT_WEEK)
 *
 *   Forward mapping for your own data (date -> index):
 *     week = Math.floor((date - WINDOW_START) / (7 * 24 * 60 * 60 * 1000))
 *   e.g. a deal closed on 2025-04-15 sits in
 *     floor((2025-04-15 − 2025-01-06) / 7d) = floor(99 / 7) = week 14.
 *   Reverse mapping (index -> date) is `weekLabel(week)` at the bottom of this
 *   file. Drop records outside `0 .. CURRENT_WEEK`; a milestone week greater
 *   than `CURRENT_WEEK` must be stored as `null` (it has not happened yet in
 *   this window), which is what makes the engine's pending/dropped split work.
 *
 * Data is generated deterministically from a fixed seed (mulberry32) so the
 * SSR pass and the client hydration render byte-identical output. Company names
 * are drawn from the invented `PREFIX` / `SUFFIX` lists below; they are checked
 * against real-world brands and are intentionally fictional.
 * ==========================================================================*/

export const WEEK_COUNT = 26;
export const CURRENT_WEEK = WEEK_COUNT - 1;
/** First day (Monday) of week 0. Used only for human-readable labels. */
export const WINDOW_START_ISO = "2025-01-06";

export type Source = "organic" | "paid" | "events" | "referral" | "outbound" | "partner";
export type Segment = "enterprise" | "mid-market" | "growth";
export type Region = "north-america" | "emea" | "apac" | "latam";

export const SOURCES: Source[] = [
  "organic",
  "paid",
  "events",
  "referral",
  "outbound",
  "partner",
];
export const SEGMENTS: Segment[] = ["enterprise", "mid-market", "growth"];

/* -------------------------------------------------------- weekly targets --- */

/**
 * WEEKLY TARGETS — the only authored input in this file besides the records
 * themselves, and deliberately so: a target is a plan someone committed to, not
 * something that can be derived from what happened.
 *
 * One number per weekly series on /trends, expressed per week (not per window).
 * `null` means "no target for this metric" and the reference line is simply not
 * drawn. Attainment against these numbers is DERIVED in `engine.ts`
 * (`targetAttainment`), never authored here.
 *
 * Remixers: this is the one place to edit. Nothing else needs to change.
 */
export interface WeeklyTargets {
  /** New leads created per week. */
  leadsCreated: number | null;
  /** Leads qualified per week (the week the qualification happened). */
  qualified: number | null;
  /** Leads reaching sales-qualified per week. */
  sqo: number | null;
  /** New deal records opened per week. */
  dealsCreated: number | null;
  /** Deals closed-won per week. */
  wonDeals: number | null;
  /** Win rate on deals closed in a week, as a fraction (0.35 = 35%). */
  winRate: number | null;
}

export const WEEKLY_TARGETS: WeeklyTargets = {
  leadsCreated: 30,
  qualified: 13,
  sqo: 5,
  dealsCreated: 5,
  wonDeals: 1,
  winRate: 0.35,
};


/**
 * A LEAD IS A PERSON AT A COMPANY — not the company itself. The company is an
 * attribute of the contact, so the same account can appear on several leads.
 *
 * Contact identity:
 *   `contactName`  display name of the person.
 *   `contactTitle` their job title as captured on the record.
 *   `seniority`    coarse bucket derived from the title at capture time; it is
 *                  what makes "wrong role or seniority" a usable filter.
 *
 * Disposition is still DERIVED from the milestone weeks below. `disqualReason`
 * only ever EXPLAINS a drop — it never causes one, and the engine reads it only
 * for records it has already placed in the dropped band.
 */
export interface Lead {
  id: string;
  /** Person's name — synthetic, generated from the fixed seed. */
  contactName: string;
  /** Job title as captured, e.g. "VP Revenue Operations". */
  contactTitle: string;
  /** Coarse seniority bucket for the title above. */
  seniority: Seniority;
  /** The account this person works at. */
  companyName: string;
  createdWeek: number;
  source: Source;
  segment: Segment;
  region: Region;
  /** Monotonically ordered when present; null = the lead stopped here. */
  qualifiedWeek: number | null;
  meetingWeek: number | null;
  sqoWeek: number | null;
  /**
   * Why this person was disqualified, when a reason was recorded. Categorical
   * only (see `DisqualCategory` / `DISQUAL_DETAILS`) — never free text. Null on
   * leads that advanced, on leads still in play, and on drops where nobody
   * wrote a reason down (the engine pools those as "Reason not recorded").
   */
  disqualReason: DisqualReason | null;
}


export type LossCategory =
  | "pricing"
  | "product_gap"
  | "compliance_gap"
  | "competitor"
  | "timing"
  | "no_decision";

export interface LossReason {
  category: LossCategory;
  /** Categorical label from a fixed per-category list — never prose. */
  detail: string;
}

export type DealStatus = "won" | "lost" | "open";

export interface Deal {
  id: string;
  /** null for outbound deals created without lead lineage. */
  leadId: string | null;
  companyName: string;
  source: Source;
  segment: Segment;
  region: Region;
  arr: number;
  createdWeek: number;
  discoveryWeek: number | null;
  evaluationWeek: number | null;
  proposalWeek: number | null;
  negotiationWeek: number | null;
  status: DealStatus;
  closedWeek: number | null;
  /** Only for open deals: the furthest stage reached. */
  currentStage: "created" | "discovery" | "evaluation" | "proposal" | "negotiation" | null;
  lossReason: LossReason | null;
}

export const LOSS_DETAILS: Record<LossCategory, string[]> = {
  pricing: ["Budget cut", "Discount not approved", "Credit model too rich"],
  product_gap: ["SSO/SCIM depth", "On-prem requirement", "API rate ceiling", "Reporting depth"],
  compliance_gap: ["Data residency", "FedRAMP required", "DPA terms", "Audit log retention"],
  competitor: ["Incumbent renewal", "Bundled with platform", "Lost on services"],
  timing: ["Reorg", "Fiscal year freeze", "Migration deferred"],
  no_decision: ["Champion left", "No exec sponsor", "Went dark", "Priority displaced"],
};

export const LOSS_CATEGORY_LABEL: Record<LossCategory, string> = {
  pricing: "Pricing",
  product_gap: "Product gap",
  compliance_gap: "Compliance gap",
  competitor: "Competitor",
  timing: "Timing",
  no_decision: "No decision",
};

/* ------------------------------------------------- lead-side disqualification
 * The lead mirror of `LossCategory` / `LOSS_DETAILS`. A categorical union with
 * a fixed per-category detail list — never free text, never a model-generated
 * string. Anything outside these sets is discarded upstream, not coerced.
 * ------------------------------------------------------------------------- */

export type Seniority = "c-level" | "vp" | "director" | "manager" | "practitioner" | "unknown";

export const SENIORITY_LABEL: Record<Seniority, string> = {
  "c-level": "C-level",
  vp: "VP",
  director: "Director",
  manager: "Manager",
  practitioner: "Practitioner",
  unknown: "Unknown",
};

export type DisqualCategory =
  | "not_icp"
  | "wrong_persona"
  | "support_request"
  | "no_budget"
  | "competitor"
  | "timing"
  | "unresponsive"
  | "junk";

export interface DisqualReason {
  category: DisqualCategory;
  /** Categorical label from the fixed per-category list — never prose. */
  detail: string;
}

export const DISQUAL_DETAILS: Record<DisqualCategory, string[]> = {
  not_icp: ["Company too small", "Wrong industry", "Unsupported region", "Consumer, not business"],
  wrong_persona: [
    "No authority to buy",
    "Wrong department",
    "Student or researcher",
    "Job seeker",
  ],
  support_request: ["Existing customer ticket", "Billing question", "Partner or vendor enquiry"],
  no_budget: ["No budget this cycle", "Below minimum contract", "Free tier only"],
  competitor: ["Chose another vendor", "Incumbent renewed", "Competitor research"],
  timing: ["Evaluating next fiscal year", "Project deferred", "Hiring freeze"],
  unresponsive: ["No-show at booked meeting", "Went dark after outreach", "Bad contact details"],
  junk: ["Spam or bot submission", "Test submission", "Duplicate record"],
};

export const DISQUAL_CATEGORY_LABEL: Record<DisqualCategory, string> = {
  not_icp: "Not ICP",
  wrong_persona: "Wrong role or seniority",
  support_request: "Support request",
  no_budget: "No budget",
  competitor: "Competitor",
  timing: "Timing",
  unresponsive: "Unresponsive",
  junk: "Junk or spam",
};

/**
 * Which reasons are plausible at each lead stage. A lead that dies before
 * qualification fails for different reasons than one that no-shows a booked
 * meeting, so the taxonomy is scoped per stage rather than offered whole.
 * Keys match the `LEAD_STAGES` config keys in `engine.ts`.
 */
export const DISQUAL_BY_STAGE: Record<string, DisqualCategory[]> = {
  created: ["not_icp", "wrong_persona", "junk", "support_request", "no_budget", "unresponsive"],
  qualified: ["unresponsive", "timing", "no_budget", "wrong_persona", "competitor"],
  meeting: ["no_budget", "timing", "competitor", "unresponsive", "not_icp"],
  sqo: ["competitor", "timing", "no_budget", "unresponsive"],
};


/* ---------------------------------------------------------------- generator */

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x0c9e5713);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function weighted<T extends string>(table: Record<T, number>): T {
  const keys = Object.keys(table) as T[];
  const total = keys.reduce((s, k) => s + table[k], 0);
  let r = rand() * total;
  for (const k of keys) {
    r -= table[k];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

function intBetween(lo: number, hi: number) {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

const PREFIX = [
  "Wraysbury",
  "Ellsworth",
  "Verdant",
  "Brightwater",
  "Ironvale",
  "Tarnbrook",
  "Marrow",
  "Fallowmere",
  "Larkfield",
  "Tessellate",
  "Quarry",
  "Wexford",
  "Ambler",
  "Fernbrook",
  "Copperline",
  "Havenmoor",
  "Culmstock",
  "Orrery",
  "Pellucid",
  "Draycott",
  "Windrow",
  "Ashgrove",
  "Calder",
  "Bramblewick",
  "Fenmark",
  "Sablecrest",
  "Untrodden",
  "Lithgow",
  "Vantram",
  "Oakhurst",
  "Sundermere",
  "Ravelin",
  "Pallory",
  "Cindermill",
  "Wrenhaven",
];
const SUFFIX = [
  "Logistics",
  "Analytics",
  "Biotech",
  "Foundry",
  "Systems",
  "Health",
  "Retail Group",
  "Freight",
  "Insurance",
  "Utilities",
  "Media",
  "Robotics",
  "Payments",
  "Labs",
  "Industrial",
  "Networks",
  "Grid",
  "Textiles",
  "Aerospace",
  "Credit Union",
];

const usedNames = new Set<string>();
function companyName(): string {
  for (let i = 0; i < 40; i++) {
    const n = `${pick(PREFIX)} ${pick(SUFFIX)}`;
    if (!usedNames.has(n)) {
      usedNames.add(n);
      return n;
    }
  }
  const n = `${pick(PREFIX)} ${pick(SUFFIX)} ${usedNames.size}`;
  usedNames.add(n);
  return n;
}

/* ------------------------------------------------------------ people
 * Contact names are synthetic: invented given names crossed with the same kind
 * of invented surname stock used for companies, drawn from the shared seeded
 * RNG so SSR and hydration produce identical people. No real person is used.
 * ------------------------------------------------------------------------ */

const GIVEN = [
  "Marta","Devon","Priya","Callum","Ines","Tobias","Rhian","Amara","Soren","Nadia",
  "Elias","Juno","Kwame","Lena","Otto","Sabine","Hollis","Yuki","Ravi","Freya",
  "Bram","Neve","Cato","Imani","Linus","Thea","Anouk","Rafe","Suri","Milo",
  "Esme","Jonas","Bel","Kiran","Rosalind","Tarek","Wren","Ivo","Saoirse","Hugo",
];

const FAMILY = [
  "Ashcombe","Verity","Lindquist","Osei","Marchetti","Pell","Ravensworth","Nkemdi",
  "Sallow","Brackett","Ostrowski","Fairhurst","Duval","Halloran","Ivarsen","Quintero",
  "Waverley","Bosman","Tamblyn","Achebe","Renshaw","Kolar","Mendoza","Fenwick",
  "Strand","Okonkwo","Delacroix","Hartwell","Nyberg","Prentice","Vasquez","Wilding",
];

function contactName(): string {
  return `${pick(GIVEN)} ${pick(FAMILY)}`;
}

/**
 * Title stock per seniority bucket. Enterprise leads skew senior and toward
 * platform/procurement functions; growth leads skew to practitioners and
 * founders, which is where "wrong role or seniority" disqualifications live.
 */
const TITLES: Record<Seniority, string[]> = {
  "c-level": ["CTO", "CIO", "COO", "Chief Data Officer", "VP & Head of Engineering"],
  vp: ["VP Engineering", "VP Revenue Operations", "VP Data & Analytics", "VP IT"],
  director: [
    "Director of Platform",
    "Director of Analytics",
    "Director of Sales Operations",
    "Head of Infrastructure",
  ],
  manager: [
    "Engineering Manager",
    "Analytics Manager",
    "IT Manager",
    "Procurement Manager",
    "Founder",
  ],
  practitioner: [
    "Data Engineer",
    "Software Engineer",
    "Business Analyst",
    "Solutions Architect",
    "Student",
  ],
  unknown: ["Not provided"],
};

const SENIORITY_MIX: Record<Segment, Record<Seniority, number>> = {
  enterprise: {
    "c-level": 14,
    vp: 26,
    director: 30,
    manager: 18,
    practitioner: 9,
    unknown: 3,
  },
  "mid-market": {
    "c-level": 8,
    vp: 18,
    director: 26,
    manager: 28,
    practitioner: 16,
    unknown: 4,
  },
  growth: {
    "c-level": 5,
    vp: 8,
    director: 14,
    manager: 30,
    practitioner: 36,
    unknown: 7,
  },
};

/**
 * Reason mix per stage — the pools come from `DISQUAL_BY_STAGE`, weighted so
 * the earliest stage skews to fit/junk problems and later stages to budget,
 * timing and competitive losses.
 */
const DISQUAL_MIX: Record<string, Record<string, number>> = {
  created: {
    not_icp: 26,
    wrong_persona: 20,
    junk: 16,
    support_request: 14,
    no_budget: 12,
    unresponsive: 12,
  },
  qualified: { unresponsive: 40, timing: 18, no_budget: 16, wrong_persona: 14, competitor: 12 },
  meeting: { no_budget: 24, timing: 24, competitor: 22, unresponsive: 18, not_icp: 12 },
  sqo: { competitor: 30, timing: 26, no_budget: 24, unresponsive: 20 },
};

/** Furthest lead stage a lead actually reached — where any drop would land. */
function furthestLeadStageKey(l: Lead): string {
  if (l.sqoWeek !== null) return "sqo";
  if (l.meetingWeek !== null) return "meeting";
  if (l.qualifiedWeek !== null) return "qualified";
  return "created";
}

/**
 * MAX_LEAD_STALE_WEEKS is the largest `staleWeeks` in the `LEAD_STAGES` config.
 * A lead whose last milestone is younger than that may still be pending, and
 * pending records must never carry a reason, so no reason is authored for them.
 * A drop inside that window simply has no reason recorded yet, which the engine
 * pools honestly rather than inventing one.
 */
const MAX_LEAD_STALE_WEEKS = 6;

function authorDisqualReason(l: Lead): DisqualReason | null {
  const stage = furthestLeadStageKey(l);
  const entered =
    stage === "sqo"
      ? l.sqoWeek!
      : stage === "meeting"
        ? l.meetingWeek!
        : stage === "qualified"
          ? l.qualifiedWeek!
          : l.createdWeek;
  if (CURRENT_WEEK - entered <= MAX_LEAD_STALE_WEEKS) return null;
  // A share of real drops genuinely never get a reason written down.
  if (rand() < 0.08) return null;
  const category = weighted(DISQUAL_MIX[stage]) as DisqualCategory;
  return { category, detail: pick(DISQUAL_DETAILS[category]) };
}

/** Source quality: qualify / meeting / sqo pass-through, and later close rate. */
const SOURCE_QUALITY: Record<Source, { q: number; m: number; s: number; win: number }> = {
  referral: { q: 0.7, m: 0.8, s: 0.82, win: 0.58 },
  partner: { q: 0.58, m: 0.7, s: 0.72, win: 0.46 },
  events: { q: 0.5, m: 0.62, s: 0.66, win: 0.36 },
  outbound: { q: 0.44, m: 0.56, s: 0.6, win: 0.3 },
  organic: { q: 0.47, m: 0.6, s: 0.63, win: 0.34 },
  paid: { q: 0.36, m: 0.5, s: 0.54, win: 0.2 },
};

const SOURCE_VOLUME: Record<Source, number> = {
  paid: 30,
  organic: 22,
  outbound: 18,
  events: 14,
  partner: 9,
  referral: 7,
};

const SEGMENT_VOLUME: Record<Segment, number> = {
  growth: 44,
  "mid-market": 36,
  enterprise: 20,
};

const REGIONS: Region[] = ["north-america", "emea", "apac", "latam"];

/** Enterprise moves slower at every step. */
const SEGMENT_PACE: Record<Segment, number> = {
  enterprise: 1.6,
  "mid-market": 1.15,
  growth: 1,
};

function gap(base: number, segment: Segment): number {
  const g = Math.round((base + rand() * base) * SEGMENT_PACE[segment]);
  return Math.max(1, g);
}

/**
 * Lead creation is skewed toward earlier weeks: a real 26-week window contains
 * more fully-resolved old cohorts than fresh ones, while recent weeks still
 * hold a healthy share of pending records at every stage.
 */
function skewedCreatedWeek(): number {
  return Math.floor(Math.pow(rand(), 1.35) * (CURRENT_WEEK + 0.999));
}

const LEADS: Lead[] = [];
const DEALS: Deal[] = [];

const LEAD_TOTAL = 700;

for (let i = 0; i < LEAD_TOTAL; i++) {
  const source = weighted(SOURCE_VOLUME);
  const segment = weighted(SEGMENT_VOLUME);
  const createdWeek = skewedCreatedWeek();
  const q = SOURCE_QUALITY[source];
  const name = companyName();

  const seniority = weighted(SENIORITY_MIX[segment]) as Seniority;

  const lead: Lead = {
    id: `L-${String(i + 1).padStart(4, "0")}`,
    contactName: contactName(),
    contactTitle: pick(TITLES[seniority]),
    seniority,
    companyName: name,
    createdWeek,
    source,
    segment,
    region: pick(REGIONS),
    qualifiedWeek: null,
    meetingWeek: null,
    sqoWeek: null,
    disqualReason: null,
  };

  // Each step is attempted; a step that lands beyond CURRENT_WEEK is simply
  // "not there yet" — which is exactly how real pending records look.
  if (rand() < q.q) {
    const w = createdWeek + gap(1, segment);
    if (w <= CURRENT_WEEK) lead.qualifiedWeek = w;
  }
  if (lead.qualifiedWeek !== null && rand() < q.m) {
    const w = lead.qualifiedWeek + gap(1, segment);
    if (w <= CURRENT_WEEK) lead.meetingWeek = w;
  }
  if (lead.meetingWeek !== null && rand() < q.s) {
    const w = lead.meetingWeek + gap(1, segment);
    if (w <= CURRENT_WEEK) lead.sqoWeek = w;
  }

  // Reason is authored only where the lead stopped, after the milestones are
  // known. It explains a drop; it never creates one.
  lead.disqualReason = authorDisqualReason(lead);

  LEADS.push(lead);
}

const ARR_BASE: Record<Segment, [number, number]> = {
  enterprise: [120000, 420000],
  "mid-market": [42000, 130000],
  growth: [12000, 46000],
};

/** Loss-reason mix by segment — compliance/product heavier upmarket. */
const LOSS_MIX: Record<Segment, Record<LossCategory, number>> = {
  enterprise: {
    compliance_gap: 26,
    product_gap: 24,
    competitor: 18,
    pricing: 12,
    timing: 12,
    no_decision: 8,
  },
  "mid-market": {
    product_gap: 22,
    competitor: 21,
    pricing: 20,
    no_decision: 15,
    timing: 12,
    compliance_gap: 10,
  },
  growth: {
    pricing: 30,
    no_decision: 27,
    competitor: 16,
    timing: 13,
    product_gap: 11,
    compliance_gap: 3,
  },
};

function makeDeal(
  index: number,
  base: {
    leadId: string | null;
    companyName: string;
    source: Source;
    segment: Segment;
    region: Region;
    createdWeek: number;
  },
): Deal {
  const { segment, source } = base;
  const [lo, hi] = ARR_BASE[segment];
  const arr = Math.round((lo + rand() * (hi - lo)) / 1000) * 1000;

  const deal: Deal = {
    id: `D-${String(index + 1).padStart(4, "0")}`,
    ...base,
    arr,
    discoveryWeek: null,
    evaluationWeek: null,
    proposalWeek: null,
    negotiationWeek: null,
    status: "open",
    closedWeek: null,
    currentStage: "created",
    lossReason: null,
  };

  const q = SOURCE_QUALITY[source];
  const stagePass = [0.9, 0.84, 0.82, 0.86];
  const keys = ["discoveryWeek", "evaluationWeek", "proposalWeek", "negotiationWeek"] as const;
  const stageNames = ["discovery", "evaluation", "proposal", "negotiation"] as const;

  let prev = base.createdWeek;
  let reached = -1;
  for (let s = 0; s < keys.length; s++) {
    if (rand() >= stagePass[s]) break;
    const w = prev + gap(1, segment);
    if (w > CURRENT_WEEK) break;
    deal[keys[s]] = w;
    prev = w;
    reached = s;
  }
  deal.currentStage = reached < 0 ? "created" : stageNames[reached];

  // Early losses: a deal can die in discovery or evaluation too, and carries a
  // structured loss reason just like a late-stage loss.
  const stalledEarly =
    deal.negotiationWeek === null && deal.proposalWeek === null && rand() < 0.55;
  if (stalledEarly) {
    const closedWeek = prev + gap(1, segment);
    if (closedWeek <= CURRENT_WEEK) {
      const category = weighted(LOSS_MIX[segment]);
      deal.status = "lost";
      deal.closedWeek = closedWeek;
      deal.lossReason = { category, detail: pick(LOSS_DETAILS[category]) };
      return deal;
    }
  }

  // Only deals that got to negotiation (or occasionally proposal) can close.
  const closable = deal.negotiationWeek !== null || (deal.proposalWeek !== null && rand() < 0.45);
  if (closable) {
    const closedWeek = prev + gap(1, segment);
    if (closedWeek <= CURRENT_WEEK) {
      const won = rand() < q.win;
      deal.status = won ? "won" : "lost";
      deal.closedWeek = closedWeek;
      deal.currentStage = null;
      if (!won) {
        const category = weighted(LOSS_MIX[segment]);
        deal.lossReason = { category, detail: pick(LOSS_DETAILS[category]) };
      }
    }
  }

  return deal;
}

const sqoLeads = LEADS.filter((l) => l.sqoWeek !== null);
let dealIndex = 0;
for (const lead of sqoLeads) {
  // Not every SQO becomes an opportunity record.
  if (rand() > 0.94) continue;
  DEALS.push(
    makeDeal(dealIndex++, {
      leadId: lead.id,
      companyName: lead.companyName,
      source: lead.source,
      segment: lead.segment,
      region: lead.region,
      createdWeek: lead.sqoWeek! + (rand() < 0.6 ? 0 : 1),
    }),
  );
}

// A handful of outbound-sourced deals with no lead lineage (imported / ABM).
for (let i = 0; i < 9; i++) {
  DEALS.push(
    makeDeal(dealIndex++, {
      leadId: null,
      companyName: companyName(),
      source: "outbound",
      segment: weighted({ enterprise: 45, "mid-market": 40, growth: 15 }),
      region: pick(REGIONS),
      createdWeek: intBetween(0, CURRENT_WEEK - 2),
    }),
  );
}

// An SQO that opened a deal ADVANCED out of the lead funnel, so it must not
// carry a disqualification reason. The linkage is only known once deals exist.
const leadsWithDeal = new Set(DEALS.map((d) => d.leadId).filter(Boolean) as string[]);
for (const l of LEADS) if (leadsWithDeal.has(l.id)) l.disqualReason = null;

export { LEADS, DEALS };

/* ------------------------------------------------------------------ labels */

export function weekLabel(week: number): string {
  const start = new Date(`${WINDOW_START_ISO}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + week * 7);
  return start.toISOString().slice(0, 10);
}

export function weekShortLabel(week: number): string {
  const iso = weekLabel(week);
  const [, m, d] = iso.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}
