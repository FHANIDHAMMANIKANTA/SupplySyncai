import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Factory,
  Layers,
  LayoutDashboard,
  Network,
  Play,
  Scale,
  ShieldCheck,
  Truck,
  UserCheck,
} from "lucide-react";
import { ScenarioPresetBar } from "@/components/ssc/BtpComponents";
import { Card, Chip } from "@/components/ssc/ui";
import { CHIPS_REQUIRED, MODELS, PLANTS, SUPPLIERS, TOTAL_PLAN, fmtINR, fmtN, fmtP } from "@/lib/ssc/model";
import { useSim } from "@/lib/ssc/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SupplySync AI — SAP BTP S&OP Launchpad" },
      { name: "description", content: "SAP BTP launchpad for supply chain disruption simulation and AI-driven S&OP decisions for automobile manufacturing." },
      { property: "og:title", content: "SupplySync AI — SAP BTP S&OP Launchpad" },
      { property: "og:description", content: "Simulate supplier disruptions and let three AI agents work individually and together on SAP BTP." },
    ],
  }),
  component: Home,
});

function Tile({ to, icon: Icon, title, sub, kpi, kpiTone, chip }: { to: "/dashboard" | "/orchestrator" | "/agents/risk" | "/agents/suppliers" | "/agents/sop"; icon: typeof Bot; title: string; sub: string; kpi: string; kpiTone?: string; chip?: React.ReactNode }) {
  return (
    <Link to={to} className="group flex h-44 flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-panel transition-all hover:-translate-y-0.5 hover:border-primary">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>
        </div>
        <Icon className="size-5 shrink-0 text-primary" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className={`num text-2xl font-semibold ${kpiTone ?? ""}`}>{kpi}</p>
        {chip}
      </div>
    </Link>
  );
}

