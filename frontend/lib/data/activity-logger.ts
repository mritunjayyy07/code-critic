import { prisma } from "@/lib/prisma";
import { liveblocks } from "@/lib/liveblocks";
import { findRepoWithInstallation } from "./repositories";

async function sendNotification(
  userId: string,
  kind: `$${string}`,
  subjectId: string,
  activityData: Record<string, string | number | boolean | undefined>,
) {
  try {
    await liveblocks.triggerInboxNotification({
      userId,
      kind,
      subjectId,
      activityData,
    });
  } catch (err) {
    console.warn("Liveblocks notification failed:", err);
  }
}

export async function logPrReview(
  repoFullName: string,
  prNumber: number,
  prTitle: string,
  prGithubId: number,
) {
  const repo = await findRepoWithInstallation(repoFullName);
  if (!repo) {
    console.warn(`Repository not found: ${repoFullName}`);
    return null;
  }

  let pr = await prisma.pullRequest.findFirst({
    where: {
      repositoryId: repo.id,
      number: prNumber,
    },
  });

  if (!pr) {
    pr = await prisma.pullRequest.create({
      data: {
        githubId: BigInt(prGithubId || 0),
        number: prNumber,
        title: prTitle,
        repositoryId: repo.id,
      },
    });
  } else {
    pr = await prisma.pullRequest.update({
      where: { id: pr.id },
      data: {
        reviewedAt: new Date(),
        title: prTitle,
      },
    });
  }

  if (repo.installation?.userId) {
    await sendNotification(
      repo.installation.userId,
      "$prReviewed",
      `review_${repoFullName.replace("/", "_")}_${prNumber}`,
      {
        prNumber,
        repoName: repoFullName,
        title: prTitle,
        url: `https://github.com/${repoFullName}/pull/${prNumber}`,
      },
    );
  }

  return pr;
}

export async function logIssueAnalysis(
  repoFullName: string,
  issueNumber: number,
  issueTitle: string,
  issueGithubId: number,
) {
  const repo = await findRepoWithInstallation(repoFullName);
  if (!repo) {
    console.warn(`Repository not found: ${repoFullName}`);
    return null;
  }

  let issue = await prisma.issue.findFirst({
    where: {
      repositoryId: repo.id,
      number: issueNumber,
    },
  });

  if (!issue) {
    issue = await prisma.issue.create({
      data: {
        githubId: BigInt(issueGithubId || 0),
        number: issueNumber,
        title: issueTitle,
        repositoryId: repo.id,
      },
    });
  }

  if (repo.installation?.userId) {
    await sendNotification(
      repo.installation.userId,
      "$issueAnalyzed",
      `issue_${repoFullName.replace("/", "_")}_${issueNumber}`,
      {
        issueNumber,
        repoName: repoFullName,
        title: issueTitle,
        url: `https://github.com/${repoFullName}/issues/${issueNumber}`,
      },
    );
  }

  return issue;
}

export async function logPrCreation(
  repoFullName: string,
  prNumber: number,
  prTitle: string,
  issueNumber: number,
) {
  const repo = await findRepoWithInstallation(repoFullName);
  if (repo?.installation?.userId) {
    await sendNotification(
      repo.installation.userId,
      "$prCreated",
      `pr_${repoFullName.replace("/", "_")}_${prNumber}`,
      {
        prNumber,
        repoName: repoFullName,
        title: prTitle,
        issueNumber: issueNumber || 0,
        url: `https://github.com/${repoFullName}/pull/${prNumber}`,
      },
    );
  }

  return { success: true };
}

export async function logIndexingUpdate(repoFullName: string, status: string) {
  const repo = await findRepoWithInstallation(repoFullName);
  const normalizedStatus = status === "COMPELETED" ? "COMPLETED" : status;

  await prisma.repository.updateMany({
    where: {
      fullName: repoFullName,
    },
    data: {
      indexingStatus: normalizedStatus as any,
    },
  });

  if (
    repo?.installation?.userId &&
    (normalizedStatus === "COMPLETED" || normalizedStatus === "FAILED")
  ) {
    await sendNotification(
      repo.installation.userId,
      "$indexingComplete",
      `indexing_${repoFullName.replace("/", "_")}`,
      {
        reponame: repoFullName,
        status: normalizedStatus === "COMPLETED" ? "completed" : "failed",
        url: `https://github.com/${repoFullName}`,
      },
    );
  }

  return { success: true };
}
