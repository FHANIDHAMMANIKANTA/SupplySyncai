import { createFileRoute } from "@tanstack/react-router";
import { DisruptionControls } from "@/components/ssc/Controls";
import { MultiAgentOrchestrator, ScenarioPresetBar } from "@/components/ssc/BtpComponents";
import { Kpi, PageHead } from "@/components/ssc/ui";
import { useSim } from "@/lib/ssc/store";
import { CHIPS_REQUIRED, TOTAL_PLAN, fmtINR, fmtN, fmtP } from "@/lib/ssc/model";

export const Route = createFileRoute("/orchestrator")({
  head: () => ({
    meta: [
      { title: "Multi-Agent Orchestrator — SupplySync AI" },
      {
        name: "description",
        content: "Run Agents 1, 2, and 3 together in an end-to-end SAP BTP S&OP workflow with human-in-the-loop approval.",
      },
    ],
  }),
  component: OrchestratorPage,
});

function OrchestratorPage() {
  const { sim, params } = useSim();
  return (
    <div className="space-y-4">
      <PageHead
        eyebrow="SAP Generative AI Hub · End-to-End Orchestrator"
        title="Collaborative 3-Agent S&OP Pipeline"
      >
        Run Agent 1 (Risk Detection), Agent 2 (Alternative Suppliers), and Agent 3 (S&amp;OP Optimization) sequentially with shared upstream context, or execute each step individually before applying human manager judgment.
      </PageHead>

      <ScenarioPresetBar />
      <DisruptionControls />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Chip supply committed" value={`${params.supplyPct}%`} sub={`${params.delayWeeks}-week delay`} tone="warn" />
        <Kpi label="Net shortfall" value={fmtN(sim.gap)} sub={`of ${fmtN(CHIPS_REQUIRED)} needed`} tone="bad" />
        <Kpi label="Best engine option" value={`Scenario ${sim.best.key}`} sub={`${fmtP(sim.best.feasibility)} of ${fmtN(TOTAL_PLAN)} cars`} tone="good" />
        <Kpi label="Extra cost (best)" value={fmtINR(sim.best.extraCost)} sub={`Score ${sim.best.score}/100`} />
      </div>

      <MultiAgentOrchestrator />
    </div>
  );
}
