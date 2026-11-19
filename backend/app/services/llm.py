import json
import httpx
from openai import OpenAI

from app.core.config import settings

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"


class LazyOpenAI:
    def __getattr__(self, name):
        _client = OpenAI(
            api_key=settings.openai_api_key or "dummy", max_retries=0
        )
        return getattr(_client, name)


openai_client = LazyOpenAI()


async def generate_text(prompt: str, temperature: float = 0.2) -> str:
    """Generate text using Gemini first, with fallback to OpenAI if configured."""
    # 1. Try Gemini
    if settings.gemini_api_key:
        models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]
        async with httpx.AsyncClient(timeout=45.0) as client:
            for model in models:
                url = f"{GEMINI_API_URL}/{model}:generateContent?key={settings.gemini_api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": temperature},
                }
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                return parts[0].get("text", "")
                    elif resp.status_code == 503:
                        continue
                    else:
                        print(f"Gemini {model} returned HTTP {resp.status_code}")
                except Exception as e:
                    print(f"Gemini {model} exception: {e}")
                    continue

    # 2. Try OpenAI
    if settings.openai_api_key and not settings.openai_api_key.startswith("dummy"):
        try:
            response = openai_client.chat.completions.create(
                model=settings.llm_model if not settings.llm_model.startswith("gemini") else "gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            print(f"OpenAI error in generate_text: {e}")

    return ""


async def review_pull_request(
    title, description, diff, files_changed, related_code, custom_rules
):
    rules_section = ""
    if custom_rules and len(custom_rules) > 0:
        lines = []
        for rule in custom_rules:
            lines.append("- " + rule)
        rules_list = "\n".join(lines)
        rules_section = f"""
        IMPORTANT: The team has defined these custom rules that MUST be enforced:
        {rules_list}

        Make sure to check for violations of these rules and flag them in your review.
        """

    prompt = f"""You are a senior code reviewer. Review this pull request and provide helpful feedback.

    PR Title: {title}
    PR Description: {description or "No description provided"}

    Files changed: {", ".join(files_changed)}
    {rules_section}
    Code changes (diff):
    {diff}

    Related code from the codebase for context:
    {related_code}

    Please provide a constructive code review comment formatted in Markdown. Focus on:
    - Potential bugs, logic flaws, or regressions
    - Code quality and maintainability
    - Performance implications
    - Suggestions for improvement
    {f"- Violations of the team's custom rules listed above" if custom_rules else ""}

    Be concise, constructive, and actionable."""

    result = await generate_text(prompt, temperature=0.2)
    if result:
        return result

    files_str = (
        "\n".join([f"- `{f}`" for f in files_changed])
        if files_changed
        else "None detected"
    )
    return f"""### 🤖 Code Critic Automated PR Review

**Title:** {title}
**Files Changed:**
{files_str}

#### 📋 Code Analysis
Review of the submitted changes in this pull request:
- **Diff Length:** {len(diff or "")} characters
- **Files Modified:** {len(files_changed)} file(s)

#### 💡 Observations & Checklist
- ✅ Verify all automated tests pass with these changes.
- 🔍 Check potential edge cases and error handling around the modified lines.
- 📖 Ensure documentation and comments are updated if public interfaces changed.
"""


async def help_with_issue(title, description, related_code, custom_rules):
    rules_section = ""
    if custom_rules and len(custom_rules) > 0:
        lines = []
        for rule in custom_rules:
            lines.append("- " + rule)
        rules_list = "\n".join(lines)

        rules_section = f"""
        Note: The team has defined these coding guidelines to follow:
        {rules_list}

        Keep these in mind when suggesting solutions.
        """

    prompt = f"""You are a helpful assistant that helps developers solve issues.

    Issue Title: {title}
    Issue Description: {description or "No description provided"}
    {rules_section}
    Related code from the codebase:
    {related_code}

    Please provide a helpful comment that:
    - Identifies which files might need to be modified
    - Suggests a potential approach to solve this issue
    - Points out any relevant code patterns in the codebase
    {f"- Ensure suggestions follow the team's coding guidelines listed above" if custom_rules else ""}

    Be concise and actionable."""

    result = await generate_text(prompt, temperature=0.2)
    if result:
        return result

    return f"""### 💡 Code Critic Issue Analysis

**Issue:** {title}

#### Suggested Approach
Based on the repository context:
- Identify the components related to `{title}`.
- Inspect relevant files and add test coverage.
"""


async def chat_with_repo(question, code_context):
    prompt = f"""You are a helpful assistant that answers questions about a codebase.

    User's question: {question}

    Here are relevant code snippets from the codebase that may help answer the question:
    {code_context}

    Please provide a clear and helpful answer based on the code context provided.
    If the code context doesn't contain enough information to fully answer the question,
    mention what you can determine from the available code and what additional information might be needed.

    Be concise and specific in your answer."""

    result = await generate_text(prompt, temperature=0.3)
    if result:
        return result

    return "I couldn't process the codebase question at this moment. Please verify the API keys are configured."


async def plan_issues_fix(
    issue_title, issue_body, related_code, file_contents, custom_rules
):
    files_section = ""
    for path, content in file_contents.items():
        truncated = content[:8000] if len(content) > 8000 else content
        files_section += (
            f"\n\n===FILE: {path} ===\n{truncated}\n=== END FILE ==="
        )

    rules_section = ""
    if custom_rules and len(custom_rules) > 0:
        lines = ["- " + rule for rule in custom_rules]
        rules_list = "\n".join(lines)
        rules_section = f"\nCoding guidelines to follow:\n{rules_list}\n"

    prompt = f"""You are a senior software engineer. Analyze this issue and plan the minimal code changes needed to fix it.

    ISSUE TITLE: {issue_title}

    ISSUE DESCRIPTION:
    {issue_body or "No description provided"}
    {rules_section}
    RELATED CODE SNIPPETS (from codebase search):
    {related_code}

    FULL FILE CONTENTS (files that might need changes):
    {files_section}

    Based on the issue and code, output a JSON plan with this exact structure:
    {{
        "summary": "One sentence describing the fix",
        "files": [
            {{
                "path": "path/to/file.ext",
                "action": "modify",
                "description": "What specific change to make"
            }}
        ],
        "approach": "2-3 sentences explaining the implementation approach"
    }}

    Rules:
    - action must be one of: "create", "modify", "delete"
    - Only include files that ACTUALLY need changes
    - Be specific in descriptions (e.g., "Change 'username' to 'User' on line 45")
    - For new files, describe what the file should contain
    - Be conservative - minimal changes only

    Output ONLY valid JSON, no markdown or explanation."""

    result = await generate_text(prompt, temperature=0.1)
    try:
        clean_json = (result or "").strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:]
        if clean_json.startswith("```"):
            clean_json = clean_json[3:]
        if clean_json.endswith("```"):
            clean_json = clean_json[:-3]
        plan = json.loads(clean_json.strip())
        return plan
    except Exception:
        return {"summary": "Fix for issue", "files": [], "approach": result or "N/A"}


