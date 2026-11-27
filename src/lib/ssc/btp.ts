import type { Params, ScenarioKey } from "./model";

export type SapBtpScenarioPreset = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  sapTrigger: string;
  params: Params;
  badgeTone: "bad" | "warn" | "good" | "primary";
};

export const SAP_BTP_PRESETS: SapBtpScenarioPreset[] = [
  {
    id: "fab-fire",
    code: "S4-MRP-01",
    title: "Kaveri Fab Fire (Baseline)",
    subtitle: "60% supply · 3-week delay · Approved suppliers only",
    sapTrigger: "SAP S/4HANA ASN drop −38% + Ariba Risk Alert",
    params: { supplyPct: 60, delayWeeks: 3, useUnapproved: false },
    badgeTone: "warn",
  },
  {
    id: "severe-shortage",
    code: "S4-MRP-02",
    title: "Critical Tier-1 Outage",
    subtitle: "35% supply · 5-week delay · Emergency waiver enabled",
    sapTrigger: "SAP HANA Cloud capacity shock + Quality waiver",
    params: { supplyPct: 35, delayWeeks: 5, useUnapproved: true },
    badgeTone: "bad",
  },
  {
    id: "logistics-dip",
    code: "IBP-STO-03",
    title: "Minor Allocation Dip",
    subtitle: "80% supply · 1-week delay · Inter-plant transfer focus",
    sapTrigger: "SAP IBP safety-stock rebalance across Chennai & Sanand",
    params: { supplyPct: 80, delayWeeks: 1, useUnapproved: false },
    badgeTone: "good",
  },
  {
    id: "monsoon-hold",
    code: "PORT-404",
    title: "Monsoon Customs & Port Hold",
    subtitle: "45% supply · 6-week delay · Approved suppliers only",
    sapTrigger: "SAP BDC freight bottleneck + MPS line re-sequencing",
    params: { supplyPct: 45, delayWeeks: 6, useUnapproved: false },
    badgeTone: "bad",
  },
];

export type SapBtpLayer = {
  id: string;
  name: string;
  role: string;
  detail: string;
  artifacts: string[];
};

export const SAP_BTP_LAYERS: SapBtpLayer[] = [
  {
    id: "s4hana",
    name: "SAP S/4HANA & HANA Cloud",
    role: "Live ERP & MRP Foundation",
    detail:
      "Streams Pune, Chennai, and Sanand plant chip inventory, safety stock buffers, BOM consumption (38–120 chips/car), and Tier-1 OTIF signals.",
    artifacts: ["MMBE Stock Levels", "MD04 MRP Shortfall", "Ariba ASN Feeds"],
  },
  {
    id: "cap-build",
    name: "SAP BTP (CAP) & SAP Build",
    role: "Simulation Engine & Fiori Cockpit",
    detail:
      "Deterministic TypeScript scenario engine models Scenario A (Alt Sourcing), B (Plant STO), and C (Margin MPS) with human-in-the-loop approval gates.",
    artifacts: ["CAP Service Model", "S&OP Cockpit UI", "Manager Approval Gate"],
  },
  {
    id: "sac-bdc",
    name: "SAP Analytics Cloud & BDC",
    role: "Augmented Multi-Criteria Scoring",
    detail:
      "Evaluates every response across 5 weighted dimensions: 30% Feasibility, 25% Service Level, 15% Extra Cost, 15% Inventory Cover, 15% Margin Kept.",
    artifacts: ["5-Factor Score", "Model Allocation", "INR Margin Impact"],
  },
  {
    id: "genai-hub",
    name: "SAP Generative AI Hub",
    role: "3-Agent Collaborative Reasoning",
    detail:
      "Runs Agent 1 (Risk), Agent 2 (Suppliers), and Agent 3 (S&OP) either individually or in a chained pipeline where upstream insights inform downstream decisions.",
    artifacts: ["Individual Agents", "Chained Orchestrator", "BTP Destination Auth"],
  },
];

export function getSapExecutionSteps(approved: ScenarioKey | null, plantTransferChips: number) {
  if (!approved) return [];
  const common = `SAP BTP Audit · Approved Scenario ${approved}`;
  if (approved === "A") {
    return [
      `${common} — Create emergency Purchase Requisitions in SAP S/4HANA (ME51N)`,
      "Trigger SAP Ariba expedited air-freight ASN & incoming QM inspection lot (QA01)",
      "Update SAP IBP supply commit & notify Pune Chakan assembly schedule",
    ];
  }
  if (approved === "B") {
    return [
      `${common} — Generate Stock Transport Orders (ME21N UB) for ${plantTransferChips.toLocaleString("en-IN")} chips from Chennai & Sanand`,
      "Recalculate donor plant safety-stock horizon in SAP HANA Cloud MRP",
      "Dispatch 1-week inter-plant logistics manifest & update Pune line buffer",
    ];
  }
  return [
    `${common} — Publish revised Master Production Schedule (MD61) prioritizing Volt EV & Tora SUV`,
    "Re-sequence Pune assembly lines in SAP PP/DS based on margin-per-chip",
    "Sync entry-model dealer ETA updates via SAP S/4HANA Sales Order ATP",
  ];
}
