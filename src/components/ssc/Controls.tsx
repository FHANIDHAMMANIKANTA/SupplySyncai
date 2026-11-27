import { useSim } from "@/lib/ssc/store";
import { Card } from "./ui";

export function DisruptionControls() {
  const { params, setParams } = useSim();
  return (
    <Card title="Disruption scenario inputs">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="flex justify-between"><span>Chip supply delivered</span><span className="num font-semibold">{params.supplyPct}%</span></span>
          <input type="range" min={20} max={100} step={5} value={params.supplyPct} onChange={(e) => setParams({ ...params, supplyPct: +e.target.value })} className="mt-2 w-full accent-primary" />
        </label>
        <label className="block text-sm">
          <span className="flex justify-between"><span>Supplier delay</span><span className="num font-semibold">{params.delayWeeks} weeks</span></span>
          <input type="range" min={0} max={8} value={params.delayWeeks} onChange={(e) => setParams({ ...params, delayWeeks: +e.target.value })} className="mt-2 w-full accent-primary" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={params.useUnapproved} onChange={(e) => setParams({ ...params, useUnapproved: e.target.checked })} className="size-4 accent-primary" />
          Allow not-yet-approved suppliers
        </label>
      </div>
    </Card>
  );
}
