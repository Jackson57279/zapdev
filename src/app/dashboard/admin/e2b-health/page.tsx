"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

export default function E2BHealthDashboard() {
  const rateLimitStats = useQuery(api.e2bRateLimits.getStats);
  const queueStats = useQuery(api.jobQueue.getStats);

  // Mock circuit breaker state (in production, you'd fetch this from an API)
  const circuitBreakerState = "CLOSED"; // "CLOSED" | "OPEN" | "HALF_OPEN"
  const circuitBreakerFailures = 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">E2B Health Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor E2B service health, rate limits, and queue status
          </p>
        </div>
      </div>

      {/* Circuit Breaker Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Circuit Breaker Status
          </CardTitle>
          <CardDescription>
            Prevents cascading failures when E2B service is unavailable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">State:</span>
                {circuitBreakerState === "CLOSED" ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    CLOSED (Healthy)
                  </Badge>
                ) : circuitBreakerState === "OPEN" ? (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    OPEN (Unavailable)
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    HALF-OPEN (Testing)
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Failures: {circuitBreakerFailures} / 5
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {circuitBreakerState === "CLOSED"
                  ? "All requests passing through normally"
                  : circuitBreakerState === "OPEN"
                    ? "Requests are being queued"
                    : "Testing if service recovered"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limit Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Rate Limit Usage (Last Hour)
          </CardTitle>
          <CardDescription>
            E2B API usage tracked per operation type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rateLimitStats ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Total Requests</span>
                  <span className="text-2xl font-bold">
                    {rateLimitStats.totalRequests}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">By Operation:</p>
                {Object.entries(rateLimitStats.byOperation).map(
                  ([operation, count]) => {
                    const limit = operation === "sandbox_create" ? 100 : 500;
                    const percentage = Math.round((count / limit) * 100);
                    const isWarning = percentage >= 80;
                    const isDanger = percentage >= 95;

                    return (
                      <div key={operation} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">
                            {operation.replace("_", " ")}
                          </span>
                          <span className="font-mono">
                            {count} / {limit}
                            <span
                              className={`ml-2 ${isDanger ? "text-red-500" : isWarning ? "text-yellow-500" : "text-green-500"}`}
                            >
                              ({percentage}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${isDanger ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading stats...</p>
          )}
        </CardContent>
      </Card>

      {/* Job Queue Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Job Queue Status
          </CardTitle>
          <CardDescription>
            Requests queued when E2B service is unavailable
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queueStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{queueStats.total}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {queueStats.pending}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-blue-500">
                  {queueStats.processing}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-500">
                  {queueStats.completed}
                </p>
              </div>

              {queueStats.pending > 0 && (
                <div className="col-span-2 md:col-span-4 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        {queueStats.pending} request
                        {queueStats.pending === 1 ? "" : "s"} queued
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        These will be processed automatically when E2B service
                        recovers (checked every 2 minutes)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading stats...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
