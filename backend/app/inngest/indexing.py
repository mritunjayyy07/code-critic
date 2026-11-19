import hashlib
import inngest

from app.inngest.client import inngest_client
from app.services import embeddings, github, vectordb
from app.services.chunker import chunk_code, create_chunk_text_for_embedding
from app.services.frontend import update_indexing_status


def make_chunk_id(repo: str, file_path: str, start_line: int, end_line: int) -> str:
    raw = f"{repo}:{file_path}:{start_line}:{end_line}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


async def index_single_repo(installation_id: str, account: str, repo_name: str):
    repo_full_name = f"{account}/{repo_name}"
    print(f"Starting indexing for {repo_full_name}...")
    try:
        await update_indexing_status(repo_full_name, "INDEXING")
        token = await github.get_installation_token(installation_id)
        files = await github.get_repo_files(account, repo_name, token)

        all_chunks = []
        for file in files:
            file_path = file["path"]
            content = file.get("content", "")

            try:
                chunks = chunk_code(content, file_path)
                all_chunks.extend(chunks)
            except Exception as e:
                print(f"Error chunking {file_path}: {e}")
                continue

        if not all_chunks:
            print(f"No chunks extracted for {repo_full_name}")
            await update_indexing_status(repo_full_name, "COMPLETED")
            return

        print(f"Embedding {len(all_chunks)} chunks for {repo_full_name}...")
        texts_for_embedding = [
            create_chunk_text_for_embedding(chunk) for chunk in all_chunks
        ]
        vectors = await embeddings.create_embeddings_batch(texts_for_embedding)

        all_points = []
        for chunk, vector in zip(all_chunks, vectors):
            chunk_id = make_chunk_id(
                repo_full_name, chunk.file_path, chunk.start_line, chunk.end_line
            )
            point = vectordb.create_point(
                id=chunk_id,
                vector=vector,
                payload={
                    "repo": repo_full_name,
                    "path": chunk.file_path,
                    "content": chunk.content,
                    "chunk_type": chunk.chunk_type,
                    "name": chunk.name or "",
                    "language": chunk.language,
                    "start_line": chunk.start_line,
                    "end_line": chunk.end_line,
                },
            )
            all_points.append(point)

        if all_points:
            vectordb.upsert_embeddings(all_points)

        print(f"Successfully indexed {len(all_points)} chunks for {repo_full_name}")
        await update_indexing_status(repo_full_name, "COMPLETED")
    except Exception as e:
        import traceback
        print(f"Error indexing repository {repo_full_name}: {e}")
        traceback.print_exc()
        await update_indexing_status(repo_full_name, "FAILED")


@inngest_client.create_function(
    fn_id="handle_installation",
    trigger=inngest.TriggerEvent(event="installation/created"),
)
async def handle_installation(ctx: inngest.Context):
    installation_id = str(ctx.event.data["installation_id"])
    account = ctx.event.data["account"]
    repo_name = ctx.event.data.get("repo_name")
    repositories = ctx.event.data.get("repositories", [])

    if repo_name:
        await index_single_repo(installation_id, account, repo_name)

    for repo in repositories:
        r_name = repo.get("name") if isinstance(repo, dict) else repo
        if r_name and r_name != repo_name:
            await index_single_repo(installation_id, account, r_name)