plan_issue_fix = plan_issues_fix


async def generate_file_change(
    file_path,
    current_content,
    action,
    change_description,
    issue_title,
    issue_body,
    custom_rules,
):
    rules_section = ""
    if custom_rules and len(custom_rules) > 0:
        lines = ["- " + rule for rule in custom_rules]
        rules_list = "\n".join(lines)
        rules_section = f"\nCoding guidelines to follow:\n{rules_list}\n"

    if action == "create":
        prompt = f"""You are a senior software engineer. Create a new file to help fix this issue.

ISSUE: {issue_title}
{issue_body or ""}
{rules_section}
FILE TO CREATE: {file_path}
WHAT IT SHOULD DO: {change_description}

Output the COMPLETE file content. No explanations, no markdown code blocks - just the raw file content.
Make sure the code is production-ready and follows best practices."""

    elif action == "modify":
        prompt = f"""You are a senior software engineer. Modify this file to help fix an issue.

ISSUE: {issue_title}
{issue_body or ""}
{rules_section}
FILE: {file_path}

CURRENT CONTENT:
{current_content}

CHANGE NEEDED: {change_description}

Output the COMPLETE modified file content.
- No explanations
- No markdown code blocks
- No placeholders like "// rest of code unchanged"
- Output the ENTIRE file with your changes applied

Just output the raw file content."""

    else:
        return ""

    result = await generate_text(prompt, temperature=0.1)
    return result or ""
