import { NextRequest, NextResponse } from "next/server";
import { logPrCreation } from "@/lib/data/activity-logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoFullName, prNumber, prTitle, issueNumber } = body;

    const result = await logPrCreation(
      repoFullName,
      Number(prNumber),
      prTitle || `PR #${prNumber}`,
      Number(issueNumber || 0)
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Error logging PR creation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
