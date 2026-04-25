import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  History,
  Monitor,
  Workflow,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

type StatusTone = "operational" | "degraded" | "outage";

const overallStatus: StatusTone = "degraded";

const componentStatuses = [
  {
    name: "Agent runs",
    description:
      "New coding requests can be accepted, but some executions are failing before a result is saved.",
    tone: "degraded" as const,
    icon: Bot,
  },
  {
    name: "Inngest workflows",
    description:
      "Background workflow execution is unstable and currently the primary source of impact.",
    tone: "degraded" as const,
    icon: Workflow,
  },
  {
    name: "Sandbox boot",
    description:
      "Sandbox creation and runtime initialization are still completing successfully from current checks.",
    tone: "operational" as const,
    icon: Activity,
  },
  {
    name: "App shell",
    description:
      "The core site is still reachable; the current issue is concentrated in the agent execution path.",
    tone: "operational" as const,
    icon: Monitor,
  },
];

const incidentUpdates = [
  {
    at: "11:07 UTC",
    title: "Investigating",
    body:
      "We started seeing repeated provider failures inside the code-agent workflow after requests were handed off to Inngest.",
  },
  {
    at: "11:18 UTC",
    title: "Scope confirmed",
    body:
      "Sandbox provisioning and preview startup still look healthy. The impact appears isolated to agent execution reliability.",
  },
  {
    at: "11:21 UTC",
    title: "Mitigation in progress",
    body:
      "We removed the :nitro variant for tool-calling requests and retried with fallback models, but runs are still failing intermittently.",
  },
];

const recentHistory = [
  {
    day: "Apr 25, 2026",
    title: "Agent runs degraded",
    detail:
      "Ongoing incident affecting Inngest-backed agent execution. Customer-facing impact is intermittent failures during generation.",
    tone: "degraded" as const,
  },
  {
    day: "Earlier",
    title: "No earlier incidents posted",
    detail:
      "No additional public incident history has been logged on this page yet.",
    tone: "operational" as const,
  },
];

const statusMeta: Record<
  StatusTone,
  {
    label: string;
    badgeClassName: string;
    dotClassName: string;
    icon: typeof CheckCircle2;
  }
> = {
  operational: {
    label: "Operational",
    badgeClassName:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
    icon: CheckCircle2,
  },
  degraded: {
    label: "Degraded",
    badgeClassName:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dotClassName: "bg-amber-500",
    icon: AlertTriangle,
  },
  outage: {
    label: "Major outage",
    badgeClassName:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dotClassName: "bg-rose-500",
    icon: XCircle,
  },
};

export const metadata: Metadata = generateSEOMetadata({
  title: "System Status - Zapdev",
  description: "Current platform availability and incident updates for Zapdev.",
  keywords: ["Zapdev status", "system status", "incident status", "service health"],
  canonical: "/status",
  openGraph: {
    title: "Zapdev System Status",
    description: "Current platform availability and incident updates for Zapdev.",
    type: "website",
  },
});

export default function StatusPage() {
  const overall = statusMeta[overallStatus];
  const OverallIcon = overall.icon;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:py-14">
        <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border bg-card shadow-sm">
                <Activity className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Zapdev system status</p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Degraded performance
                </h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Agent runs are currently degraded. Requests can still be accepted,
              but some Inngest-backed executions are failing before results are
              written back.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className={cn("gap-1.5 px-3 py-1 text-sm", overall.badgeClassName)}
            >
              <OverallIcon className="size-3.5" />
              {overall.label}
            </Badge>
            <div className="rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
              <div className="text-muted-foreground">Last updated</div>
              <div className="font-medium">Apr 25, 2026 at 11:21 UTC</div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Overall</CardDescription>
              <CardTitle className="text-xl">Degraded performance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The platform is up, but the agent path is not reliably finishing
                every request right now.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Primary impact</CardDescription>
              <CardTitle className="text-xl">Agent execution</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The current incident is concentrated in the background workflow
                that powers code generation.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Current response</CardDescription>
              <CardTitle className="text-xl">Fallbacks active</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We are retrying with safer model selection, but the workflow is
                still intermittently failing.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle>Components</CardTitle>
              <CardDescription>
                Current health for the parts of Zapdev most affected by this incident.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {componentStatuses.map((component) => {
                const meta = statusMeta[component.tone];
                const StatusIcon = meta.icon;
                const ComponentIcon = component.icon;

                return (
                  <div
                    key={component.name}
                    className="flex flex-col gap-3 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl border bg-muted/40">
                        <ComponentIcon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">{component.name}</div>
                        <p className="text-sm text-muted-foreground">
                          {component.description}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn("gap-2 px-3 py-1", meta.badgeClassName)}
                    >
                      <span className={cn("size-2 rounded-full", meta.dotClassName)} />
                      <StatusIcon className="size-3.5" />
                      {meta.label}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent history</CardTitle>
              <CardDescription>
                Incident posts shown in reverse chronological order.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentHistory.map((entry) => {
                const meta = statusMeta[entry.tone];

                return (
                  <div key={`${entry.day}-${entry.title}`} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{entry.title}</div>
                      <Badge
                        variant="outline"
                        className={cn("gap-2 px-2.5 py-0.5", meta.badgeClassName)}
                      >
                        <span className={cn("size-2 rounded-full", meta.dotClassName)} />
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{entry.day}</div>
                    <p className="text-sm text-muted-foreground">{entry.detail}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active incident</CardTitle>
            <CardDescription>
              Agent runs are intermittently failing after handoff to the background workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="size-4 text-amber-500" />
                    Inngest-backed agent execution is degraded
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We are seeing repeated <code>Provider returned error</code>{" "}
                    failures during the code-agent workflow. Sandboxes are still
                    being created, but some model and tool steps are not finishing
                    cleanly, so generation can fail before the final response is saved.
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit gap-2 px-3 py-1",
                    statusMeta.degraded.badgeClassName
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      statusMeta.degraded.dotClassName
                    )}
                  />
                  Mitigating
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              {incidentUpdates.map((update) => (
                <div key={`${update.at}-${update.title}`} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="mt-1 flex size-8 items-center justify-center rounded-full border bg-card shadow-sm">
                      <Clock3 className="size-4 text-muted-foreground" />
                    </div>
                    <div className="mt-2 h-full w-px bg-border" />
                  </div>

                  <div className="pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{update.title}</div>
                      <div className="text-xs text-muted-foreground">{update.at}</div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{update.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              This page is intentionally simple and manually updated.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border px-4 py-4">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Workflow className="size-4 text-muted-foreground" />
                What is affected
              </div>
              <p className="text-sm text-muted-foreground">
                The broken path is the agent workflow triggered after a request is
                accepted. If a run fails, the user may see the request hang or never
                receive a completed fragment.
              </p>
            </div>

            <div className="rounded-xl border px-4 py-4">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <History className="size-4 text-muted-foreground" />
                What still works
              </div>
              <p className="text-sm text-muted-foreground">
                Current logs still show sandboxes booting successfully. The issue is
                narrower than a full platform outage, which is why the overall state
                is degraded rather than down.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
