/* SupplySync AI — S&OP master data and deterministic scenario engine.
 * All numbers shown in the app are derived here; AI agents only interpret them. */

export type VehicleModel = {
  id: string; name: string; plan: number; chips: number; price: number; margin: number; orders: number; segment: string;
};
export const MODELS: VehicleModel[] = [
  { id: "zeno", name: "Zeno Hatchback", segment: "Entry", plan: 3800, chips: 38, price: 650000, margin: 62000, orders: 3600 },
  { id: "vira", name: "Vira Sedan", segment: "Mid", plan: 2200, chips: 52, price: 980000, margin: 110000, orders: 2350 },
  { id: "tora", name: "Tora SUV", segment: "Premium", plan: 2800, chips: 64, price: 1450000, margin: 210000, orders: 3100 },
  { id: "volt", name: "Volt EV", segment: "EV", plan: 1200, chips: 120, price: 1750000, margin: 240000, orders: 1150 },
];
export const TOTAL_PLAN = MODELS.reduce((s, m) => s + m.plan, 0);
export const CHIPS_REQUIRED = MODELS.reduce((s, m) => s + m.plan * m.chips, 0);
export const BASE_CHIP_COST = 210;

export type Supplier = {
  id: string; name: string; component: string; location: string; share: number; reliability: number;
  status: "disrupted" | "watch" | "stable"; signals: string[]; risk: number;
};
export const SUPPLIERS: Supplier[] = [
  { id: "kaveri", name: "Kaveri Semicon", component: "Semiconductor chips", location: "Hosur, TN", share: 72, reliability: 91, status: "disrupted", risk: 88,
    signals: ["Fab fire reported — 40% line capacity offline", "Advance shipping notices down 38% week-on-week", "Allocation notice: 60% of committed volume"] },
  { id: "deccan", name: "Deccan Steel Works", component: "Steel", location: "Raigad, MH", share: 55, reliability: 94, status: "watch", risk: 54,
    signals: ["Local movement restrictions near plant", "Rake availability down 12%"] },
  { id: "amara", name: "Amara Cells", component: "Batteries", location: "Tirupati, AP", share: 80, reliability: 96, status: "stable", risk: 31,
    signals: ["Lithium carbonate price +9% MoM"] },
  { id: "nexa", name: "Nexa Electronics", component: "Electronic components", location: "Noida, UP", share: 60, reliability: 89, status: "watch", risk: 47,
    signals: ["Depends on Kaveri for MCU sub-assemblies", "OTIF 86% last 4 weeks"] },
  { id: "sumi", name: "Harness India", component: "Wiring harnesses", location: "Chakan, MH", share: 70, reliability: 97, status: "stable", risk: 22,
    signals: ["No anomalies detected"] },
];

export type AltSupplier = { id: string; name: string; location: string; capacity: number; leadWeeks: number; unitCost: number; approved: boolean; quality: number };
export const ALT_SUPPLIERS: AltSupplier[] = [
  { id: "indus", name: "Indus Silicon", location: "Dholera, GJ", capacity: 90000, leadWeeks: 1, unitCost: 290, approved: true, quality: 93 },
  { id: "lotus", name: "Lotus Microdevices", location: "Hsinchu, TW", capacity: 140000, leadWeeks: 2, unitCost: 265, approved: true, quality: 97 },
  { id: "pacific", name: "Pacific Chipworks", location: "Penang, MY", capacity: 200000, leadWeeks: 4, unitCost: 245, approved: true, quality: 95 },
  { id: "orion", name: "Orion Semi", location: "Shenzhen, CN", capacity: 250000, leadWeeks: 3, unitCost: 228, approved: false, quality: 84 },
];

export type Plant = { id: string; name: string; chipStock: number; safetyStock: number; affected: boolean };
export const PLANTS: Plant[] = [
  { id: "pune", name: "Pune (Chakan)", chipStock: 42000, safetyStock: 30000, affected: true },
  { id: "chennai", name: "Chennai (Oragadam)", chipStock: 165000, safetyStock: 110000, affected: false },
  { id: "sanand", name: "Sanand", chipStock: 118000, safetyStock: 85000, affected: false },
];
export const TRANSFER_COST_PER_CHIP = 12;

export type Params = { supplyPct: number; delayWeeks: number; useUnapproved: boolean };
export const DEFAULT_PARAMS: Params = { supplyPct: 60, delayWeeks: 3, useUnapproved: false };

export type ScenarioKey = "A" | "B" | "C";
export type Scenario = {
  key: ScenarioKey; name: string; summary: string; chips: number; units: number; feasibility: number;
  extraCost: number; marginLost: number; serviceLevel: number; inventoryDays: number; score: number;
  perModel: { id: string; name: string; units: number; plan: number; orders: number }[]; actions: string[];
};

const WEEKS = 4;
const allocate = (chips: number, order: VehicleModel[], proportional: boolean) => {
  const out: Record<string, number> = {};
  if (proportional) {
    const r = Math.min(1, chips / CHIPS_REQUIRED);
    for (const m of MODELS) out[m.id] = Math.floor(m.plan * r);
    return out;
  }
  let left = chips;
  for (const m of order) { const u = Math.max(0, Math.min(m.plan, Math.floor(left / m.chips))); out[m.id] = u; left -= u * m.chips; }
  return out;
};

