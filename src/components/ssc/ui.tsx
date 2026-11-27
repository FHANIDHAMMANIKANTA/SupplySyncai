import type { ReactNode } from "react";
import { Bot, Link2, Loader2, Sparkles } from "lucide-react";
import { runAgent } from "@/lib/ssc/agents.functions";
import type { AgentId } from "@/lib/ssc/agents.server";
import { buildUpstreamContext } from "@/lib/ssc/orchestrator";
import { useSim } from "@/lib/ssc/store";

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-4 shadow-panel ${className}`}>
      {title && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" }) {
  const c = tone === "good" ? "text-advanced" : tone === "bad" ? "text-lost" : tone === "warn" ? "text-pending" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-panel">
      <p className="eyebrow">{label}</p>
      <p className={`num mt-2 text-2xl font-semibold ${c}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Chip({ tone = "neutral", children }: { tone?: "good" | "bad" | "warn" | "neutral" | "primary"; children: ReactNode }) {
  const c = {
    good: "bg-advanced-soft text-advanced",
    bad: "bg-lost-soft text-lost",
    warn: "bg-pending-soft text-pending",
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary text-primary-foreground",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>;
}

export function Bar({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "good" | "bad" | "warn" }) {
  const c = { primary: "bg-primary", good: "bg-advanced", bad: "bg-lost", warn: "bg-pending" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${c} transition-all`} style={{ width: `${Math.max(0, Math.min(100, (value / (max || 1)) * 100))}%` }} />
    </div>
  );
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split("\n").map((l, i) => {
        const t = l.trim();
        if (!t) return null;
        if (t.startsWith("#")) return <h3 key={i} className="pt-2 font-display text-sm font-semibold">{t.replace(/^#+\s*/, "")}</h3>;
        if (/^[-*]\s/.test(t)) return <p key={i} className="pl-4 -indent-3">• {inline(t.slice(2))}</p>;
        if (/^\d+\.\s/.test(t)) return <p key={i} className="pl-4 -indent-3">{inline(t)}</p>;
        return <p key={i}>{inline(t)}</p>;
      })}
    </div>
  );
}

export function AgentPanel({ agent, name, context }: { agent: AgentId; name: string; context: unknown }) {
  const { agentRuns, setAgentRun } = useSim();
  const state = agentRuns[agent];
  const upstreamPreview = buildUpstreamContext(agent, agentRuns);

  const run = async () => {
    const started = performance.now();
    setAgentRun(agent, { status: "running" });
    try {
      const r = await runAgent({
        data: {
          agent,
          context: JSON.stringify(context),
          upstreamContext: upstreamPreview,
        },
      });
      if (r.ok) {
        setAgentRun(agent, {
          status: "done",
          text: r.text,
          at: new Date().toLocaleTimeString(),
          providerLabel: r.providerLabel,
          durationMs: Math.round(performance.now() - started),
          usedUpstream: Boolean(upstreamPreview),
          stale: false,
        });
      } else {
        setAgentRun(agent, { status: "error", error: r.error });
      }
    } catch {
      setAgentRun(agent, { status: "error", error: "Could not reach the agent. Check your connection and try again." });
    }
  };

  return (
    <Card
      title={`${name} — AI analysis`}
      action={
        <button
          onClick={run}
          disabled={state.status === "running"}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground disabled:opacity-60"
        >
          {state.status === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {state.status === "done" ? "Re-run agent" : state.status === "running" ? "Analysing…" : "Run agent"}
        </button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip tone={state.status === "running" ? "warn" : state.status === "done" ? (state.stale ? "warn" : "good") : state.status === "error" ? "bad" : "neutral"}>
          <Bot className="size-3" />
          {state.status === "running"
            ? "Running"
            : state.status === "done"
              ? state.stale
                ? `Completed ${state.at} (inputs changed)`
                : `Completed ${state.at}`
              : state.status === "error"
                ? "Failed"
                : "Ready"}
        </Chip>
        <Chip>{state.providerLabel ?? "SAP Generative AI Hub"}</Chip>
        <Chip>Live scenario data</Chip>
        {(state.usedUpstream || upstreamPreview) && (
          <Chip tone="primary">
            <Link2 className="size-3" /> Linked with upstream brief
          </Chip>
        )}
      </div>
      {state.status === "idle" && (
        <p className="text-sm text-muted-foreground">
          Run this agent individually, or run all 3 agents together from the SAP BTP Orchestrator.
        </p>
      )}
      {state.status === "running" && (
        <div className="space-y-2">
          {[80, 95, 60, 70].map((w) => (
            <div key={w} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
      {state.status === "error" && <p className="text-sm text-lost">{state.error}</p>}
      {state.status === "done" && state.text && <Markdown text={state.text} />}
    </Card>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}
