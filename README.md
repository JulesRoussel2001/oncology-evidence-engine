# 🧬 Oncology RAG Engine: Clinical Trial Data Extraction

An end-to-end Retrieval-Augmented Generation (RAG) architecture designed to accelerate clinical trial analysis for Non-Small Cell Lung Cancer. This system automates the ingestion, embedding, and LLM-based extraction of critical medical data (Sample sizes, p-values, Hazard Ratios) from unstructured PubMed abstracts.

### 🛠️ Tech Stack & Architecture
* **Data Ingestion:** Python/Biopython pipeline pulling 1,000+ abstracts via the PubMed API.
* **Vector Database:** Qdrant DB for semantic search, utilizing OpenAI `text-embedding-3-small` with recursive character chunking.
* **Backend Orchestration:** Node.js/Express (TypeScript) integrating Claude 3.5 Sonnet for structured JSON extraction based on top-k vector matches.
* **Frontend Interface:** High-speed React/Vite dashboard (Tailwind CSS) featuring dynamic "Reliability Score" visualization.
* **DevOps & Deployment:** Fully containerized using Multi-stage Dockerfiles and `docker-compose`. Configured for AWS ECR and App Runner deployment via GitHub Actions CI/CD.

### 👨‍💻 Author
**Jules Roussel** - *MSc Machine Learning & Data Science @ UCL*
