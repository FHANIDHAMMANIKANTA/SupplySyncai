import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { DisruptionControls } from "@/components/ssc/Controls";
import { Bar, Card, Chip, Kpi, PageHead } from "@/components/ssc/ui";
import { useSim } from "@/lib/ssc/store";
import { CHIPS_REQUIRED, MODELS, PLANTS, SUPPLIERS, TOTAL_PLAN, fmtINR, fmtN, fmtP } from "@/lib/ssc/model";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "S&OP Dashboard — SupplySync AI" },
      { name: "description", content: "Plan vs. supply cockpit: chip shortfall, plant inventory, supplier status and scenario A/B/C comparison." },
      { property: "og:title", content: "S&OP Dashboard — SupplySync AI" },
      { property: "og:description", content: "Compare disruption responses on feasibility, cost, service level and inventory." },
    ],
  }),
  component: Dashboard,
});

const toneOf = (s: string) => (s === "disrupted" ? "bad" : s === "watch" ? "warn" : "good") as "bad" | "warn" | "good";

function Dashboard() {
  const { sim, approved, setApproved } = useSim();
  const maxCost = Math.max(...sim.scenarios.map((s) => s.extraCost), 1);
  return (
    <div className="space-y-4">
      <PageHead eyebrow="S&OP Cockpit · Pune plant · next month" title="Supply disruption dashboard">
        Semiconductor supply disruption at Kaveri Semicon. Adjust the inputs — every figure and scenario recalculates instantly.
      </PageHead>
      <DisruptionControls />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Planned production" value={fmtN(TOTAL_PLAN)} sub="cars this month" />
        <Kpi label="Chips required" value={fmtN(CHIPS_REQUIRED)} sub="for the full plan" />
        <Kpi label="Chips available" value={fmtN(sim.base)} sub={`${fmtN(sim.delivered)} delivered + ${fmtN(sim.usableStock)} stock`} tone="warn" />
        <Kpi label="Shortfall" value={fmtN(sim.gap)} sub={`${fmtP(sim.gap / CHIPS_REQUIRED)} of need`} tone="bad" />
        <Kpi label="Cars at risk (no action)" value={fmtN(TOTAL_PLAN - (sim.scenarios.find((s) => s.key === "C")?.units ?? 0))} sub="if nothing changes" tone="bad" />
      </div>

      <Card title="Scenario comparison" action={<Chip tone="good">Recommended: Scenario {sim.best.key}</Chip>}>
        <div className="grid gap-3 lg:grid-cols-3">
          {sim.scenarios.map((s) => {
            const best = s.key === sim.best.key;
            return (
              <div key={s.key} className={`rounded-xl border p-4 ${best ? "border-primary" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-display text-sm font-semibold">Scenario {s.key} · {s.name}</p>
                  <span className="num text-lg font-semibold">{s.score}</span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">{s.summary}</p>
                <dl className="mt-3 space-y-2 text-[12px]">
                  {[
                    ["Production feasibility", fmtP(s.feasibility), <Bar key="a" value={s.feasibility} max={1} tone="good" />],
                    ["Customer service level", fmtP(s.serviceLevel), <Bar key="b" value={s.serviceLevel} max={1} />],
                    ["Additional cost", fmtINR(s.extraCost), <Bar key="c" value={s.extraCost} max={maxCost} tone="bad" />],
                    ["Network chip cover", `${s.inventoryDays.toFixed(1)} days`, <Bar key="d" value={s.inventoryDays} max={30} tone="warn" />],
                  ].map(([k, v, bar]) => (
                    <div key={k as string}>
                      <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="num font-medium">{v}</dd></div>
                      <div className="mt-1">{bar}</div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1"><dt className="text-muted-foreground">Cars produced</dt><dd className="num font-medium">{fmtN(s.units)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Margin lost vs plan</dt><dd className="num font-medium text-lost">{fmtINR(s.marginLost)}</dd></div>
                </dl>
                <button
                  onClick={() => setApproved(approved === s.key ? null : s.key)}
                  className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium ${approved === s.key ? "bg-advanced text-primary-foreground" : best ? "bg-primary text-primary-foreground" : "border border-border"}`}
                >
                  {approved === s.key ? <><CheckCircle2 className="size-3.5" /> Approved</> : "Approve scenario"}
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Production by model — Scenario ${sim.best.key}`}>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-muted-foreground"><th className="pb-2 font-medium">Model</th><th className="pb-2 text-right font-medium">Plan</th><th className="pb-2 text-right font-medium">Orders</th>{sim.scenarios.map((s) => <th key={s.key} className="pb-2 text-right font-medium">{s.key}</th>)}</tr></thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="py-2">{m.name}<div className="text-[11px] text-muted-foreground">{m.chips} chips/car</div></td>
                  <td className="num text-right">{fmtN(m.plan)}</td>
                  <td className="num text-right">{fmtN(m.orders)}</td>
                  {sim.scenarios.map((s) => { const u = s.perModel.find((x) => x.id === m.id)!.units; return <td key={s.key} className={`num text-right ${u < m.orders ? "text-lost" : ""}`}>{fmtN(u)}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">Red = fewer cars than customer orders (affected customers).</p>
        </Card>
        <Card title="Plant chip inventory">
          <div className="space-y-3">
            {PLANTS.map((p) => (
              <div key={p.id}>
                <div className="flex justify-between text-[13px]"><span>{p.name} {p.affected && <Chip tone="bad">affected</Chip>}</span><span className="num">{fmtN(p.chipStock)}</span></div>
                <div className="mt-1"><Bar value={p.chipStock} max={180000} tone={p.affected ? "bad" : "primary"} /></div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Safety stock {fmtN(p.safetyStock)} · transferable {fmtN(p.chipStock - p.safetyStock)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Tier-1 supplier status">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead><tr className="text-left text-muted-foreground"><th className="pb-2 font-medium">Supplier</th><th className="pb-2 font-medium">Component</th><th className="pb-2 font-medium">Location</th><th className="pb-2 text-right font-medium">Share</th><th className="pb-2 text-right font-medium">Risk</th><th className="pb-2 font-medium pl-4">Status</th></tr></thead>
            <tbody>
              {SUPPLIERS.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 font-medium">{s.name}</td><td>{s.component}</td><td className="text-muted-foreground">{s.location}</td>
                  <td className="num text-right">{s.share}%</td><td className="num text-right">{s.risk}</td>
                  <td className="pl-4"><Chip tone={toneOf(s.status)}>{s.status}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
