import time

import jwt

from app.core.config import settings
from app.services.github.client import github_request


async def get_installation_token(installation_id):
    now = int(time.time())
    # Use now - 60 to prevent clock drift issues with GitHub
    payload = {"iat": now - 60, "exp": now + 600, "iss": settings.github_app_id}
    private_key = settings.github_private_key.strip('"').replace("\\n", "\n")
    jwt_token = jwt.encode(payload, private_key, algorithm="RS256")

    resp = await github_request(
        "POST", f"/app/installations/{installation_id}/access_tokens", jwt_token
    )

    data = resp.json()
    if "token" not in data:
        raise ValueError(f"Failed to get GitHub installation token: {data}")
    return data["token"]
