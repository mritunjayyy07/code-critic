import traceback
from app.services import embeddings, github, llm, vectordb
from app.services.frontend import fetch_custom_rules, log_pr_review


async def handle_pull_request(payload):
    try:
        installation_id = str(payload["installation"]["id"])
        pr = payload["pull_request"]
        repo = payload["repository"]
        owner = repo["owner"]["login"]
        repo_name = repo["name"]
        pr_number = pr["number"]
        title = pr.get("title", f"PR #{pr_number}")
        description = pr.get("body", "") or ""

        repo_full_name = f"{owner}/{repo_name}"
        print(f"Received PR #{pr_number} for {repo_full_name}: '{title}'")

        token = await github.get_installation_token(installation_id)

        diff = await github.get_pr_diff(owner, repo_name, pr_number, token)
        files_changed = await github.get_pr_files(owner, repo_name, pr_number, token)

        related_code = ""
        diff_text = (diff or "").strip()
        query_text = diff_text[:8000] if diff_text else title
        try:
            diff_embedding = await embeddings.create_embedding(query_text)
            search_results = await vectordb.search(
                diff_embedding, limit=5, repo=repo_full_name
            )

            for point in search_results:
                payload_data = point.payload
                path = payload_data.get("path", "unknown")
                content = payload_data.get("content", "")
                name = payload_data.get("name", "")
                chunk_type = payload_data.get("chunk_type", "code")

                header = f"File: {path}"
                if name:
                    header += f" | {chunk_type}: {name}"

                related_code += f"\n-- {header} ---\n{content}\n"
        except Exception as e:
            print(f"Context retrieval skipped/failed ({e}), proceeding with diff-only review")

        custom_rules = []
        try:
            custom_rules = await fetch_custom_rules(installation_id)
        except Exception as e:
            print(f"Custom rules fetch skipped ({e})")

        print(f"Generating AI review for PR #{pr_number}...")
        comment = await llm.review_pull_request(
            title=title,
            description=description,
            diff=diff,
            files_changed=files_changed,
            related_code=related_code,
            custom_rules=custom_rules,
        )

        if comment:
            await github.post_comment(owner, repo_name, pr_number, comment, token)
            print(f"Successfully posted AI review comment to PR #{pr_number}")

        pr_github_id = pr.get("id", 0)
        try:
            await log_pr_review(repo_full_name, pr_number, title, pr_github_id)
        except Exception as e:
            print(f"Logging PR review to frontend failed: {e}")

    except Exception as e:
        print(f"Error handling pull request: {e}")
        traceback.print_exc()
