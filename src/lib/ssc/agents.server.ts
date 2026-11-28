import fs from "node:fs";
import path from "node:path";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, RetryError, generateText } from "ai";

const PROMPTS = {
  risk: "You are Agent 1 — Supply Risk Detection, running inside an SAP BTP S&OP application (connected to SAP S/4HANA and SAP HANA Cloud) for an Indian automobile manufacturer. Analyse the supplier signals and the disruption data. Output: '## Risk assessment' (severity, exposed components & plants, tier-2 cascading risks), '## Early-warning signals' (3 bullets), '## Recommended immediate actions' (3 bullets). Use only the numbers provided.",
  supplier:
    "You are Agent 2 — Alternative Supplier Intelligence in an SAP BTP S&OP app (connected to SAP S/4HANA & SAP Ariba sourcing data). Compare the alternative semiconductor suppliers on price, lead time, capacity, quality and approval status against the shortfall. If upstream Agent 1 risk findings are provided, factor those cascading plant/tier risks into your sourcing plan. Output: '## Supplier ranking' (numbered with one-line rationale each), '## Procurement plan' (quantities per supplier, extra cost), '## Risks & qualification notes' (2-3 bullets). Use only the numbers provided.",
  sop: "You are Agent 3 — S&OP Optimization and Decision Support in an SAP BTP & SAP Analytics Cloud app. Compare Scenario A (alternative supplier), B (inventory redistribution), C (production prioritisation) on production feasibility, additional cost, customer service level and inventory availability. If upstream Agent 1 (Risk) and Agent 2 (Supplier) briefs are provided, synthesize them into your decision. Output: '## Recommendation' (one scenario, or a justified hybrid), '## Why' (3 bullets with numbers), '## Affected customers & models', '## Approval note for the supply-chain manager' (2 concise sentences highlighting where human judgment is required). Use only the numbers provided.",
} as const;

export type AgentId = keyof typeof PROMPTS;
type AiProviderId = "gemini" | "openai" | "openrouter" | "groq" | "custom";

type ResolvedTarget = {
  providerLabel: string;
  baseURL: string;
  models: string[];
  apiKey: string;
  useNativeOpenAI: boolean;
};

// Prioritize ultra-low-latency models first so every agent completes well under 15s.
const GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.5-flash",
];

const PER_MODEL_TIMEOUT_MS = 12_000;

function readDotEnvFile(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    try {
      const p = path.resolve(process.cwd(), file);
      if (!fs.existsSync(p)) continue;
      const content = fs.readFileSync(p, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key && !(key in out)) out[key] = val;
      }
    } catch {
      /* ignore .env read errors */
    }
  }
  return out;
}

function getEnv(name: string, fileEnv: Record<string, string>): string | undefined {
  return process.env[name]?.trim() || fileEnv[name]?.trim() || undefined;
}

function detectProviderFromKey(apiKey: string): AiProviderId {
  if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) return "gemini";
  if (apiKey.startsWith("sk-or-")) return "openrouter";
  if (apiKey.startsWith("gsk_")) return "groq";
  return "openai";
}

