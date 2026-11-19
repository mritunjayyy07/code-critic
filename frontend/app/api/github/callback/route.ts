import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { upsertRepository } from "@/lib/data/repositories";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const rawInstallationId = searchParams.get("installation_id");

    if (!rawInstallationId) {
      return NextResponse.redirect(
        new URL("/settings?error=missing_installation_id", req.url)
      );
    }

    const installationId = parseInt(rawInstallationId, 10);
    if (isNaN(installationId)) {
      return NextResponse.redirect(
        new URL("/settings?error=invalid_installation_id", req.url)
      );
    }

    // Ensure user exists in Prisma
    const clerkUser = await currentUser();
    const email =
      clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@example.com`;

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email,
        plan: "FREE",
        prsUsed: 0,
        issuesUsed: 0,
        chatMessagesUsed: 0,
        billingCycleStart: new Date(),
      },
    });

    const installation = await prisma.installation.upsert({
      where: {
        installationId,
      },
      update: {
        userId,
      },
      create: {
        installationId,
        accountLogin: "pending",
        userId,
      },
    });

    // Notify backend to fetch repos from GitHub and start indexing
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000/api";
    const baseBackend = backendUrl.replace(/\/api$/, "");
    try {
      const backendRes = await fetch(`${baseBackend}/api/sync-installation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId }),
      });

      if (backendRes.ok) {
        const syncData = await backendRes.json();
        if (syncData.accountLogin && syncData.accountLogin !== "unknown") {
          await prisma.installation.update({
            where: { id: installation.id },
            data: { accountLogin: syncData.accountLogin },
          });
        }
        for (const repo of syncData.repositories || []) {
          const r = await upsertRepository(
            repo.id,
            repo.name,
            repo.full_name,
            installation.id,
          );
          await prisma.repository.update({
            where: { id: r.id },
            data: { indexingStatus: "INDEXING" },
          });
        }
      }
    } catch (e) {
      console.warn("Could not immediately sync installation with backend:", e);
    }

    return NextResponse.redirect(
      new URL("/dashboard?installation=success", req.url),
    );
  } catch (error) {
    console.error("Error in github callback:", error);
    return NextResponse.redirect(
      new URL("/settings?error=callback_failed", req.url),
    );
  }
}
