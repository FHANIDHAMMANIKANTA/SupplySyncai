import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { THEME_BOOTSTRAP, ThemeToggle } from "../components/rf/theme";
import { SimProvider } from "../lib/ssc/store";

const LOGO_SRC = `${import.meta.env.BASE_URL}siib-logo.png`;

const NAV = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "S&OP Dashboard" },
  { to: "/orchestrator", label: "Orchestrator" },
  { to: "/agents/risk", label: "Risk Agent" },
  { to: "/agents/suppliers", label: "Supplier Agent" },
  { to: "/agents/sop", label: "S&OP Agent" },
] as const;

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page isn&apos;t part of SupplySync AI.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn&apos;t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while deriving the view.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SupplySync AI — SAP BTP S&OP Disruption Simulator" },
      {
        name: "description",
        content:
          "AI-powered supply chain disruption and S&OP simulator on SAP BTP for automobile manufacturers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "SupplySync AI — SAP BTP S&OP Disruption Simulator" },
      { name: "twitter:title", content: "SupplySync AI — SAP BTP S&OP Disruption Simulator" },
      {
        property: "og:description",
        content: "AI-powered supply chain disruption and S&OP simulator on SAP BTP for automobile manufacturers.",
      },
      {
        name: "twitter:description",
        content: "AI-powered supply chain disruption and S&OP simulator on SAP BTP for automobile manufacturers.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: LOGO_SRC, type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <SimProvider>
        <AppShell />
      </SimProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  return (
    <div className="min-h-screen">
      {/* Floating pill nav — sticky, centered, detached. */}
      <header className="pointer-events-none sticky top-3 z-40 flex justify-center px-3 pt-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-border bg-card/85 py-1.5 pl-4 pr-1.5 shadow-panel backdrop-blur-md">
          <Link to="/" className="hidden shrink-0 items-center gap-2 sm:flex">
            <img
              src={LOGO_SRC}
              alt="SIIB"
              className="h-6 w-auto rounded-full bg-white px-2 py-0.5 object-contain"
            />
            <span className="font-display text-[13px] font-semibold leading-none tracking-tight">
              SupplySync AI
            </span>
          </Link>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          <nav className="flex items-center gap-0.5 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{
                  className:
                    "bg-primary font-medium text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 pb-12 pt-6 md:pt-8">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-5 text-[11px] text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">SupplySync AI</span> · SAP BTP S&amp;OP application · fictional demo data for an Indian automobile manufacturer · AI analysis by SAP Generative AI Hub
          </p>
          <img
            src={LOGO_SRC}
            alt="SIIB"
            className="h-6 w-auto rounded-md bg-white px-2 py-0.5 object-contain"
          />
        </div>
      </footer>
    </div>
  );
}
