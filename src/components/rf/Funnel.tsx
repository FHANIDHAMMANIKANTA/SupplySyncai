import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Explainer } from "./Explainer";
import { FunnelCompact, FunnelDiagram } from "./FunnelShape";
import type { Deal, Lead } from "@/lib/rf/data";
import { SENIORITY_LABEL } from "@/lib/rf/data";
import {
  BAND_LABEL,
  fmtArr,
  fmtInt,
  fmtPct,
  funnelDiagramExplainer,
  funnelGeometry,
  stageExplainer,
  titleCase,
  type Band,
  type StageConfig,
  type StageResult,
} from "@/lib/rf/engine";

type Rec = { id: string; companyName: string; source: string; segment: string };

const BAND_TOKEN: Record<Band, { bar: string; text: string; soft: string }> = {
  advanced: { bar: "bg-advanced", text: "text-advanced", soft: "bg-advanced-soft" },
  pending: { bar: "bg-pending", text: "text-pending", soft: "bg-pending-soft" },
  dropped: { bar: "bg-lost", text: "text-lost", soft: "bg-lost-soft" },
};

function isDealRecord(r: Rec): r is Rec & Deal {
  return "arr" in r;
}

/** Leads are person-level records; deals are account-level. */
function isLeadRecord(r: Rec): r is Rec & Lead {
  return "disqualReason" in r;
}

/* ------------------------------------------------------------- drill table */

