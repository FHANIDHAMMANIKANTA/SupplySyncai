import { runAgent } from "./agents.functions";
import type { AgentId } from "./agents.server";
import {
  ALT_SUPPLIERS,
  BASE_CHIP_COST,
  CHIPS_REQUIRED,
  MODELS,
  PLANTS,
  SUPPLIERS,
  TOTAL_PLAN,
  fmtINR,
  fmtN,
  fmtP,
  type Params,
  type SimResult,
} from "./model";
import type { AgentRunState } from "./store";

export function buildAgentPayload(agent: AgentId, params: Params, sim: SimResult) {
  if (agent === "risk") {
    return {
      suppliers: SUPPLIERS,
      plants: PLANTS,
      chipSupplyPct: params.supplyPct,
      delayWeeks: params.delayWeeks,
      chipsRequired: CHIPS_REQUIRED,
      chipsAvailable: sim.base,
      shortfall: sim.gap,
    };
  }
  if (agent === "supplier") {
    const A = sim.scenarios.find((s) => s.key === "A")!;
    return {
      shortfallChips: sim.gap,
      baseChipCost: BASE_CHIP_COST,
      delayWeeks: params.delayWeeks,
      allowUnapproved: params.useUnapproved,
      alternatives: ALT_SUPPLIERS,
      scenarioA: {
        chipsBought: A.chips - sim.base,
        extraCost: A.extraCost,
        plan: A.actions,
        feasibility: A.feasibility,
      },
    };
  }
  return {
    plannedCars: TOTAL_PLAN,
    chipSupplyPct: params.supplyPct,
    delayWeeks: params.delayWeeks,
    shortfallChips: sim.gap,
    scenarios: sim.scenarios.map(({ perModel, ...r }) => ({ ...r, perModel })),
    engineRecommendation: sim.best.key,
  };
}

export function buildUpstreamContext(
  agent: AgentId,
  runs: Partial<Record<AgentId, AgentRunState>>,
): string | undefined {
  if (agent === "risk") return undefined;

  const sections: string[] = [];
  if (runs.risk?.status === "done" && runs.risk.text && !runs.risk.stale) {
    sections.push(`=== Agent 1 (Supply Risk Detection) Findings ===\n${runs.risk.text}`);
  }
  if (agent === "sop" && runs.supplier?.status === "done" && runs.supplier.text && !runs.supplier.stale) {
    sections.push(`=== Agent 2 (Alternative Supplier Intelligence) Plan ===\n${runs.supplier.text}`);
  }
  return sections.length > 0 ? sections.join("\n\n") : undefined;
}