export function simulate(p: Params) {
  const pune = PLANTS.find((x) => x.affected)!;
  const delivered = Math.round(CHIPS_REQUIRED * (p.supplyPct / 100));
  const usableStock = pune.chipStock - pune.safetyStock;
  const base = delivered + usableStock;
  const gap = Math.max(0, CHIPS_REQUIRED - base);
  const planMargin = MODELS.reduce((s, m) => s + m.plan * m.margin, 0);
  const dailyUse = CHIPS_REQUIRED / (WEEKS * 6);

  const build = (key: ScenarioKey, name: string, summary: string, chips: number, units: Record<string, number>, extraCost: number, networkLeft: number, actions: string[]) => {
    const perModel = MODELS.map((m) => ({ id: m.id, name: m.name, units: units[m.id] ?? 0, plan: m.plan, orders: m.orders }));
    const total = perModel.reduce((s, m) => s + m.units, 0);
    const served = perModel.reduce((s, m) => s + Math.min(m.units, m.orders), 0);
    const orders = perModel.reduce((s, m) => s + m.orders, 0);
    const margin = MODELS.reduce((s, m) => s + (units[m.id] ?? 0) * m.margin, 0);
    return { key, name, summary, chips, units: total, feasibility: total / TOTAL_PLAN, extraCost, marginLost: planMargin - margin,
      serviceLevel: served / orders, inventoryDays: networkLeft / dailyUse, score: 0, perModel, actions } as Scenario;
  };

  // A — alternative suppliers, cheapest first, capacity pro-rated by lead time inside the month.
  const pool = ALT_SUPPLIERS.filter((s) => s.approved || p.useUnapproved).sort((a, b) => a.unitCost - b.unitCost);
  let need = gap; let altCost = 0; const altUsed: { name: string; qty: number }[] = [];
  for (const s of pool) {
    if (need <= 0) break;
    const usable = Math.floor(s.capacity * Math.max(0, (WEEKS - s.leadWeeks) / WEEKS));
    const q = Math.min(need, usable);
    if (q > 0) { altUsed.push({ name: s.name, qty: q }); altCost += q * (s.unitCost - BASE_CHIP_COST); need -= q; }
  }
  const altChips = gap - need;
  const expedite = altChips > 0 ? 1500000 : 0;
  const othersSurplus = PLANTS.filter((x) => !x.affected).reduce((s, x) => s + (x.chipStock - x.safetyStock), 0);
  const A = build("A", "Alternative supplier", `Buy ${altChips.toLocaleString("en-IN")} chips from ${altUsed.map((u) => u.name).join(", ") || "no supplier"}`,
    base + altChips, allocate(base + altChips, MODELS, true), altCost + expedite, othersSurplus + PLANTS.reduce((s, x) => s + x.safetyStock, 0),
    [...altUsed.map((u) => `Raise PO: ${u.qty.toLocaleString("en-IN")} chips from ${u.name}`), "Expedite air freight + incoming quality inspection"]);

  // B — redistribute surplus above safety stock from unaffected plants (1 week transit).
  const transfer = Math.min(gap, othersSurplus);
  const B = build("B", "Inventory redistribution", `Transfer ${transfer.toLocaleString("en-IN")} chips from Chennai and Sanand`,
    base + transfer, allocate(base + transfer, MODELS, true), transfer * TRANSFER_COST_PER_CHIP + (transfer > 0 ? 600000 : 0),
    othersSurplus - transfer + PLANTS.reduce((s, x) => s + x.safetyStock, 0),
    PLANTS.filter((x) => !x.affected).map((x) => `Stock transfer order from ${x.name}: up to ${(x.chipStock - x.safetyStock).toLocaleString("en-IN")} chips`)
      .concat(["Donor plants run at safety stock for 2 weeks"]));

  // C — prioritise models by margin per chip with available components only.
  const order = [...MODELS].sort((a, b) => b.margin / b.chips - a.margin / a.chips);
  const C = build("C", "Production prioritisation", `Re-sequence: ${order.map((m) => m.name.split(" ")[0]).join(" → ")} by margin per chip`,
    base, allocate(base, order, false), 2500000, othersSurplus + PLANTS.reduce((s, x) => s + x.safetyStock, 0),
    ["Revise MPS / line sequencing in SAP IBP", "Overtime + changeover on premium lines", "Notify dealers of entry-model delays"]);

  const list = [A, B, C];
  const maxCost = Math.max(...list.map((s) => s.extraCost), 1);
  const maxInv = Math.max(...list.map((s) => s.inventoryDays), 1);
  for (const s of list) {
    const net = 1 - s.marginLost / planMargin;
    s.score = Math.round(100 * (0.3 * s.feasibility + 0.25 * s.serviceLevel + 0.15 * (1 - s.extraCost / maxCost) + 0.15 * (s.inventoryDays / maxInv) + 0.15 * net));
  }
  const best = [...list].sort((a, b) => b.score - a.score)[0]!;
  return { delivered, usableStock, base, gap, planMargin, scenarios: list, best, delayWeeks: p.delayWeeks, altSuppliersConsidered: pool.length };
}
export type SimResult = ReturnType<typeof simulate>;

export const fmtINR = (n: number) => {
  const a = Math.abs(n); const s = n < 0 ? "−" : "";
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(1)} L`;
  return `${s}₹${Math.round(a).toLocaleString("en-IN")}`;
};
export const fmtN = (n: number) => Math.round(n).toLocaleString("en-IN");
export const fmtP = (n: number) => `${(n * 100).toFixed(1)}%`;
