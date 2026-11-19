import os
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from app.core.config import settings

COLLECTION_NAME = "codecritic"
_client = None


def get_client() -> QdrantClient:
    global _client
    if _client is not None:
        return _client

    if settings.qdrant_url and settings.qdrant_api_key:
        try:
            client = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key,
                check_compatibility=False,
                timeout=60.0,
            )
            # Test connectivity
            client.get_collections()
            print("Connected to remote Qdrant Cloud cluster.")
            _client = client
            return _client
        except Exception as e:
            print(
                f"Remote Qdrant unavailable or forbidden ({e}); falling back to local embedded Qdrant."
            )

    storage_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../qdrant_storage")
    )
    os.makedirs(storage_dir, exist_ok=True)
    _client = QdrantClient(path=storage_dir)
    print(f"Initialized local embedded Qdrant at {storage_dir}")
    return _client


def init_collection():
    client = get_client()
    try:
        if not client.collection_exists(COLLECTION_NAME):
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
            )
    except Exception:
        try:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
            )
        except Exception:
            pass

    try:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="repo",
            field_schema=PayloadSchemaType.KEYWORD,
        )
    except Exception:
        pass


def upsert_embeddings(points):
    if not points:
        return
    init_collection()
    client = get_client()
    batch_size = 100
    for i in range(0, len(points), batch_size):
        batch = points[i : i + batch_size]
        try:
            client.upsert(collection_name=COLLECTION_NAME, points=batch)
        except Exception as e:
            print(f"Error upserting batch {i}..{i+len(batch)}: {e}")


async def search(embedding, repo, limit=5):
    client = get_client()
    query_filter = None
    if repo:
        query_filter = Filter(
            must=[FieldCondition(key="repo", match=MatchValue(value=repo))]
        )

    try:
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=embedding,
            query_filter=query_filter,
            with_payload=True,
            limit=limit,
        )
        return results.points
    except Exception as e:
        print(f"Vector search failed ({e})")
        return []


def create_point(id, vector, payload):
    return PointStruct(id=id, vector=vector, payload=payload)
