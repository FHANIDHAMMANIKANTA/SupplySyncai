import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  Layers,
  Link2,
  Loader2,
  Network,
  Play,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { AgentId } from "@/lib/ssc/agents.server";
import { getSapExecutionSteps, SAP_BTP_PRESETS } from "@/lib/ssc/btp";
import { buildUpstreamContext, executeAgentRun } from "@/lib/ssc/orchestrator";
import { fmtINR, fmtN, fmtP, type ScenarioKey } from "@/lib/ssc/model";
import { useSim, type AgentRunState } from "@/lib/ssc/store";
import { Card, Chip, Markdown } from "./ui";

export function ScenarioPresetBar() {
  const { params, setParams } = useSim();
  return (
    <Card
      title="SAP BTP Disruption Scenario Presets"
      action={<Chip>Live S/4HANA &amp; IBP Parameters</Chip>}
    >
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {SAP_BTP_PRESETS.map((preset) => {
          const active =
            params.supplyPct === preset.params.supplyPct &&
            params.delayWeeks === preset.params.delayWeeks &&
            params.useUnapproved === preset.params.useUnapproved;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setParams(preset.params)}
              className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-primary">{preset.code}</span>
                  <Chip tone={active ? "primary" : preset.badgeTone}>{active ? "Active" : "Load"}</Chip>
                </div>
                <p className="mt-1.5 font-display text-sm font-semibold">{preset.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{preset.subtitle}</p>
              </div>
              <p className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">{preset.sapTrigger}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

const AGENT_STEPS: Array<{ id: AgentId; step: string; title: string; role: string; route: "/agents/risk" | "/agents/suppliers" | "/agents/sop"; icon: typeof Bot }> = [
  {
    id: "risk",
    step: "Step 1",
    title: "Agent 1 · Supply Risk Detection",
    role: "Analyzes S/4HANA ASN drops, tier-2 dependencies & plant exposure",
    route: "/agents/risk",
    icon: AlertTriangle,
  },
  {
    id: "supplier",
    step: "Step 2",
    title: "Agent 2 · Alternative Supplier Intelligence",
    role: "Consumes Agent 1 risk brief + compares cost, lead time & qualification",
    route: "/agents/suppliers",
    icon: Network,
  },
  {
    id: "sop",
    step: "Step 3",
    title: "Agent 3 · S&OP Optimization & Decision",
    role: "Synthesizes Agents 1 & 2 into Scenarios A/B/C for manager judgment",
    route: "/agents/sop",
    icon: Bot,
  },
];

export function MultiAgentOrchestrator() {
  const { params, sim, agentRuns, setAgentRun, approved, setApproved, approvalNote, setApprovalNote, auditLog } = useSim();
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<AgentId | null>(null);

  const runSingle = async (
    agent: AgentId,
    snapshotRuns: Partial<Record<AgentId, AgentRunState>>,
  ): Promise<AgentRunState> => {
    setActiveStep(agent);
    setAgentRun(agent, { status: "running" });

    const upstreamContext = buildUpstreamContext(agent, snapshotRuns);
    const next = await executeAgentRun(agent, params, sim, upstreamContext);
    setAgentRun(agent, next);
    return next;
  };

  const runAllTogether = async () => {
    setPipelineRunning(true);
    const working: Partial<Record<AgentId, AgentRunState>> = {};

    const r1 = await runSingle("risk", working);
    working.risk = r1;
    if (r1.status !== "done") {
      setActiveStep(null);
      setPipelineRunning(false);
      return;
    }

    const r2 = await runSingle("supplier", working);
    working.supplier = r2;
    if (r2.status !== "done") {
      setActiveStep(null);
      setPipelineRunning(false);
      return;
    }

    await runSingle("sop", working);
    setActiveStep(null);
    setPipelineRunning(false);
  };

  const puneTransfer = Math.min(sim.gap, 165000 - 110000 + (118000 - 85000));
  const sapActions = getSapExecutionSteps(approved, puneTransfer);

  return (
    <div className="space-y-4">
      <Card
        title="SAP BTP Multi-Agent Orchestrator — End-to-End Concert"
        action={
          <button
            type="button"
            onClick={runAllTogether}
            disabled={pipelineRunning}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {pipelineRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {pipelineRunning ? `Running ${activeStep ?? "pipeline"}…` : "Run All 3 Agents Together"}
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Chip tone="primary"><Layers className="size-3" /> Chained Context Handoff</Chip>
          <Chip>Supply {params.supplyPct}% · Delay {params.delayWeeks}w</Chip>
          <Chip tone="bad">Shortfall {fmtN(sim.gap)} chips</Chip>
          <Chip tone="good">Engine Best: Scenario {sim.best.key} ({sim.best.score}/100)</Chip>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {AGENT_STEPS.map((s) => {
            const Icon = s.icon;
            const run = agentRuns[s.id];
            const isWorking = pipelineRunning && activeStep === s.id;
            return (
              <div
                key={s.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                  isWorking ? "border-primary bg-primary/5" : "border-border bg-background/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow">{s.step}</span>
                    <Chip
                      tone={
                        run.status === "running"
                          ? "warn"
                          : run.status === "done"
                            ? run.stale
                              ? "warn"
                              : "good"
                            : run.status === "error"
                              ? "bad"
                              : "neutral"
                      }
                    >
                      {run.status === "running"
                        ? "Running…"
                        : run.status === "done"
                          ? `${((run.durationMs ?? 0) / 1000).toFixed(1)}s`
                          : run.status === "error"
                            ? "Error"
                            : "Idle"}
                    </Chip>
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <h3 className="font-display text-sm font-semibold">{s.title}</h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{s.role}</p>
                    </div>
                  </div>

                  {run.usedUpstream && (
                    <div className="mt-2">
                      <Chip tone="primary">
                        <Link2 className="size-3" /> Consumed upstream context
                      </Chip>
                    </div>
                  )}

                  <div className="mt-3 rounded-xl border border-border bg-card p-3">
                    {run.status === "idle" && (
                      <p className="text-xs text-muted-foreground">
                        Ready. Run individually below or click &ldquo;Run All 3 Agents Together&rdquo;.
                      </p>
                    )}
                    {run.status === "running" && (
                      <div className="space-y-2 py-2">
                        {[85, 70, 90, 55].map((w) => (
                          <div key={w} className="h-2.5 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                    )}
                    {run.status === "error" && <p className="text-xs text-lost">{run.error}</p>}
                    {run.status === "done" && run.text && (
                      <div className="max-h-72 overflow-y-auto pr-1">
                        <Markdown text={run.text} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    disabled={pipelineRunning || run.status === "running"}
                    onClick={() => runSingle(s.id, agentRuns)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                  >
                    <Sparkles className="size-3" /> Run {s.step} solo
                  </button>
                  <Link
                    to={s.route}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    Open page <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Step 4 · Human-in-the-Loop Judgment & SAP S/4HANA Approval Gate"
        action={
          <Chip tone={approved ? "good" : "warn"}>
            <UserCheck className="size-3" />
            {approved ? `Approved Scenario ${approved}` : "Human Decision Required"}
          </Chip>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              AI agents propose options, but the Supply Chain Manager applies human judgment (customer priority, supplier relationship, plant fatigue) before posting ERP commitments.
            </p>
            <label className="block text-xs font-medium">
              Manager judgment note (recorded in SAP BTP audit log)
              <input
                type="text"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="e.g., Approve Scenario B to protect Volt EV & Tora SUV launch commitments without unapproved chips"
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {sim.scenarios.map((sc) => {
                const isBest = sc.key === sim.best.key;
                const isApproved = approved === sc.key;
                return (
                  <button
                    key={sc.key}
                    type="button"
                    onClick={() => setApproved(isApproved ? null : (sc.key as ScenarioKey))}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isApproved
                        ? "border-advanced bg-advanced-soft"
                        : isBest
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-xs font-semibold">Scenario {sc.key}</span>
                      <span className="num text-xs font-semibold">{sc.score}/100</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{sc.name}</p>
                    <p className="num mt-1.5 text-[11px]">
                      {fmtP(sc.feasibility)} cars · {fmtINR(sc.extraCost)}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                      {isApproved ? <><CheckCircle2 className="size-3.5" /> Approved</> : "Approve plan"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/60 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 font-display text-xs font-semibold">
                <ShieldCheck className="size-4 text-primary" /> SAP S/4HANA &amp; IBP Execution Log
              </p>
              <Cpu className="size-3.5 text-muted-foreground" />
            </div>
            {sapActions.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-xs">
                {sapActions.map((act) => (
                  <li key={act} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-advanced" />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Select a scenario on the left to generate SAP S/4HANA Purchase Requisitions, Stock Transport Orders, or Master Production Schedule transactions.
              </p>
            )}

            {auditLog.length > 0 && (
              <div className="mt-3 border-t border-border pt-2">
                <p className="eyebrow mb-1">Recent Manager Decisions</p>
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  {auditLog.slice(0, 3).map((entry) => (
                    <p key={entry.id}>
                      <span className="font-mono text-foreground">{entry.at}</span> · Scenario {entry.scenario} ({entry.supplyPct}% / {entry.delayWeeks}w) — {entry.note}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
