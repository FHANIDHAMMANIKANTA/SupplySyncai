import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MetricExplainer } from "@/lib/rf/engine";

export function Explainer({ title, items }: { title: string; items: MetricExplainer[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How ${title} is computed`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[22rem] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-3.5 py-2.5">
          <p className="eyebrow">How this is computed</p>
          <p className="text-sm font-medium">{title}</p>
        </div>
        <dl className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.metric} className="px-3.5 py-2">
              <dt className="text-xs font-medium">{item.metric}</dt>
              <dd className="mt-0.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {item.computedFrom}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
