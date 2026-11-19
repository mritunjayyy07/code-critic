"use client";

import { useEffect, useState, useCallback } from "react";
import { useUsage } from "@/components/providers/usage-provider";
import { StatCard } from "./_components/stat-card";
import { ActivityChart } from "./_components/activity-chart";
import DashboardLoading from "./loading";
import { useAuthRedirect } from "@/app/hooks/use-auth-redirect";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  GitPullRequest,
  Database,
  ArrowRight,
} from "lucide-react";

interface DashboardData {
  user: {
    email: string;
    plan: "FREE" | "PRO";
    prsUsed: number;
    prsCreated: number;
    issuesUsed: number;
    chatMessagesUsed: number;
  };
  stats: {
    totalPrs: number;
    totalIssues: number;
    repoCount: number;
    repoName: string;
    indexingStatus: string;
    githubAccount?: string | null;
    repositories?: {
      id: string;
      name: string;
      fullName: string;
      indexingStatus: string;
    }[];
  };

  chartData: {
    date: string;
    pullRequests: number;
    issues: number;
  }[];

  limits: {
    FREE: {
      prs: number;
      prsCreated: number;
      issues: number;
      chat: number;
    };

    PRO: {
      prs: number;
      prsCreated: number;
      issues: number;
      chat: number;
    };
  };
}

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuthRedirect();
  const { getUsagePercentage } = useUsage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("90d");

  const appName =
    process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "codecriticapp";

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("failed to fetch dashboard");
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      fetchData();
    }
  }, [isSignedIn, fetchData]);

  // Auto-poll while indexing is in progress
  useEffect(() => {
    const isIndexing =
      data?.stats?.indexingStatus === "INDEXING" ||
      data?.stats?.repositories?.some((r) => r.indexingStatus === "INDEXING");

    if (!isIndexing) return;

    const interval = setInterval(() => {
      fetchData();
    }, 4000);

    return () => clearInterval(interval);
  }, [data?.stats?.indexingStatus, data?.stats?.repositories, fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Sync failed");
      }
      const count = result.syncedRepositories?.length || 0;
      setSyncFeedback(
        count > 0
          ? `Synced ${count} repository${count > 1 ? "ies" : ""} and triggered indexing!`
          : "Sync finished. No new repositories detected.",
      );
      await fetchData();
    } catch (err: any) {
      setSyncFeedback(err.message || "Failed to sync repositories");
    } finally {
      setSyncing(false);
    }
  };

  if (!isLoaded || loading) {
    return <DashboardLoading />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-4">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-lg font-medium">Could not load dashboard information</p>
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          Make sure your account is initialized and the backend is running.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => { setLoading(true); fetchData(); }} variant="default" size="sm">
            Retry
          </Button>
          <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sync GitHub
          </Button>
        </div>
      </div>
    );
  }

  const filteredChartData = data.chartData.filter((item) => {
    const date = new Date(item.date);
    const now = new Date();
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    return date >= startDate;
  });

  const limits = data.limits[data.user.plan];
  const hasRepos = data.stats.repoCount > 0;
  const repoName = data.stats.repoName;
  const indexingStatus = data.stats.indexingStatus;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your repository indexing and automated code review activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync GitHub"}
          </Button>
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3 rounded-lg text-sm bg-muted/60 border flex items-center justify-between">
          <span className="text-sm">{syncFeedback}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setSyncFeedback(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Connected Repo Status Banner */}
      {!hasRepos ? (
        <div className="p-5 border border-dashed rounded-xl bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-base">No repository connected yet</h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Install the Code Critic GitHub App and choose which repositories to analyze. Once connected, Code Critic indexes your codebase and automatically reviews all new Pull Requests.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" asChild>
              <a
                href={`https://github.com/apps/${appName}/installations/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1.5"
              >
                <span>Connect GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              Sync Now
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-foreground">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Connected Repository:</span>
                <a
                  href={`https://github.com/${repoName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:underline text-sm flex items-center gap-1"
                >
                  {repoName}
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatic AI reviews will run on every Pull Request opened in this repository.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {indexingStatus === "COMPLETED" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Indexed & Ready
              </span>
            ) : indexingStatus === "INDEXING" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Indexing in progress...
              </span>
            ) : indexingStatus === "FAILED" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Indexing failed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
                Not Indexed
              </span>
            )}

            <Button variant="ghost" size="sm" asChild className="text-xs">
              <a href="/settings" className="gap-1">
                <span>Manage</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Usage Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="PRs Reviewed This Month"
          used={data.user.prsUsed}
          limit={limits.prs}
          percentage={getUsagePercentage("prs")}
        />
        <StatCard
          label="PRs Created This Month"
          used={data.user.prsCreated}
          limit={limits.prsCreated}
          percentage={getUsagePercentage("prsCreated")}
        />
        <StatCard
          label="Issues Analyzed"
          used={data.user.issuesUsed}
          limit={limits.issues}
          percentage={getUsagePercentage("issues")}
        />
        <StatCard
          label="Chat Messages"
          used={data.user.chatMessagesUsed}
          limit={limits.chat}
          percentage={getUsagePercentage("chat")}
        />
      </div>

      {/* Activity Chart */}
      <ActivityChart
        chartData={filteredChartData}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />
    </div>
  );
}
