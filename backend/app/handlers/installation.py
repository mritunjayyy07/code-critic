import asyncio
import inngest

from app.inngest.client import inngest_client
from app.inngest.indexing import index_single_repo


async def handle_installation(payload):
    installation_id = str(payload["installation"]["id"])
    account = payload["installation"]["account"]["login"]
    repositories = (
        payload.get("repositories")
        or payload.get("repositories_added")
        or []
    )

    if not repositories:
        print("No repositories found in installation payload")
        return

    repo_name = repositories[0]["name"]
    try:
        await inngest_client.send(
            inngest.Event(
                name="installation/created",
                data={
                    "installation_id": installation_id,
                    "account": account,
                    "repositories": repositories,
                    "repo_name": repo_name,
                },
            )
        )
    except Exception as e:
        print(f"Inngest send skipped/failed ({e}), running direct indexing...")
        for repo in repositories:
            r_name = repo.get("name") if isinstance(repo, dict) else repo
            if r_name:
                asyncio.create_task(
                    index_single_repo(installation_id, account, r_name)
                )
