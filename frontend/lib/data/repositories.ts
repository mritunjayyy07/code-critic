import { prisma } from "@/lib/prisma";

export async function findRepoWithInstallation(repoFullName: string) {
  return prisma.repository.findFirst({
    where: {
      fullName: repoFullName,
    },
    include: {
      installation: {
        select: {
          userId: true,
        },
      },
    },
  });
}

export async function upsertRepository(
  githubId: number | bigint,
  name: string,
  fullName: string,
  installationId: string,
) {
  return prisma.repository.upsert({
    where: {
      githubId: BigInt(githubId),
    },
    create: {
      githubId: BigInt(githubId),
      name,
      fullName,
      installationId,
    },
    update: {
      name,
      fullName,
      installationId,
    },
  });
}

export async function updateIndexingStatus(
  repoFullName: string,
  status: string,
) {
  const normalized = status === "COMPELETED" ? "COMPLETED" : status;
  return prisma.repository.updateMany({
    where: {
      fullName: repoFullName,
    },
    data: {
      indexingStatus: normalized as any,
    },
  });
}