function Home() {
  const { sim, approved, params, agentRuns } = useSim();
  const disrupted = SUPPLIERS.filter((s) => s.status !== "stable").length;
  const completedAgents = (["risk", "supplier", "sop"] as const).filter((id) => agentRuns[id].status === "done").length;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-card p-6 shadow-panel md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="bad"><AlertTriangle className="size-3" /> Supplier disruption detected</Chip>
            <Chip>SAP BTP · S&amp;OP Cockpit</Chip>
            <Chip tone="primary">SAP Hackfest · Multi-Agent S&amp;OP</Chip>
          </div>
          <img
            src={`${import.meta.env.BASE_URL}siib-logo.png`}
            alt="SIIB Logo"
            className="h-9 w-auto rounded-lg bg-white px-2.5 py-1 object-contain shadow-xs"
          />
        </div>
        <h1 className="mt-4 max-w-3xl font-display text-3xl font-semibold tracking-tight md:text-4xl">
          SupplySync AI — intelligent supply chain disruption simulator
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Kaveri Semicon will deliver only {params.supplyPct}% of semiconductor chips with a {sim.delayWeeks}-week delay.
          The plan of {fmtN(TOTAL_PLAN)} cars is at risk. Three AI agents simulate the response individually and in concert on SAP BTP and recommend the best option for human approval.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
            Open S&amp;OP dashboard <ArrowRight className="size-4" />
          </Link>
          <Link to="/orchestrator" className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-5 py-2 text-sm font-medium text-foreground hover:bg-primary/20">
            <Play className="size-4" /> Run 3-Agent Orchestrator
          </Link>
          <Link to="/agents/sop" className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-muted">
            Get AI recommendation
          </Link>
        </div>
      </section>

      <div>
        <p className="eyebrow mb-3">Planning &amp; monitoring</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile to="/dashboard" icon={LayoutDashboard} title="S&OP Dashboard" sub="Plan vs. supply cockpit" kpi={fmtN(TOTAL_PLAN)} chip={<Chip>cars planned</Chip>} />
          <Tile to="/dashboard" icon={Factory} title="Chip shortfall" sub="After usable plant stock" kpi={fmtN(sim.gap)} kpiTone="text-lost" chip={<Chip tone="bad">chips</Chip>} />
          <Tile to="/dashboard" icon={Scale} title="Recommended plan" sub={sim.best.name} kpi={fmtP(sim.best.feasibility)} kpiTone="text-advanced" chip={<Chip tone={approved ? "good" : "warn"}>{approved ? `Approved ${approved}` : "Awaiting approval"}</Chip>} />
          <Tile to="/dashboard" icon={Truck} title="Extra cost" sub="Recommended scenario" kpi={fmtINR(sim.best.extraCost)} chip={<Chip>this month</Chip>} />
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3">AI agents — individual &amp; collaborative</p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Tile to="/agents/risk" icon={AlertTriangle} title="Agent 1 · Supply Risk Detection" sub="Monitors supplier signals" kpi={`${disrupted}`} kpiTone="text-pending" chip={<Chip tone="bad">suppliers at risk</Chip>} />
          <Tile to="/agents/suppliers" icon={Network} title="Agent 2 · Alternative Supplier Intelligence" sub="Compares price, lead time, capacity" kpi={`${sim.altSuppliersConsidered}`} chip={<Chip tone="primary">options</Chip>} />
          <Tile to="/agents/sop" icon={Bot} title="Agent 3 · S&OP Optimization" sub="Scores scenarios A, B, C" kpi={`Scenario ${sim.best.key}`} kpiTone="text-advanced" chip={<Chip tone="good">score {sim.best.score}</Chip>} />
          <Tile
            to="/orchestrator"
            icon={Layers}
            title="Collaborative Orchestrator"
            sub="Runs Agents 1 → 2 → 3 together"
            kpi={`${completedAgents}/3`}
            kpiTone={completedAgents === 3 ? "text-advanced" : "text-primary"}
            chip={<Chip tone={completedAgents === 3 ? "good" : "primary"}>{completedAgents === 3 ? "Pipeline ready" : "End-to-end flow"}</Chip>}
          />
        </div>
      </div>

      <ScenarioPresetBar />

      <Card
        title="How the 3 SAP BTP Agents Work Together + Where Human Judgment Enters"
        action={
          <Link
            to="/orchestrator"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Open Live Orchestrator <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border p-3">
            <p className="eyebrow">01 · S/4HANA Signal</p>
            <p className="mt-1 font-display text-sm font-semibold">Risk Detection (Agent 1)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ingests {SUPPLIERS.length} Tier-1 supplier feeds, identifies Kaveri Semicon&apos;s {params.supplyPct}% cut &amp; cascading risk across {PLANTS.length} plants ({fmtN(CHIPS_REQUIRED)} chip need).
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="eyebrow">02 · Ariba Sourcing</p>
            <p className="mt-1 font-display text-sm font-semibold">Supplier Intelligence (Agent 2)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Receives Agent 1&apos;s exposure brief and evaluates {sim.altSuppliersConsidered} alternate chipmakers on ₹/chip, lead time, capacity &amp; qualification status.
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="eyebrow">03 · SAC Analytics</p>
            <p className="mt-1 font-display text-sm font-semibold">S&amp;OP Optimization (Agent 3)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Combines Agents 1 &amp; 2 across all {MODELS.length} vehicle lines (Zeno, Vira, Tora, Volt EV) to score Scenarios A, B, and C.
            </p>
          </div>
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
            <p className="flex items-center gap-1 eyebrow text-primary">
              <UserCheck className="size-3" /> 04 · Human Gate
            </p>
            <p className="mt-1 font-display text-sm font-semibold">Manager Approval &amp; ERP Post</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supply Chain Manager reviews AI consensus, applies judgment on customer orders or unapproved waivers, and commits PO/STO/MPS to SAP S/4HANA.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-advanced" />
            Each agent runs both <strong className="text-foreground">individually</strong> on its dedicated page and <strong className="text-foreground">collaboratively</strong> in the Orchestrator with live state sharing.
          </span>
          <span>Live Pune / Chennai / Sanand simulation · Server-secured AI backend</span>
        </div>
      </Card>
    </div>
  );
}
