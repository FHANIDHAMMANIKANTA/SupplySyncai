# SupplySync AI — SAP BTP S&OP Disruption Simulator

An SAP BTP S&OP disruption simulator and multi-agent decision cockpit for an Indian automobile manufacturer (Pune, Chennai, and Sanand plants).

## Key Capabilities

- **S&OP Disruption Cockpit (`/dashboard`):** Live simulation across vehicle models (`Zeno Hatchback`, `Vira Sedan`, `Tora SUV`, `Volt EV`), plant chip stock, safety buffers, and Tier-1 suppliers (`Kaveri Semicon`, `Deccan Steel Works`, `Amara Cells`, `Nexa Electronics`, `Harness India`).
- **3 AI Agents — Individual & Collaborative:**
  - **Agent 1 · Supply Risk Detection (`/agents/risk`):** Analyzes supplier signals, allocation cuts, and cascading plant exposure.
  - **Agent 2 · Alternative Supplier Intelligence (`/agents/suppliers`):** Evaluates alternate semiconductor suppliers on cost, lead time, capacity, and qualification status.
  - **Agent 3 · S&OP Optimization & Decision (`/agents/sop`):** Compares Scenario A (Alternative Sourcing), Scenario B (Plant Stock Redistribution), and Scenario C (Margin Prioritization).
  - **Collaborative Multi-Agent Orchestrator (`/orchestrator`):** Chains Agents 1 → 2 → 3 end-to-end with upstream context handoff and a Human-in-the-Loop SAP S/4HANA approval gate.
- **SAP BTP Scenario Presets:** One-click presets (`S4-MRP-01`, `S4-MRP-02`, `IBP-STO-03`, `PORT-404`) recalculating every KPI and scenario score in real time.

## Local Development (Full-Stack with Backend AI)

```sh
npm install
# Add GEMINI_API_KEY (or OPENAI_API_KEY) to .env on the server
npm run dev
```

Built with TanStack Start, TypeScript, React, Tailwind CSS, and SAP Generative AI Hub backend orchestration.
