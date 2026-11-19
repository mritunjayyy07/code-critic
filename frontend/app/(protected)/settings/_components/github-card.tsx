"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Database,
} from "lucide-react";

export interface RepositoryItem {
  id: string;
  name: string;
  fullName: string;
  indexingStatus: string;
}

interface GithubCardProps {
  repoName?: string | null;
  indexingStatus?: string | null;
  repositories?: RepositoryItem[];
  githubAccount?: string | null;
  onRefresh?: () => void;
}

export function GithubCard({
  repoName,
  indexingStatus,
  repositories = [],
  githubAccount,
  onRefresh,
}: GithubCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const appName =
    process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "codecriticapp";

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }
      const count = data.syncedRepositories?.length || 0;
      setSyncMessage({
        type: "success",
        text:
          count > 0
            ? `Successfully synced ${count} repository${count > 1 ? "ies" : ""} and started indexing!`
            : "Sync completed. Make sure you granted Code Critic access to your repositories on GitHub.",
      });
      if (onRefresh) {
        onRefresh();
      } else {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err: any) {
      setSyncMessage({
        type: "error",
        text: err.message || "Failed to sync repositories",
      });
    } finally {
      setSyncing(false);
    }
  };

  const effectiveRepos: RepositoryItem[] =
    repositories.length > 0
      ? repositories
      : repoName && repoName !== "No repository connected"
        ? [
            {
              id: "primary",
              name: repoName.split("/")[1] || repoName,
              fullName: repoName,
              indexingStatus: indexingStatus || "NOT_STARTED",
            },
          ]
        : [];

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span>GitHub Integration</span>
            {githubAccount && (
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                @{githubAccount}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Connect repositories and monitor automatic AI code review indexing
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="gap-2"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Syncing..." : "Sync Repositories"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncMessage && (
          <div
            className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              syncMessage.type === "success"
                ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
            }`}
          >
            {syncMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{syncMessage.text}</span>
          </div>
        )}

        {effectiveRepos.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Connected Repositories ({effectiveRepos.length})
            </p>
            {effectiveRepos.map((repo) => (
              <div
                key={repo.id || repo.fullName}
                className="p-3 bg-muted/50 border rounded-lg flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <a
                      href={`https://github.com/${repo.fullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline flex items-center gap-1.5 text-sm"
                    >
                      {repo.fullName}
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </a>
                  </div>
                </div>

                <div>
                  {repo.indexingStatus === "COMPLETED" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      Indexed
                    </span>
                  ) : repo.indexingStatus === "INDEXING" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Indexing...
                    </span>
                  ) : repo.indexingStatus === "FAILED" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
                      <Clock className="w-3 h-3" />
                      Not Indexed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 border border-dashed rounded-lg text-center space-y-2">
            <p className="text-sm font-medium">No repositories connected yet</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Install the GitHub App to grant Code Critic access to your repositories. After granting access, click "Sync Repositories" if your repositories do not appear automatically.
            </p>
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <Button variant="default" size="sm" asChild>
            <a
              href={`https://github.com/apps/${appName}/installations/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1.5"
            >
              <span>Install / Add Repositories</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>

          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Manage Existing Installations</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground border-t pt-3">
          💡 <strong>Tip:</strong> If GitHub didn't automatically redirect you after selecting repositories, simply click <strong>Sync Repositories</strong> above to trigger immediate indexing into Qdrant vector database.
        </p>
      </CardContent>
    </Card>
  );
}
