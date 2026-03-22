"""
embed_data.py – Load raw abstracts, chunk them, embed with OpenAI,
                and upsert into a local Qdrant collection.
"""

import json
import os
from pathlib import Path
from dotenv import load_dotenv

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from tqdm import tqdm

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()
DATA_PATH      = Path("data/raw_abstracts.json")
QDRANT_URL     = "http://localhost:6333"
COLLECTION     = "lung_cancer_trials"
EMBEDDING_MODEL = "text-embedding-3-small"
VECTOR_SIZE    = 1536          # dimensions for text-embedding-3-small
CHUNK_SIZE     = 500
CHUNK_OVERLAP  = 50
BATCH_SIZE     = 100           # documents per upsert call

# ── 1. Load JSON → Documents ──────────────────────────────────────────────────
print("Loading raw abstracts …")
records = json.loads(DATA_PATH.read_text())

docs: list[Document] = []
for r in tqdm(records, desc="Building documents"):
    abstract = r.get("abstract") or ""
    if not abstract.strip():
        continue
    docs.append(Document(
        page_content=abstract,
        metadata={
            "pmid":    r["pmid"],
            "title":   r["title"],
            "year":    r["year"],
            "authors": ", ".join(r.get("authors") or []),
        },
    ))

print(f"  → {len(docs)} documents with abstracts")

# ── 2. Chunk ──────────────────────────────────────────────────────────────────
print("Chunking …")
splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
)
chunks = splitter.split_documents(docs)
print(f"  → {len(chunks)} chunks")

# ── 3. Embeddings client ──────────────────────────────────────────────────────
embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)

# ── 4. Qdrant: create / recreate collection ───────────────────────────────────
print(f"Connecting to Qdrant at {QDRANT_URL} …")
client = QdrantClient(url=QDRANT_URL)

existing = [c.name for c in client.get_collections().collections]
if COLLECTION in existing:
    print(f"  Collection '{COLLECTION}' exists – recreating …")
    client.delete_collection(COLLECTION)

client.create_collection(
    collection_name=COLLECTION,
    vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
)
print(f"  Collection '{COLLECTION}' created.")

# ── 5. Upsert in batches ──────────────────────────────────────────────────────
print("Embedding and upserting …")
vector_store = QdrantVectorStore(
    client=client,
    collection_name=COLLECTION,
    embedding=embeddings,
)

for i in tqdm(range(0, len(chunks), BATCH_SIZE), desc="Upserting batches"):
    batch = chunks[i : i + BATCH_SIZE]
    vector_store.add_documents(batch)

# ── 6. Verify ─────────────────────────────────────────────────────────────────
count = client.count(COLLECTION).count
print(f"\nDone. '{COLLECTION}' contains {count} vectors.")
