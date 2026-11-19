import asyncio
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import inngest.fast_api

from app.core.config import settings
from app.inngest.auto_pr import handle_auto_pr
from app.inngest.client import inngest_client
from app.inngest.indexing import handle_installation, index_single_repo
from app.routers import chat, webhooks
from app.services import github

app = FastAPI(title="Code Critic Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")
app.include_router(chat.router)
app.include_router(webhooks.router, prefix="/api")
app.include_router(webhooks.router)

inngest.fast_api.serve(
    app,
    inngest_client,
    [handle_installation, handle_auto_pr],
)


@app.post("/api/sync-installation")
@app.post("/sync-installation")
async def sync_installation(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    installation_id = body.get("installation_id") or body.get("installationId")
    if not installation_id:
        installations = await github.get_all_app_installations()
        if not installations:
            return {"status": "no_installations_found", "installations": []}

        results = []
        for inst in installations:
            inst_id = inst.get("id")
            account_login = inst.get("account", {}).get("login", "")
            repos = await github.get_installation_repositories(inst_id)
            for repo in repos:
                repo_name = repo["name"]
                asyncio.create_task(
                    index_single_repo(str(inst_id), account_login, repo_name)
                )
            results.append({
                "installationId": inst_id,
                "accountLogin": account_login,
                "repositories": repos,
            })
        return {"status": "success", "installations": results}

    repos = await github.get_installation_repositories(installation_id)
    account_login = repos[0]["owner"]["login"] if repos else ""
    if not account_login:
        inst_data = await github.get_installation(installation_id)
        if inst_data:
            account_login = inst_data.get("account", {}).get("login", "")

    for repo in repos:
        repo_name = repo["name"]
        asyncio.create_task(
            index_single_repo(str(installation_id), account_login, repo_name)
        )

    return {
        "status": "success",
        "installationId": int(installation_id),
        "accountLogin": account_login,
        "repositories": repos,
    }


@app.post("/api/index-repo")
@app.post("/index-repo")
async def index_repo(request: Request):
    body = await request.json()
    installation_id = str(body.get("installation_id") or body.get("installationId") or "")
    account = body.get("account") or body.get("owner") or ""
    repo_name = body.get("repo_name") or body.get("name") or ""

    if not installation_id or not account or not repo_name:
        raise HTTPException(
            status_code=400,
            detail="installation_id, account, and repo_name are required",
        )

    asyncio.create_task(index_single_repo(installation_id, account, repo_name))
    return {"status": "indexing_started", "repo": f"{account}/{repo_name}"}


@app.get("/")
async def root():
    return {"status": "ok", "service": "code-critic-backend"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
