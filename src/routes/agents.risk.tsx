import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { DisruptionControls } from "@/components/ssc/Controls";
import { AgentPanel, Bar, Card, Chip, Kpi, PageHead } from "@/components/ssc/ui";
import { useSim } from "@/lib/ssc/store";
import { CHIPS_REQUIRED, PLANTS, SUPPLIERS, fmtN, fmtP } from "@/lib/ssc/model";

export const Route = createFileRoute("/agents/risk")({
  head: () => ({
    meta: [
      { title: "Agent 1 · Supply Risk Detection — SupplySync AI" },
      { name: "description", content: "AI agent that monitors supplier signals and detects disruptions to components like chips, steel and batteries." },
      { property: "og:title", content: "Supply Risk Detection Agent — SupplySync AI" },
      { property: "og:description", content: "Detect supplier disruptions early and see which plants and models are exposed." },
    ],
  }),
  component: RiskAgent,
});

function RiskAgent() {
  const { sim, params } = useSim();
  const sorted = [...SUPPLIERS].sort((a, b) => b.risk - a.risk);
  return (
    <div className="space-y-4">
      <PageHead eyebrow="Agent 1" title="Supply Risk Detection">Scans supplier signals — shipping notices, allocation letters, news, OTIF — and scores disruption risk per supplier.</PageHead>
      <DisruptionControls />
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Suppliers at risk" value={`${SUPPLIERS.filter((s) => s.status !== "stable").length} / ${SUPPLIERS.length}`} tone="warn" />
        <Kpi label="Chip supply committed" value={`${params.supplyPct}%`} sub={`${params.delayWeeks}-week delay`} tone="bad" />
        <Kpi label="Shortfall exposure" value={fmtN(sim.gap)} sub={`${fmtP(sim.gap / CHIPS_REQUIRED)} of chip need`} tone="bad" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Supplier risk scores">
          <div className="space-y-4">
            {sorted.map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium">{s.name} <span className="text-muted-foreground">· {s.component}</span></span>
                  <Chip tone={s.risk > 70 ? "bad" : s.risk > 40 ? "warn" : "good"}>{s.risk}</Chip>
                </div>
                <div className="mt-1"><Bar value={s.risk} max={100} tone={s.risk > 70 ? "bad" : s.risk > 40 ? "warn" : "good"} /></div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  {s.signals.map((g) => <li key={g} className="flex gap-1"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{g}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Card>
        <AgentPanel agent="risk" name="Supply Risk Detection" context={{ suppliers: SUPPLIERS, plants: PLANTS, chipSupplyPct: params.supplyPct, delayWeeks: params.delayWeeks, chipsRequired: CHIPS_REQUIRED, chipsAvailable: sim.base, shortfall: sim.gap }} />
      </div>
    </div>
  );
}
