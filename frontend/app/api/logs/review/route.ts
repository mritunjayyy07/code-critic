import { NextRequest, NextResponse } from "next/server";
import { logPrReview } from "@/lib/data/activity-logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoFullName, prNumber, prTitle, prGithubId } = body;

    const result = await logPrReview(
      repoFullName,
      Number(prNumber),
      prTitle || `PR #${prNumber}`,
      Number(prGithubId || 0)
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Error logging PR review:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