function resolveServerTarget(): ResolvedTarget | null {
  const fileEnv = readDotEnvFile();
  const candidates: Array<[string | undefined, AiProviderId | "auto"]> = [
    [getEnv("SAP_AI_API_KEY", fileEnv), "custom"],
    [getEnv("AI_API_KEY", fileEnv), "auto"],
    [getEnv("GEMINI_API_KEY", fileEnv), "gemini"],
    [getEnv("GOOGLE_GENERATIVE_AI_API_KEY", fileEnv), "gemini"],
    [getEnv("OPENAI_API_KEY", fileEnv), "openai"],
    [getEnv("OPENROUTER_API_KEY", fileEnv), "openrouter"],
    [getEnv("GROQ_API_KEY", fileEnv), "groq"],
  ];

  let apiKey = "";
  let hint: AiProviderId | "auto" = "auto";
  for (const [val, p] of candidates) {
    if (val) {
      apiKey = val;
      hint = p;
      break;
    }
  }
  if (!apiKey) return null;

  const customUrl = getEnv("AI_BASE_URL", fileEnv) || getEnv("SAP_AI_BASE_URL", fileEnv) || "";
  const customModel = getEnv("AI_MODEL", fileEnv) || getEnv("SAP_AI_MODEL", fileEnv) || "";
  const provider: AiProviderId = customUrl
    ? "custom"
    : hint === "auto"
      ? detectProviderFromKey(apiKey)
      : hint;

  switch (provider) {
    case "gemini":
      return {
        providerLabel: "SAP Generative AI Hub",
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        models: customModel ? [customModel, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== customModel)] : GEMINI_FALLBACK_MODELS,
        apiKey,
        useNativeOpenAI: false,
      };
    case "openrouter":
      return {
        providerLabel: "SAP Generative AI Hub",
        baseURL: "https://openrouter.ai/api/v1",
        models: [customModel || "openai/gpt-4o-mini"],
        apiKey,
        useNativeOpenAI: false,
      };
    case "groq":
      return {
        providerLabel: "SAP Generative AI Hub",
        baseURL: "https://api.groq.com/openai/v1",
        models: [customModel || "llama-3.3-70b-versatile"],
        apiKey,
        useNativeOpenAI: false,
      };
    case "custom":
      return {
        providerLabel: "SAP Generative AI Hub",
        baseURL: customUrl || "https://api.openai.com/v1",
        models: [customModel || "gpt-4o-mini"],
        apiKey,
        useNativeOpenAI: false,
      };
    case "openai":
    default:
      return {
        providerLabel: "SAP Generative AI Hub",
        baseURL: customUrl || "https://api.openai.com/v1",
        models: [customModel || "gpt-4o-mini"],
        apiKey,
        useNativeOpenAI: !customUrl,
      };
  }
}

export async function getAiStatusServer() {
  const target = resolveServerTarget();
  return {
    configured: Boolean(target),
    providerLabel: "SAP Generative AI Hub",
  };
}

export async function runAgentServer(
  agent: AgentId,
  context: string,
  upstreamContext?: string,
) {
  const target = resolveServerTarget();
  if (!target) {
    return {
      ok: false as const,
      error: "SAP Generative AI Hub backend service is not configured yet on the server.",
    };
  }

  const trimmedUpstream = upstreamContext?.trim().slice(0, 1800);
  const userContent = trimmedUpstream
    ? `Current SAP BTP simulation data (JSON):\n${context}\n\nUpstream agent intelligence:\n${trimmedUpstream}`
    : `Current SAP BTP simulation data (JSON):\n${context}`;

  let lastError: unknown;
  for (let i = 0; i < target.models.length; i++) {
    const modelName = target.models[i]!;
    try {
      const modelInstance = target.useNativeOpenAI
        ? createOpenAI({ apiKey: target.apiKey }).chat(modelName)
        : createOpenAICompatible({
            name: "sap-genai-hub",
            baseURL: target.baseURL,
            apiKey: target.apiKey,
          }).chatModel(modelName);

      const result = await generateText({
        model: modelInstance,
        maxRetries: 0,
        maxOutputTokens: 450,
        abortSignal: AbortSignal.timeout(PER_MODEL_TIMEOUT_MS),
        system:
          PROMPTS[agent] +
          " Be crisp and concise (under 180 words). Use ₹ with Lakh/Crore. Plain markdown: ## headings, - bullets, **bold**.",
        messages: [{ role: "user", content: userContent }],
      });

      const text = result.text;
      if (!text.trim()) {
        lastError = new Error("Empty model response");
        continue;
      }
      return {
        ok: true as const,
        text,
        providerLabel: target.providerLabel,
      };
    } catch (e) {
      const rootErr = RetryError.isInstance(e) ? e.lastError : e;
      lastError = rootErr;
      const status = APICallError.isInstance(rootErr) ? rootErr.statusCode : undefined;
      const isTimeout =
        rootErr instanceof Error && (rootErr.name === "TimeoutError" || rootErr.name === "AbortError");
      if ((status === 404 || status === 503 || status === 429 || isTimeout) && i < target.models.length - 1) {
        continue;
      }
      break;
    }
  }

  const rootLast = RetryError.isInstance(lastError) ? lastError.lastError : lastError;
  const status = APICallError.isInstance(rootLast) ? rootLast.statusCode : undefined;
  if (status === 401) return { ok: false as const, error: "Backend AI credentials were rejected (401)." };
  if (status === 429) return { ok: false as const, error: "Too many requests — please wait a moment and try again." };
  if (status === 402) return { ok: false as const, error: "Backend AI quota or credits exhausted." };
  if (status === 403) return { ok: false as const, error: "Backend AI access is blocked." };
  console.error("agent error", lastError);
  return { ok: false as const, error: "The agent could not complete the analysis. Try again." };
}
