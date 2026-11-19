import hashlib
import httpx
import numpy as np

from app.core.config import settings

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def _generate_fallback_vector(text: str, dim: int = 1536) -> list[float]:
    """Deterministic fallback vector used when AI APIs are unavailable."""
    seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    vec = rng.standard_normal(dim)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


async def create_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Batch embed multiple text chunks efficiently using Gemini API."""
    if not texts:
        return []

    if settings.gemini_api_key:
        results = []
        batch_size = 50
        async with httpx.AsyncClient(timeout=45.0) as client:
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                url = f"{GEMINI_API_URL}/gemini-embedding-001:batchEmbedContents?key={settings.gemini_api_key}"
                payload = {
                    "requests": [
                        {
                            "model": "models/gemini-embedding-001",
                            "content": {"parts": [{"text": t[:8000]}]},
                            "outputDimensionality": 1536,
                        }
                        for t in batch
                    ]
                }
                try:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        raw_embeddings = data.get("embeddings", [])
                        for item in raw_embeddings:
                            vals = item.get("values", [])
                            if vals and len(vals) == 1536:
                                results.append(vals)
                            else:
                                results.append(_generate_fallback_vector(batch[len(results) % len(batch)], 1536))
                    elif resp.status_code == 429:
                        print(
                            "Gemini rate limit / quota reached (429); using fallback embeddings for remaining chunks"
                        )
                        for rem_t in texts[len(results) :]:
                            results.append(_generate_fallback_vector(rem_t, 1536))
                        break
                    else:
                        print(
                            f"Gemini batchEmbedContents error {resp.status_code}: {resp.text[:150]}"
                        )
                        for t in batch:
                            results.append(_generate_fallback_vector(t, 1536))
                except Exception as e:
                    print(f"Gemini batch embedding error ({e}); using fallback vectors")
                    for t in batch:
                        results.append(_generate_fallback_vector(t, 1536))

        if len(results) == len(texts):
            return results

    # Fallback to OpenAI if configured
    if settings.openai_api_key and not settings.openai_api_key.startswith("dummy"):
        try:
            from openai import OpenAI

            oai_client = OpenAI(api_key=settings.openai_api_key, max_retries=0)
            response = oai_client.embeddings.create(
                input=[t[:8000] for t in texts], model="text-embedding-3-small"
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            print(f"OpenAI batch embedding error: {e}")

    return [_generate_fallback_vector(t, 1536) for t in texts]


async def create_embedding(text: str) -> list[float]:
    res = await create_embeddings_batch([text])
    return res[0]
