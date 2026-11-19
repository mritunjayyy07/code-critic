import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { upsertRepository } from "@/lib/data/repositories";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (!body.installationId && !body.installation_id) {
      const userInstallation = await prisma.installation.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (userInstallation) {
        body.installationId = userInstallation.installationId;
      }
    }

    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000/api";
    const baseBackend = backendUrl.replace(/\/api$/, "");

    // Forward to backend to sync and index
    const backendRes = await fetch(`${baseBackend}/api/sync-installation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text();
      return NextResponse.json(
        { error: "Backend sync failed", details: errText },
        { status: 502 },
      );
    }

    const data = await backendRes.json();
    const syncedRepos: any[] = [];

    if (data.installations && Array.isArray(data.installations)) {
      for (const inst of data.installations) {
        const instId = inst.installationId;
        const accountLogin = inst.accountLogin || "unknown";

        const installation = await prisma.installation.upsert({
          where: { installationId: instId },
          update: { userId, accountLogin },
          create: { installationId: instId, accountLogin, userId },
        });

        for (const repo of inst.repositories || []) {
          const r = await upsertRepository(
            repo.id,
            repo.name,
            repo.full_name,
            installation.id,
          );
          // Mark indexing
          await prisma.repository.update({
            where: { id: r.id },
            data: { indexingStatus: "INDEXING" },
          });
          syncedRepos.push(repo.full_name);
        }
      }
    } else if (data.installationId) {
      const instId = data.installationId;
      const accountLogin = data.accountLogin || "unknown";

      const installation = await prisma.installation.upsert({
        where: { installationId: instId },
        update: { userId, accountLogin },
        create: { installationId: instId, accountLogin, userId },
      });

      for (const repo of data.repositories || []) {
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
        syncedRepos.push(repo.full_name);
      }
    }

    return NextResponse.json({
      success: true,
      syncedRepositories: syncedRepos,
      data,
    });
  } catch (error) {
    console.error("Error syncing github:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
