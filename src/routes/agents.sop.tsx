import { createFileRoute, Link } from "@tanstack/react-router";
import { DisruptionControls } from "@/components/ssc/Controls";
import { AgentPanel, Bar, Card, Chip, PageHead } from "@/components/ssc/ui";
import { useSim } from "@/lib/ssc/store";
import { TOTAL_PLAN, fmtINR, fmtN, fmtP } from "@/lib/ssc/model";

export const Route = createFileRoute("/agents/sop")({
  head: () => ({
    meta: [
      { title: "Agent 3 · S&OP Optimization — SupplySync AI" },
      { name: "description", content: "AI decision support comparing alternative sourcing, inventory redistribution and production prioritisation." },
      { property: "og:title", content: "S&OP Optimization & Decision Support Agent — SupplySync AI" },
      { property: "og:description", content: "Get a recommended response to a supplier disruption, ready for manager approval." },
    ],
  }),
  component: SopAgent,
});

function SopAgent() {
  const { sim, params, approved } = useSim();
  const ranked = [...sim.scenarios].sort((a, b) => b.score - a.score);
  return (
    <div className="space-y-4">
      <PageHead eyebrow="Agent 3" title="S&OP Optimization and Decision Support">Scores scenarios A, B and C on feasibility, cost, service level and inventory, and recommends one for approval.</PageHead>
      <DisruptionControls />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Scenario ranking" action={<Chip tone={approved ? "good" : "warn"}>{approved ? `Scenario ${approved} approved` : "Awaiting manager approval"}</Chip>}>
          <div className="space-y-4">
            {ranked.map((s, i) => (
              <div key={s.key}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium">#{i + 1} Scenario {s.key} · {s.name}</span>
                  <span className="num font-semibold">{s.score}/100</span>
                </div>
                <div className="mt-1"><Bar value={s.score} max={100} tone={i === 0 ? "good" : "primary"} /></div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {fmtN(s.units)} / {fmtN(TOTAL_PLAN)} cars · service {fmtP(s.serviceLevel)} · extra cost {fmtINR(s.extraCost)} · margin lost {fmtINR(s.marginLost)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">Score = 30% feasibility + 25% service level + 15% cost + 15% inventory cover + 15% margin kept.</p>
          <Link to="/dashboard" className="mt-3 inline-flex rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground">Review & approve on dashboard</Link>
        </Card>
        <AgentPanel agent="sop" name="S&OP Optimization" context={{ plannedCars: TOTAL_PLAN, chipSupplyPct: params.supplyPct, delayWeeks: params.delayWeeks, shortfallChips: sim.gap, scenarios: sim.scenarios.map(({ perModel, ...r }) => ({ ...r, perModel })), engineRecommendation: sim.best.key }} />
      </div>
    </div>
  );
}
