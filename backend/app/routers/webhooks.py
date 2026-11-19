import asyncio
from fastapi import APIRouter, Request
from app.handlers.installation import handle_installation
from app.handlers.issue import handle_issue
from app.handlers.pull_request import handle_pull_request
from app.models.schemas import WebhookResponse

router = APIRouter()


@router.post("/webhook", response_model=WebhookResponse)
async def handle_webhook(request: Request):
    body = await request.json()
    github_event_header = request.headers.get("x-github-event")

    if github_event_header:
        event = github_event_header
        if isinstance(body, dict) and "payload" in body:
            payload = body["payload"]
        else:
            payload = body
    elif isinstance(body, dict) and "event" in body and "payload" in body:
        event = body["event"]
        payload = body["payload"]
    else:
        event = body.get("event", "")
        payload = body

    action = payload.get("action", "") if isinstance(payload, dict) else ""
    print(f"Received webhook event: {event}, action: {action}")

    if event in ("installation", "installation_repositories"):
        if not action or action in ("created", "added"):
            asyncio.create_task(handle_installation(payload))
    elif event == "pull_request":
        # Run PR review on opened, reopened, or synchronize (new commits pushed to PR)
        if not action or action in ("opened", "reopened", "synchronize"):
            asyncio.create_task(handle_pull_request(payload))
    elif event == "issues":
        if not action or action in ("opened", "reopened"):
            asyncio.create_task(handle_issue(payload))

    return WebhookResponse(status="success")
