import { createFileRoute } from "@tanstack/react-router";
import { DisruptionControls } from "@/components/ssc/Controls";
import { AgentPanel, Card, Chip, Kpi, PageHead } from "@/components/ssc/ui";
import { useSim } from "@/lib/ssc/store";
import { ALT_SUPPLIERS, BASE_CHIP_COST, fmtINR, fmtN } from "@/lib/ssc/model";

export const Route = createFileRoute("/agents/suppliers")({
  head: () => ({
    meta: [
      { title: "Agent 2 · Alternative Supplier Intelligence — SupplySync AI" },
      { name: "description", content: "AI agent comparing alternative chip suppliers on price, lead time, capacity, quality and approval." },
      { property: "og:title", content: "Alternative Supplier Intelligence Agent — SupplySync AI" },
      { property: "og:description", content: "Find approved suppliers, compare delivery timelines and calculate extra procurement cost." },
    ],
  }),
  component: SupplierAgent,
});

function SupplierAgent() {
  const { sim, params } = useSim();
  const A = sim.scenarios.find((s) => s.key === "A")!;
  return (
    <div className="space-y-4">
      <PageHead eyebrow="Agent 2" title="Alternative Supplier Intelligence">Finds approved alternative suppliers, compares prices and delivery timelines, and calculates the extra procurement cost.</PageHead>
      <DisruptionControls />
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Chips to source" value={fmtN(sim.gap)} tone="bad" />
        <Kpi label="Gap covered (Scenario A)" value={fmtN(A.chips - sim.base)} tone="good" />
        <Kpi label="Extra procurement cost" value={fmtINR(A.extraCost)} sub={`vs base ₹${BASE_CHIP_COST}/chip`} />
      </div>
      <Card title="Alternative semiconductor suppliers">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead><tr className="text-left text-muted-foreground"><th className="pb-2 font-medium">Supplier</th><th className="pb-2 font-medium">Location</th><th className="pb-2 text-right font-medium">Capacity</th><th className="pb-2 text-right font-medium">Lead time</th><th className="pb-2 text-right font-medium">Unit cost</th><th className="pb-2 text-right font-medium">Quality</th><th className="pb-2 pl-4 font-medium">Status</th></tr></thead>
            <tbody>
              {ALT_SUPPLIERS.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 font-medium">{s.name}</td><td className="text-muted-foreground">{s.location}</td>
                  <td className="num text-right">{fmtN(s.capacity)}</td><td className="num text-right">{s.leadWeeks} wk</td>
                  <td className="num text-right">₹{s.unitCost} <span className="text-[11px] text-lost">+{s.unitCost - BASE_CHIP_COST}</span></td>
                  <td className="num text-right">{s.quality}</td>
                  <td className="pl-4"><Chip tone={s.approved ? "good" : "warn"}>{s.approved ? "approved" : "needs qualification"}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">{A.actions.map((a) => <li key={a}>• {a}</li>)}</ul>
      </Card>
      <AgentPanel agent="supplier" name="Alternative Supplier Intelligence" context={{ shortfallChips: sim.gap, baseChipCost: BASE_CHIP_COST, delayWeeks: params.delayWeeks, allowUnapproved: params.useUnapproved, alternatives: ALT_SUPPLIERS, scenarioA: { chipsBought: A.chips - sim.base, extraCost: A.extraCost, plan: A.actions, feasibility: A.feasibility } }} />
    </div>
  );
}
