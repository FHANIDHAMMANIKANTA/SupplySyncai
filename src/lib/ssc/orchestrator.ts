import {
  ALT_SUPPLIERS,
  BASE_CHIP_COST,
  CHIPS_REQUIRED,
  PLANTS,
  SUPPLIERS,
  TOTAL_PLAN,
  type Params,
  type SimResult,
} from "./model";
import type { AgentId } from "./agents.server";
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
