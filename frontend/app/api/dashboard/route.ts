import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { getDashboardStats, buildChartData } from "@/lib/data/logs";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let stats = await getDashboardStats(userId);
    if (!stats) {
      const clerkUser = await currentUser();
      if (clerkUser) {
        const email =
          clerkUser.emailAddresses?.[0]?.emailAddress || `${userId}@example.com`;
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
        stats = await getDashboardStats(userId);
      }
    }

    if (!stats) {
      return NextResponse.json({ error: "User data not found" }, { status: 404 });
    }

    const { user, installation, repositories, totalPRs, totalIssues, prsByDate, issuesByDate } = stats;
    const chartData = buildChartData(prsByDate, issuesByDate);

    return NextResponse.json({
      user: {
        email: user.email,
        plan: user.plan,
        prsUsed: user.prsUsed,
        prsCreated: user.prsCreated,
        issuesUsed: user.issuesUsed,
        chatMessagesUsed: user.chatMessagesUsed,
        billingCycleStart: user.billingCycleStart
      },
      stats: {
        totalPRs,
        totalIssues,
        repoCount: repositories.length,
        repoName: repositories[0]?.fullName || "No repository connected",
        indexingStatus: repositories[0]?.indexingStatus || "NOT_STARTED",
        githubAccount: installation?.accountLogin || null,
        repositories: repositories.map((r) => ({
          id: r.id,
          name: r.name,
          fullName: r.fullName,
          indexingStatus: r.indexingStatus,
        })),
      },
      chartData,
      limits: PLAN_LIMITS
    })
  } catch (error) {
    return NextResponse.json(
      { error: "internal server used" },
      { status: 500 }
    );
  }
}
