import { NextRequest, NextResponse } from "next/server";
import {
  handleInstallationCreated,
  handlePullRequestOpened,
} from "@/lib/handlers/github";

export async function POST(req: NextRequest) {
  try {
    const event = req.headers.get("x-github-event");
    const payload = await req.json();

    if (event === "installation" || event === "installation_repositories") {
      if (
        !payload.action ||
        payload.action === "created" ||
        payload.action === "added"
      ) {
        await handleInstallationCreated(payload);
      }
    } else if (event === "pull_request") {
      if (
        !payload.action ||
        ["opened", "reopened", "synchronize"].includes(payload.action)
      ) {
        await handlePullRequestOpened(payload);
      }
    } else {
      // Forward other events (such as issues) to backend
      const backendUrl =
        process.env.BACKEND_URL || "http://localhost:8000/api";
      const baseBackend = backendUrl.replace(/\/api$/, "");
      fetch(`${baseBackend}/api/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, payload }),
      }).catch((e) =>
        console.warn("Could not forward webhook to backend:", e)
      );
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("GitHub webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