function DrillTable<T extends Rec>({
  result,
  band,
  dropKey,
}: {
  result: StageResult<T>;
  band: Band;
  /** When set, narrows the dropped band to a single reason group. */
  dropKey?: string | null;
}) {
  const inBand = result.records.filter(
    (r) => r.band === band && (!dropKey || r.dropKey === dropKey),
  );
  const rows = [...inBand].sort((a, b) => b.weeksInStage - a.weeksInStage).slice(0, 60);
  const total = inBand.length;
  const dealRows = rows.length > 0 && isDealRecord(rows[0].record);
  const leadRows = rows.length > 0 && isLeadRecord(rows[0].record);

  if (total === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted-foreground">
        No records in the {BAND_LABEL[band].toLowerCase()} band for this stage under the current
        filters.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2 font-medium text-muted-foreground">
                {leadRows ? "Contact" : "Company"}
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Source</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Segment</th>
              {dealRows && (
                <th className="num px-3 py-2 text-right font-medium text-muted-foreground">ARR</th>
              )}
              <th className="num px-3 py-2 text-right font-medium text-muted-foreground">
                Weeks in stage
              </th>
              <th className="px-4 py-2 font-medium text-muted-foreground">Disposition</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rec = row.record;
              const deal = isDealRecord(rec) ? rec : null;
              const lead = isLeadRecord(rec) ? rec : null;
              return (
                <tr key={rec.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-2">
                    <span className="block font-medium">
                      {lead ? lead.contactName : rec.companyName}
                    </span>
                    {lead && (
                      <span className="block text-[11px] text-muted-foreground">
                        {lead.contactTitle} · {SENIORITY_LABEL[lead.seniority]} ·{" "}
                        {lead.companyName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{titleCase(rec.source)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{titleCase(rec.segment)}</td>
                  {dealRows && (
                    <td className="num px-3 py-2 text-right">{deal ? fmtArr(deal.arr) : "—"}</td>
                  )}
                  <td className="num px-3 py-2 text-right">{row.weeksInStage}</td>
                  <td className="px-4 py-2">
                    {band === "dropped" && lead?.disqualReason ? (
                      <span className="text-lost">
                        {row.dropLabel}
                        <span className="text-muted-foreground">
                          {" "}
                          · {lead.disqualReason.detail}
                        </span>
                      </span>
                    ) : band === "dropped" && deal?.lossReason ? (
                      <span className="text-lost">
                        {row.dropLabel}
                        <span className="text-muted-foreground"> · {deal.lossReason.detail}</span>
                      </span>
                    ) : (
                      <span className={BAND_TOKEN[band].text}>
                        {row.dropLabel ?? BAND_LABEL[band]}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {total > rows.length && (
        <p className="hairline px-4 py-2 text-[11px] text-muted-foreground">
          Showing the {rows.length} longest-running of{" "}
          <span className="num">{fmtInt(total)}</span> records in this band.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------- disposition panel */

export function DispositionPanel<T extends Rec>({
  result,
  nextConfig,
  arrMode,
}: {
  result: StageResult<T>;
  /** Config of the following stage — defines this stage's advance rule. */
  nextConfig?: StageConfig<T>;
  arrMode: boolean;
}) {
  const [band, setBand] = useState<Band>("dropped");
  // Second level of the drill: a reason group inside the dropped band.
  const [dropKey, setDropKey] = useState<string | null>(null);
  const selectBand = (b: Band) => {
    setBand(b);
    setDropKey(null);
  };

  const bands: { band: Band; count: number; arr: number; label: string }[] = [
    {
      band: "advanced",
      count: result.advanced,
      arr: result.advancedArr,
      label: result.config.advancedLabel,
    },
    { band: "pending", count: result.pending, arr: result.pendingArr, label: "Still pending" },
    { band: "dropped", count: result.dropped, arr: result.droppedArr, label: "Dropped" },
  ];
  const denom = result.intake || 1;

  return (
    <div className="rf-open bg-surface-sunken">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow">
            Disposition of <span className="num">{fmtInt(result.intake)}</span> records that entered{" "}
            {result.config.label.toLowerCase()}
          </p>
          {/* Per-stage math lives here, next to the numbers it explains. */}
          <Explainer
            title={result.config.label}
            items={stageExplainer(result.config, nextConfig)}
          />
        </div>

        <div className="mt-3 flex h-9 w-full overflow-hidden rounded-md border border-border bg-card">
          {bands.map((b, i) => (
            <button
              key={b.band}
              type="button"
              onClick={() => selectBand(b.band)}
              aria-pressed={band === b.band}
              title={`${b.label}: ${fmtInt(b.count)}`}
              style={{
                width: `${(b.count / denom) * 100}%`,
                animationDelay: `${i * 90}ms`,
              }}
              className={`rf-split ${BAND_TOKEN[b.band].bar} relative border-r border-card/60 last:border-r-0 transition-opacity ${
                band === b.band ? "opacity-100" : "opacity-55 hover:opacity-80"
              }`}
            >
              <span className="sr-only">{b.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {bands.map((b) => (
            <button
              key={b.band}
              type="button"
              onClick={() => selectBand(b.band)}
              aria-pressed={band === b.band}
              aria-label={`${b.label}: ${fmtInt(b.count)} records`}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                band === b.band
                  ? "border-primary/50 bg-card"
                  : "border-border bg-card/60 hover:border-primary/30"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${BAND_TOKEN[b.band].bar}`} />
                <span className="text-xs font-medium">{b.label}</span>
              </span>
              <span className="num mt-1 block text-lg">{fmtInt(b.count)}</span>
              <span className="num block text-[11px] text-muted-foreground">
                {fmtPct((b.count / denom) * 100 / 100)}
                {arrMode ? ` · ${fmtArr(b.arr)}` : ""}
              </span>
            </button>
          ))}
        </div>

        {result.dropGroups.length > 0 && (
          <div className="mt-4">
            <p className="eyebrow">Dropped, decomposed</p>
            <ul className="mt-2 space-y-1.5">
              {result.dropGroups.map((g, i) => (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setBand("dropped");
                      setDropKey(dropKey === g.key ? null : g.key);
                    }}
                    aria-pressed={dropKey === g.key}
                    className={`flex w-full items-center gap-3 rounded-sm px-1 py-0.5 text-left transition-colors ${
                      dropKey === g.key ? "bg-card" : "hover:bg-card/60"
                    }`}
                  >
                  <span className="w-52 shrink-0 truncate text-xs">{g.label}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-sm bg-rail">
                    <span
                      className="rf-split block h-full bg-lost/85"
                      style={{
                        width: `${(g.count / (result.dropped || 1)) * 100}%`,
                        animationDelay: `${180 + i * 60}ms`,
                      }}
                    />
                  </span>
                  <span className="num w-10 shrink-0 text-right text-xs">{fmtInt(g.count)}</span>
                  {arrMode && (
                    <span className="num w-16 shrink-0 text-right text-xs text-muted-foreground">
                      {fmtArr(g.arr)}
                    </span>
                  )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <p className="eyebrow">
            Records · {BAND_LABEL[band]} band
            {dropKey
              ? ` · ${result.dropGroups.find((g) => g.key === dropKey)?.label ?? ""}`
              : ""}
          </p>
          <p className="num text-[11px] text-muted-foreground">
            {fmtInt(
              result.records.filter(
                (r) => r.band === band && (!dropKey || r.dropKey === dropKey),
              ).length,
            )}{" "}
            rows
          </p>
        </div>
        <div className="border-t border-border bg-card">
          <DrillTable result={result} band={band} dropKey={dropKey} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- funnel section */

/**
 * A funnel is one full-width section: header, the proportional diagram, and —
 * when a band is open — its disposition panel directly beneath, tied to the
 * band by a centered leader notch (all bands are horizontally centered, so the
 * notch lands under the open band by construction).
 */
export function FunnelSection<T extends Rec>({
  title,
  subtitle,
  results,
  openKey,
  onOpenChange,
  arrMode,
  onArrModeChange,
  sideInflow,
}: {
  title: string;
  subtitle: string;
  results: StageResult<T>[];
  openKey: string | null;
  onOpenChange: (key: string | null) => void;
  arrMode: boolean;
  onArrModeChange?: (next: boolean) => void;
  sideInflow?: { count: number; label: string } | null;
}) {
  const bands = funnelGeometry(results, arrMode);
  const openIdx = results.findIndex((r) => r.config.key === openKey);
  const open = openIdx >= 0 ? results[openIdx] : null;
  const toggle = (key: string) => onOpenChange(openKey === key ? null : key);

  return (
    <section className="rf-rise">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {onArrModeChange && (
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
            {[
              { label: "Count", value: false },
              { label: "ARR-weighted", value: true },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => onArrModeChange(opt.value)}
                aria-pressed={arrMode === opt.value}
                aria-label={`Scale the funnel by ${opt.label === "Count" ? "record count" : "ARR"}`}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  arrMode === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Single container: the plate itself is the card, so the diagram gets
          the full section width instead of paying two layers of padding. */}
      <div className="relative">
        {/* One methodology key for the whole diagram; per-stage math opens
            with the stage's drill-down panel. */}
        <div className="absolute right-3 top-3 z-10">
          <FunnelMethodology />
        </div>
        <div className="funnel-plate hidden px-2 py-4 md:block">
          <FunnelDiagram
            bands={bands}
            openKey={openKey}
            onToggle={toggle}
            arrMode={arrMode}
            sideInflow={sideInflow}
          />
        </div>
        <div className="funnel-plate px-2 py-3 md:hidden">
          <FunnelCompact
            bands={bands}
            openKey={openKey}
            onToggle={toggle}
            arrMode={arrMode}
            sideInflow={sideInflow}
          />
        </div>
      </div>


      {open && (
        <div className="rf-open mt-0">
          {/* Leader notch tying the panel to the band it belongs to. */}
          <div className="flex justify-center" aria-hidden>
            <span className="mt-[-1px] h-3 w-px bg-primary/60" />
          </div>
          <div className="panel overflow-hidden ring-1 ring-primary/30">
            <DispositionPanel
              result={open}
              nextConfig={results[openIdx + 1]?.config}
              arrMode={arrMode}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------- methodology popover */

/**
 * The single ⓘ on the funnel plate: colour key plus the diagram's scale and
 * conservation rules, sourced from `funnelDiagramExplainer()` in the engine so
 * the copy cannot drift from the geometry.
 */
function FunnelMethodology() {
  const items = funnelDiagramExplainer();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How this diagram works"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[24rem] p-0">
        <div className="border-b border-border px-3.5 py-2.5">
          <p className="eyebrow">How this diagram works</p>
          <p className="text-sm font-medium">Scale and conservation</p>
        </div>
        <div className="space-y-1.5 border-b border-border px-3.5 py-2.5 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-4 shrink-0 rounded-sm bg-primary/80" aria-hidden />
            the centre trunk — the cohort still in play
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-4 shrink-0 rounded-sm bg-lost" aria-hidden />
            streams left — dropped at this stage
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-4 shrink-0 rounded-sm bg-pending" aria-hidden />
            streams right — still pending here
          </p>
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
        <p className="border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
          Click a stage for its per-stage math and record-level drill-down.
        </p>
      </PopoverContent>
    </Popover>
  );
}

