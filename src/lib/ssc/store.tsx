import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PARAMS, simulate, type Params, type ScenarioKey, type SimResult } from "./model";
import type { AgentId } from "./agents.server";

export type AgentRunState = {
  status: "idle" | "running" | "done" | "error";
  text?: string;
  error?: string;
  at?: string;
  providerLabel?: string;
  durationMs?: number;
  usedUpstream?: boolean;
  stale?: boolean;
};

export type AuditEntry = {
  id: string;
  at: string;
  scenario: ScenarioKey;
  note: string;
  supplyPct: number;
  delayWeeks: number;
};

const EMPTY_RUNS: Record<AgentId, AgentRunState> = {
  risk: { status: "idle" },
  supplier: { status: "idle" },
  sop: { status: "idle" },
};

type Ctx = {
  params: Params;
  setParams: (p: Params) => void;
  sim: SimResult;
  approved: ScenarioKey | null;
  setApproved: (k: ScenarioKey | null, note?: string) => void;
  approvalNote: string;
  setApprovalNote: (n: string) => void;
  auditLog: AuditEntry[];
  agentRuns: Record<AgentId, AgentRunState>;
  setAgentRun: (agent: AgentId, next: AgentRunState) => void;
};

const C = createContext<Ctx | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [params, setParamsState] = useState<Params>(DEFAULT_PARAMS);
  const [approved, setApprovedState] = useState<ScenarioKey | null>(null);
  const [approvalNote, setApprovalNote] = useState<string>("");
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [agentRuns, setAgentRuns] = useState<Record<AgentId, AgentRunState>>(EMPTY_RUNS);

  const setParams = useCallback((p: Params) => {
    setParamsState(p);
    setApprovedState(null);
    setAgentRuns((prev) => ({
      risk: prev.risk.status === "done" ? { ...prev.risk, stale: true } : prev.risk,
      supplier: prev.supplier.status === "done" ? { ...prev.supplier, stale: true } : prev.supplier,
      sop: prev.sop.status === "done" ? { ...prev.sop, stale: true } : prev.sop,
    }));
  }, []);

  const setApproved = useCallback(
    (k: ScenarioKey | null, note?: string) => {
      setApprovedState(k);
      if (note !== undefined) setApprovalNote(note);
      if (k) {
        setAuditLog((prev) => [
          {
            id: `${Date.now()}`,
            at: new Date().toLocaleTimeString(),
            scenario: k,
            note: (note ?? approvalNote).trim() || "Approved via SAP BTP S&OP Cockpit",
            supplyPct: params.supplyPct,
            delayWeeks: params.delayWeeks,
          },
          ...prev.slice(0, 9),
        ]);
      }
    },
    [approvalNote, params.delayWeeks, params.supplyPct],
  );

  const setAgentRun = useCallback((agent: AgentId, next: AgentRunState) => {
    setAgentRuns((prev) => ({ ...prev, [agent]: next }));
  }, []);

  const sim = useMemo(() => simulate(params), [params]);

  return (
    <C.Provider
      value={{
        params,
        setParams,
        sim,
        approved,
        setApproved,
        approvalNote,
        setApprovalNote,
        auditLog,
        agentRuns,
        setAgentRun,
      }}
    >
      {children}
    </C.Provider>
  );
}

export function useSim() {
  const c = useContext(C);
  if (!c) throw new Error("SimProvider missing");
  return c;
}
