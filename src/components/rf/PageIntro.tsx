import type { ReactNode } from "react";

/**
 * Page header. `figure` / `statement` are the DISPLAY TIER — the top of the type
 * scale, used at most once per page, on the single thing that page exists to
 * communicate. Neither computes anything: both take already-formatted strings.
 *
 * Composition: one compact title row (identity left, working `controls` such as
 * the cohort filters right), then an optional hero band pairing the display
 * figure with a visual `aside` so the first screenful always shows data.
 */
export function PageIntro({
  title,
  subtitle,
  controls,
  figure,
  statement,
  aside,
}: {
  title: string;
  subtitle: string;
  controls?: ReactNode;
  figure?: { value: string; label: string } | null;
  statement?: string;
  aside?: ReactNode;
}) {
  const hasHero = Boolean(figure || statement || aside);

  return (
    <header className="rf-rise space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight sm:text-[1.375rem]">{title}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        {controls && <div className="min-w-0 max-w-full">{controls}</div>}
      </div>

      {hasHero && (
        <div
          className={
            aside
              ? "grid items-center gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]"
              : undefined
          }
        >
          <div className="min-w-0">
            {figure && (
              <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                <p className="num display-figure text-foreground">{figure.value}</p>
                <p className="max-w-xs pb-1.5 text-sm text-muted-foreground">{figure.label}</p>
              </div>
            )}
            {statement && (
              <p className="display-statement mt-2 max-w-2xl text-balance">{statement}</p>
            )}
          </div>
          {aside && <div className="min-w-0">{aside}</div>}
        </div>
      )}
    </header>
  );
}

/** Uniform empty state for any panel whose filtered cohort has no records. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
