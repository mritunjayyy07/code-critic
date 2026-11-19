import httpx

from app.core.config import settings


def get_base_url():
    return (settings.frontend_url or "http://localhost:3000").rstrip("/")


async def post(endpoint, data):
    base_url = get_base_url()
    path = "/" + endpoint.lstrip("/")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{base_url}{path}", json=data, timeout=10.0)
            return resp
    except Exception as e:
        print(f"Error posting to frontend {path}: {e}")
        return None


async def fetch_custom_rules(installation_id):
    base_url = get_base_url()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{base_url}/api/rules/by-installation/{installation_id}",
                timeout=10.0,
            )
            if resp.status_code == 200:
                return resp.json().get("rules", [])
            return []
    except Exception as e:
        print(f"Error fetching custom rules for installation {installation_id}: {e}")
        return []


async def log_pr_review(repo_full_name, pr_number, pr_title, pr_github_id):
    await post(
        "/api/logs/review",
        {
            "repoFullName": repo_full_name,
            "prNumber": pr_number,
            "prTitle": pr_title,
            "prGithubId": pr_github_id,
        },
    )


async def log_issue_analysis(
    repo_full_name, issue_number, issue_title, issue_github_id
):
    await post(
        "/api/logs/issue",
        {
            "repoFullName": repo_full_name,
            "issueNumber": issue_number,
            "issueTitle": issue_title,
            "issueGithubId": issue_github_id,
        },
    )


async def log_pr_creation(
    repo_full_name, pr_number, pr_title, pr_github_id, issue_number
):
    await post(
        "/api/logs/pr",
        {
            "repoFullName": repo_full_name,
            "prNumber": pr_number,
            "prTitle": pr_title,
            "prGithubId": pr_github_id,
            "issueNumber": issue_number,
        },
    )


async def update_indexing_status(repo_full_name, status):
    await post(
        "/api/indexing/update", {"repoFullName": repo_full_name, "status": status}
    )
