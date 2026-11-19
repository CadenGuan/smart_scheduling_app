import os
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional

DEFAULT_CHROMA_PATH = os.path.join(
    Path(__file__).resolve().parents[1], "data", "chroma_db"
)
COLLECTION_NAME = "degree_requirements"
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"
VECTOR_DIM = 384


class MockEmbeddingFunction:
    """
    Deterministic pseudo-embedding function for fast, offline testing.
    Produces normalized 384-dimensional vectors based on word hashes.
    """
    def __init__(self, dim: int = VECTOR_DIM):
        self.dim = dim

    def name(self) -> str:
        return "mock_embedding"

    def embed_query(self, input: Any) -> Any:
        return self(input)

    def embed_documents(self, input: Any) -> Any:
        return self(input)

    def __call__(self, input: Any) -> Any:
        texts = [input] if isinstance(input, str) else input
        embeddings = []
        for text in texts:
            words = text.lower().split()
            vec = [0.0] * self.dim
            for w in words:
                h = int(hashlib.md5(w.encode("utf-8")).hexdigest(), 16) % self.dim
                vec[h] += 1.0
            # Normalize vector
            norm = sum(x * x for x in vec) ** 0.5
            if norm > 0:
                vec = [x / norm for x in vec]
            embeddings.append(vec)
        return embeddings if not isinstance(input, str) else embeddings[0]


def is_mock_embedding_active() -> bool:
    """Returns True if mock embedding mode is requested via environment."""
    return os.environ.get("USE_MOCK_EMBEDDINGS", "false").lower() in ("true", "1", "t")


def get_embedding_function(force_mock: bool = False):
    """
    Returns the real BAAI/bge-small-en-v1.5 embedding function or the mock fallback.
    """
    if force_mock or is_mock_embedding_active():
        return MockEmbeddingFunction()

    try:
        from chromadb.utils import embedding_functions
        return embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL_NAME
        )
    except Exception:
        # Gracefully fall back to deterministic mock if download fails or offline
        return MockEmbeddingFunction()


def get_chroma_client(db_path: Optional[str] = None):
    """Initializes and returns a persistent ChromaDB client."""
    import chromadb
    path = db_path or DEFAULT_CHROMA_PATH
    os.makedirs(path, exist_ok=True)
    return chromadb.PersistentClient(path=path)


def get_or_create_collection(
    name: str = COLLECTION_NAME,
    db_path: Optional[str] = None,
    force_mock: bool = False,
):
    """Retrieves or creates the degree requirements collection in ChromaDB."""
    client = get_chroma_client(db_path)
    emb_fn = get_embedding_function(force_mock=force_mock)
    return client.get_or_create_collection(name=name, embedding_function=emb_fn)


def add_degree_chunks(
    chunks: List[Dict[str, Any]],
    collection=None,
    db_path: Optional[str] = None,
    force_mock: bool = False,
) -> int:
    """
    Adds degree text chunks with rich metadata to ChromaDB.
    Each chunk dict must have: id, text, degree_title, concentration, section_heading, url.
    """
    if not chunks:
        return 0

    col = collection or get_or_create_collection(db_path=db_path, force_mock=force_mock)
    
    ids = []
    documents = []
    metadatas = []

    for c in chunks:
        cid = str(c["id"])
        text = str(c["text"]).strip()
        meta = {
            "degree_title": str(c.get("degree_title", "")).strip(),
            "concentration": str(c.get("concentration", "General")).strip(),
            "section_heading": str(c.get("section_heading", "")).strip(),
            "url": str(c.get("url", "")).strip(),
            "chunk_index": int(c.get("chunk_index", 0)),
        }
        ids.append(cid)
        documents.append(text)
        metadatas.append(meta)

    col.upsert(ids=ids, documents=documents, metadatas=metadatas)
    return len(ids)


def query_degree_chunks(
    query: str,
    major: str = "",
    concentration: str = "",
    n_results: int = 3,
    collection=None,
    db_path: Optional[str] = None,
    force_mock: bool = False,
) -> List[Dict[str, Any]]:
    """
    Queries ChromaDB for degree requirements matching the query text,
    optionally filtering by major and concentration.
    """
    col = collection or get_or_create_collection(db_path=db_path, force_mock=force_mock)

    where_filter: Optional[Dict[str, Any]] = None
    conditions = []
    if major:
        conditions.append({"degree_title": major.strip()})
    if concentration:
        conditions.append({"concentration": concentration.strip()})

    if len(conditions) == 1:
        where_filter = conditions[0]
    elif len(conditions) > 1:
        where_filter = {"$and": conditions}

    query_args: Dict[str, Any] = {
        "query_texts": [query.strip()],
        "n_results": n_results,
    }
    if where_filter:
        query_args["where"] = where_filter

    results = col.query(**query_args)

    formatted = []
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    ids = results.get("ids", [[]])[0]
    dists = results.get("distances", [[]])[0] if "distances" in results else [0.0] * len(docs)

    for i in range(len(docs)):
        formatted.append({
            "id": ids[i],
            "document": docs[i],
            "metadata": metas[i] if i < len(metas) else {},
            "distance": dists[i] if i < len(dists) else 0.0,
        })
    return formatted
