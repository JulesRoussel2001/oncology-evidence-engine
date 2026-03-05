"""
Fetches NSCLC clinical trial abstracts from PubMed via Biopython (Entrez).

Usage:
    python fetch_pubmed_data.py

Output:
    data/raw_abstracts.json  – list of dicts with keys:
        pmid, title, year, authors, abstract
"""

import json
import os
import sys
import time
from pathlib import Path

from Bio import Entrez
from tqdm import tqdm

# ── Configuration ──────────────────────────────────────────────────────────────
QUERY = "Non-Small Cell Lung Cancer clinical trial"
MAX_RESULTS = 1_000
BATCH_SIZE = 100          # records per efetch call (PubMed max is 10,000, but smaller = safer)
RATE_DELAY = 0.34         # seconds between requests (~3 req/s; NCBI limit without API key)
OUTPUT_PATH = Path("data/raw_abstracts.json")

# NCBI requires a valid e-mail address
Entrez.email = "fetch_pubmed@oncology-evidence-engine.local"
# ──────────────────────────────────────────────────────────────────────────────


def search_pmids(query: str, max_results: int) -> list[str]:
    """Return up to *max_results* PMIDs sorted by most-recent first."""
    handle = Entrez.esearch(
        db="pubmed",
        term=query,
        retmax=max_results,
        sort="most recent",
    )
    record = Entrez.read(handle)
    handle.close()
    return record["IdList"]


def fetch_records_batch(pmids: list[str]) -> list[dict]:
    """Fetch and parse a batch of PubMed records; skip those without abstracts."""
    ids = ",".join(pmids)
    handle = Entrez.efetch(db="pubmed", id=ids, rettype="xml", retmode="xml")
    records = Entrez.read(handle)
    handle.close()

    results = []
    for article in records["PubmedArticle"]:
        medline = article["MedlineCitation"]
        art = medline["Article"]

        # ── Abstract ──────────────────────────────────────────────────────────
        abstract_texts = art.get("Abstract", {}).get("AbstractText", [])
        if not abstract_texts:
            continue  # exclude papers with no abstract

        # AbstractText can be a list of StringElement objects or a plain string
        if isinstance(abstract_texts, list):
            abstract = " ".join(str(s) for s in abstract_texts).strip()
        else:
            abstract = str(abstract_texts).strip()

        if not abstract:
            continue

        # ── PMID ──────────────────────────────────────────────────────────────
        pmid = str(medline["PMID"])

        # ── Title ─────────────────────────────────────────────────────────────
        title = str(art.get("ArticleTitle", "")).strip()

        # ── Publication year ──────────────────────────────────────────────────
        pub_date = art.get("Journal", {}).get("JournalIssue", {}).get("PubDate", {})
        year = str(pub_date.get("Year", pub_date.get("MedlineDate", "Unknown")))

        # ── Authors ───────────────────────────────────────────────────────────
        author_list = art.get("AuthorList", [])
        authors = []
        for author in author_list:
            last = author.get("LastName", "")
            fore = author.get("ForeName", "")
            name = f"{last}, {fore}".strip(", ")
            if name:
                authors.append(name)

        results.append(
            {
                "pmid": pmid,
                "title": title,
                "year": year,
                "authors": authors,
                "abstract": abstract,
            }
        )

    return results


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # ── Step 1: retrieve PMIDs ────────────────────────────────────────────────
    print(f"Searching PubMed for: '{QUERY}' (up to {MAX_RESULTS} results)…")
    pmids = search_pmids(QUERY, MAX_RESULTS)
    print(f"Found {len(pmids)} PMIDs. Fetching records in batches of {BATCH_SIZE}…")

    # ── Step 2: fetch in batches ──────────────────────────────────────────────
    all_records: list[dict] = []
    batches = [pmids[i : i + BATCH_SIZE] for i in range(0, len(pmids), BATCH_SIZE)]

    with tqdm(total=len(pmids), unit="record", desc="Fetching abstracts") as pbar:
        for batch in batches:
            success = False
            for attempt in range(1, 4):           # up to 3 retries
                try:
                    records = fetch_records_batch(batch)
                    all_records.extend(records)
                    pbar.update(len(batch))
                    time.sleep(RATE_DELAY)
                    success = True
                    break
                except Exception as exc:           # noqa: BLE001
                    wait = attempt * 5
                    tqdm.write(f"  [warn] Batch failed (attempt {attempt}/3): {exc!r} – retrying in {wait}s")
                    time.sleep(wait)

            if not success:
                tqdm.write(f"  [error] Skipping batch of {len(batch)} PMIDs after 3 failed attempts.")

    # ── Step 3: persist ───────────────────────────────────────────────────────
    OUTPUT_PATH.write_text(json.dumps(all_records, indent=2, ensure_ascii=False))

    print(
        f"\nDone. Saved {len(all_records)} records with abstracts "
        f"(excluded {len(pmids) - len(all_records)} without) → {OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
