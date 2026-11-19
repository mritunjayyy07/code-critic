import { prisma } from "@/lib/prisma";
import { upsertRepository } from "@/lib/data/repositories";

export async function handleInstallationCreated(payload: any) {
  try {
    const installationId = Number(payload.installation?.id);
    const accountLogin = payload.installation?.account?.login || "unknown";
    const repositories =
      payload.repositories || payload.repositories_added || [];

    if (!installationId) return;

    const existingInstallation = await prisma.installation.findUnique({
      where: {
        installationId,
      },
    });

    if (existingInstallation) {
      if (existingInstallation.accountLogin === "pending") {
        await prisma.installation.update({
          where: {
            id: existingInstallation.id,
          },
          data: {
            accountLogin,
          },
        });
      }

      for (const repo of repositories) {
        await upsertRepository(
          repo.id,
          repo.name,
          repo.full_name,
          existingInstallation.id,
        );
      }
    }

    // Forward to backend to trigger repository indexing
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000/api";
    const baseBackend = backendUrl.replace(/\/api$/, "");
    try {
      await fetch(`${baseBackend}/api/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "installation", payload }),
      });
    } catch (e) {
      console.warn("Could not notify backend of installation:", e);
    }
  } catch (error) {
    console.error("Error in handleInstallationCreated:", error);
  }
}

export async function handlePullRequestOpened(payload: any) {
  try {
    const installationId = Number(payload.installation?.id);
    const pr = payload.pull_request;
    const repo = payload.repository;

    if (!installationId || !pr || !repo) return;

    const installation = await prisma.installation.findUnique({
      where: {
        installationId,
      },
      include: {
        user: true,
      },
    });

    if (installation) {
      const repository = await upsertRepository(
        repo.id,
        repo.name,
        repo.full_name,
        installation.id,
      );

      const existingPr = await prisma.pullRequest.findFirst({
        where: {
          repositoryId: repository.id,
          number: pr.number,
        },
      });

      if (!existingPr) {
        await prisma.pullRequest.create({
          data: {
            githubId: BigInt(pr.id),
            number: pr.number,
            title: pr.title,
            repositoryId: repository.id,
          },
        });

        const headBranch = pr.head?.ref || "";
        const isAutoPR = headBranch.startsWith("coderabbit/");

        await prisma.user.update({
          where: {
            id: installation.userId,
          },
          data: isAutoPR
            ? {
                prsCreated: { increment: 1 },
                prsUsed: { increment: 1 },
              }
            : {
                prsUsed: { increment: 1 },
              },
        });
      }
    }

    // Forward to backend to generate the AI review comment on the PR!
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000/api";
    const baseBackend = backendUrl.replace(/\/api$/, "");
    try {
      await fetch(`${baseBackend}/api/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "pull_request", payload }),
      });
    } catch (e) {
      console.warn("Could not notify backend of PR:", e);
    }
  } catch (error) {
    console.error("Error in handlePullRequestOpened:", error);
  }
}
