import { NextRequest, NextResponse } from "next/server";
import { logIndexingUpdate } from "@/lib/data/activity-logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoFullName, status } = body;

    if (!repoFullName || !status) {
      return NextResponse.json(
        { error: "repoFullName and status are required" },
        { status: 400 }
      );
    }

    const result = await logIndexingUpdate(repoFullName, status);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating indexing status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
