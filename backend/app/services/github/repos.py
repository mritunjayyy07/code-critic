import asyncio
import base64
import time

import httpx
import jwt

from app.core.config import settings
from app.services.github.auth import get_installation_token
from app.services.github.client import GITHUB_API, github_request

SKIP_FILES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "bun.lock",
    "composer.lock",
    "Gemfile.lock",
    "Pipfile.lock",
    "poetry.lock",
    "cargo.lock",
    "Cargo.lock",
    "go.sum",
    ".DS_Store",
    "thumbs.db",
}

SKIP_DIRS = {
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "venv",
    ".venv",
    "env",
    ".env",
    "vendor",
    "target",
    "coverage",
    ".coverage",
    ".nyc_output",
}

SKIP_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".svg",
    ".webp",
    ".bmp",
    ".mp3",
    ".mp4",
    ".wav",
    ".avi",
    ".mov",
    ".webm",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".7z",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".min.js",
    ".min.css",
}

MAX_FILE_SIZE = 100 * 1024


def should_skip_file(path, content_size):
    filename = path.split("/")[-1].lower()

    if filename in SKIP_FILES:
        return True

    path_parts = path.lower().split("/")
    for part in path_parts[:-1]:
        if part in SKIP_DIRS:
            return True

    for ext in SKIP_EXTENSIONS:
        if filename.endswith(ext):
            return True

    if content_size > MAX_FILE_SIZE:
        return True

    return False


async def get_repo_files(owner, repo, token):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "CodeCriticApp",
    }

    async with httpx.AsyncClient(base_url=GITHUB_API, timeout=30.0) as client:
        # Fast path: Try GitHub Git Trees API to get all repo files in 1 request
        try:
            repo_resp = await client.get(f"/repos/{owner}/{repo}", headers=headers)
            if repo_resp.status_code == 200:
                default_branch = repo_resp.json().get("default_branch", "main")
                tree_resp = await client.get(
                    f"/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1",
                    headers=headers,
                )
                if tree_resp.status_code == 200:
                    tree = tree_resp.json().get("tree", [])
                    blobs = [
                        it
                        for it in tree
                        if it.get("type") == "blob"
                        and not should_skip_file(it["path"], it.get("size", 0))
                    ]
                    # Limit to top 150 code files to prevent rate limiting / timeouts
                    candidates = blobs[:150]

                    sem = asyncio.Semaphore(15)
                    files = []

                    async def fetch_blob(item):
                        async with sem:
                            try:
                                resp = await client.get(
                                    item["url"], headers=headers
                                )
                                if resp.status_code == 200:
                                    raw_b64 = resp.json().get("content", "")
                                    content = base64.b64decode(raw_b64).decode(
                                        "utf-8", errors="ignore"
                                    )
                                    files.append(
                                        {"path": item["path"], "content": content}
                                    )
                            except Exception:
                                pass

                    await asyncio.gather(*[fetch_blob(c) for c in candidates])
                    if files:
                        return files
        except Exception as e:
            print(f"Git trees fast-path failed ({e}); falling back to contents crawl")

        # Fallback: Recursive directory crawl
        files = []

        async def fetch_directory(path=""):
            if path:
                dir_name = path.split("/")[-1].lower()
                if dir_name in SKIP_DIRS:
                    return
            try:
                resp = await client.get(
                    f"/repos/{owner}/{repo}/contents/{path}", headers=headers
                )
                if resp.status_code != 200:
                    return
                items = resp.json()
            except Exception as e:
                print(f"Error fetching directory {path}: {e}")
                return

            if not isinstance(items, list):
                return

            for item in items:
                if item.get("type") == "file":
                    if should_skip_file(item["path"], item.get("size", 0)):
                        continue
                    try:
                        file_resp = await client.get(
                            item["url"], headers=headers
                        )
                        file_data = file_resp.json()
                        raw_b64 = file_data.get("content", "")
                        content = base64.b64decode(raw_b64).decode(
                            "utf-8", errors="ignore"
                        )
                        files.append({"path": item["path"], "content": content})
                    except Exception as e:
                        print(f"Error reading file {item['path']}: {e}")
                        continue

                elif item.get("type") == "dir":
                    await fetch_directory(item["path"])

        await fetch_directory()
        return files


async def get_file_content(owner, repo, path, token, ref=None):
    params = {"ref": ref} if ref else {}
    resp = await github_request(
        "GET", f"/repos/{owner}/{repo}/contents/{path}", token, params=params
    )
    data = resp.json()
    raw_b64 = data.get("content", "")
    content = base64.b64decode(raw_b64).decode("utf-8", errors="ignore")
    return {
        "content": content,
        "sha": data.get("sha", ""),
        "encoding": data.get("encoding", "base64"),
    }


async def get_default_branch(owner, repo, token):
    resp = await github_request("GET", f"/repos/{owner}/{repo}", token)

    return resp.json()["default_branch"]


async def get_all_app_installations():
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 600, "iss": settings.github_app_id}
    private_key = settings.github_private_key.strip('"').replace("\\n", "\n")
    jwt_token = jwt.encode(payload, private_key, algorithm="RS256")

    resp = await github_request("GET", "/app/installations", jwt_token)
    if resp.status_code != 200:
        print(f"Error fetching app installations: {resp.status_code} {resp.text}")
        return []
    return resp.json()


async def get_installation(installation_id: str | int):
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 600, "iss": settings.github_app_id}
    private_key = settings.github_private_key.strip('"').replace("\\n", "\n")
    jwt_token = jwt.encode(payload, private_key, algorithm="RS256")

    resp = await github_request(
        "GET", f"/app/installations/{installation_id}", jwt_token
    )
    if resp.status_code != 200:
        print(f"Error fetching installation {installation_id}: {resp.status_code}")
        return None
    return resp.json()


async def get_installation_repositories(installation_id: str | int):
    token = await get_installation_token(str(installation_id))
    resp = await github_request("GET", "/installation/repositories", token)
    if resp.status_code != 200:
        print(f"Error fetching installation repos: {resp.status_code} {resp.text}")
        return []
    data = resp.json()
    return data.get("repositories", [])