function buildStaticHostBrief(agent: AgentId, params: Params, sim: SimResult): string {
  const kaveri = SUPPLIERS.find((s) => s.id === "kaveri")!;
  const pune = PLANTS.find((p) => p.affected)!;
  const A = sim.scenarios.find((s) => s.key === "A")!;
  const B = sim.scenarios.find((s) => s.key === "B")!;
  const C = sim.scenarios.find((s) => s.key === "C")!;

  if (agent === "risk") {
    const severity = sim.gap > 200000 ? "HIGH / CRITICAL" : sim.gap > 80000 ? "MEDIUM-HIGH" : "MODERATE";
    return [
      "## Risk assessment",
      `- **Severity:** **${severity}** — ${kaveri.name} (${kaveri.location}) committed only **${params.supplyPct}%** supply with a **${params.delayWeeks}-week** delay, creating a net shortfall of **${fmtN(sim.gap)} chips** (${fmtP(sim.gap / CHIPS_REQUIRED)} of ${fmtN(CHIPS_REQUIRED)} need).`,
      `- **Exposed plant:** **${pune.name}** holds ${fmtN(pune.chipStock)} chips (${fmtN(pune.safetyStock)} safety stock; only **${fmtN(sim.usableStock)}** usable).`,
      "- **Tier-2 cascade:** **Nexa Electronics** (risk 47, 86% OTIF) depends on Kaveri MCUs; **Deccan Steel Works** (risk 54) shows 12% lower rake availability.",
      "## Early-warning signals",
      "- Kaveri fab fire took **40%** line capacity offline and ASNs dropped **38% WoW**.",
      "- Pune buffer drops below safety threshold without immediate replenishment or STO.",
      "## Recommended immediate actions",
      "- Trigger Agent 2 alternate sourcing evaluation and verify Chennai/Sanand surplus stock.",
      "- Protect high-margin **Volt EV** (120 chips/car) and **Tora SUV** (64 chips/car) lines in SAP IBP.",
      "",
      "*Static GitHub Pages mode (deterministic engine) — run with the backend server for live SAP Generative AI Hub LLM reasoning.*",
    ].join("\n");
  }

  if (agent === "supplier") {
    const pool = ALT_SUPPLIERS.filter((s) => s.approved || params.useUnapproved).sort((a, b) => a.unitCost - b.unitCost);
    const lines = pool.map(
      (s, idx) =>
        `${idx + 1}. **${s.name}** (${s.location}) — **₹${s.unitCost}/chip** (+₹${s.unitCost - BASE_CHIP_COST}), ${s.leadWeeks} wk lead, ${fmtN(s.capacity)} cap, quality ${s.quality} (${s.approved ? "approved" : "needs qualification"}).`,
    );
    return [
      "## Supplier ranking",
      ...lines,
      "## Procurement plan",
      `- **Scenario A coverage:** Sources **${fmtN(A.chips - sim.base)} chips** against ${fmtN(sim.gap)} shortfall (**${fmtP(A.feasibility)}** plan feasibility) at **${fmtINR(A.extraCost)}** extra cost.`,
      ...A.actions.map((a) => `- ${a}`),
      "## Risks & qualification notes",
      params.useUnapproved
        ? "- Unapproved supplier waiver is **enabled** (Orion Semi, quality 84) — requires expedited QM incoming inspection."
        : "- Only **approved** suppliers are active; 4-week lead times (Pacific Chipworks) limit in-month capacity.",
      "",
      "*Static GitHub Pages mode (deterministic engine) — run with the backend server for live SAP Generative AI Hub LLM reasoning.*",
    ].join("\n");
  }

  const best = sim.best;
  const affected = best.perModel
    .filter((m) => m.units < m.orders)
    .map((m) => `${m.name} (${fmtN(m.units)} built vs ${fmtN(m.orders)} orders)`)
    .join(", ");

  return [
    `## Recommendation`,
    `- **Recommend Scenario ${best.key} (${best.name})** — highest weighted score (**${best.score}/100**), delivering **${fmtN(best.units)} / ${fmtN(TOTAL_PLAN)} cars** (${fmtP(best.feasibility)}).`,
    "## Why",
    `- **Scenario ${best.key}:** ${fmtP(best.feasibility)} feasibility, **${fmtP(best.serviceLevel)}** service level, **${fmtINR(best.extraCost)}** extra cost, **${fmtINR(best.marginLost)}** margin lost.`,
    `- **Scenario A vs B vs C scores:** A = ${A.score}/100 (${fmtINR(A.extraCost)}), B = ${B.score}/100 (${fmtINR(B.extraCost)}), C = ${C.score}/100 (${fmtINR(C.extraCost)}).`,
    "## Affected customers & models",
    `- ${affected || "All customer orders fulfilled under this scenario."}`,
    "## Approval note for the supply-chain manager",
    `Human judgment required before posting SAP S/4HANA commitments: confirm whether donor-plant safety buffers (Chennai/Sanand) or dealer delivery delays on entry models align with this month's commercial priorities.`,
    "",
    "*Static GitHub Pages mode (deterministic engine) — run with the backend server for live SAP Generative AI Hub LLM reasoning.*",
  ].join("\n");
}

function isStaticHostingEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith("github.io");
}

export async function executeAgentRun(
  agent: AgentId,
  params: Params,
  sim: SimResult,
  upstreamContext?: string,
): Promise<AgentRunState> {
  const started = performance.now();
  const payload = buildAgentPayload(agent, params, sim);

  if (isStaticHostingEnvironment()) {
    return {
      status: "done",
      text: buildStaticHostBrief(agent, params, sim),
      at: new Date().toLocaleTimeString(),
      providerLabel: "SAP BTP Deterministic Engine (Static Host)",
      durationMs: Math.max(100, Math.round(performance.now() - started)),
      usedUpstream: Boolean(upstreamContext),
      stale: false,
    };
  }

  try {
    const r = await runAgent({
      data: {
        agent,
        context: JSON.stringify(payload),
        upstreamContext,
      },
    });
    if (r.ok) {
      return {
        status: "done",
        text: r.text,
        at: new Date().toLocaleTimeString(),
        providerLabel: r.providerLabel,
        durationMs: Math.round(performance.now() - started),
        usedUpstream: Boolean(upstreamContext),
        stale: false,
      };
    }
    return { status: "error", error: r.error };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      error: `Could not reach backend AI server (${msg.slice(0, 80)}). Ensure npm run dev is running with .env configured.`,
    };
  }
}
