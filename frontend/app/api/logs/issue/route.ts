import { NextRequest, NextResponse } from "next/server";
import { logIssueAnalysis } from "@/lib/data/activity-logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoFullName, issueNumber, issueTitle, issueGithubId } = body;

    const result = await logIssueAnalysis(
      repoFullName,
      Number(issueNumber),
      issueTitle || `Issue #${issueNumber}`,
      Number(issueGithubId || 0)
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Error logging issue analysis:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
