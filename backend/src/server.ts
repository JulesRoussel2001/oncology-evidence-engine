import dotenv from "dotenv";
dotenv.config({ override: true }); // .env always wins over shell environment
import express, { Request, Response } from "express";
import cors from "cors";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { QdrantClient } from "@qdrant/js-client-rest";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());

const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const COLLECTION = "lung_cancer_trials";
const PORT = process.env.PORT ?? 3000;

// ── Structured output schema ────────────────────────────────────────────────
const SearchResultSchema = z.object({
  summary: z.string().describe("A concise summary of the findings from the retrieved abstracts."),
  sample_size: z
    .string()
    .nullable()
    .describe("The sample size reported in the study (e.g. 'n=450'). Null if not mentioned."),
  p_value: z
    .string()
    .nullable()
    .describe("The p-value reported (e.g. 'p=0.003'). Null if not mentioned."),
  hazard_ratio: z
    .string()
    .nullable()
    .describe("The hazard ratio reported (e.g. 'HR=0.72'). Null if not mentioned."),
  sources: z
    .array(z.string())
    .describe("Array of PMIDs of the abstracts used to answer the question."),
});

type SearchResult = z.infer<typeof SearchResultSchema>;

// ── Clients (initialised lazily so startup always succeeds) ─────────────────
const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const llm = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0,
});

const structuredLlm = llm.withStructuredOutput(SearchResultSchema);

const qdrant = new QdrantClient({ url: QDRANT_URL });

// ── POST /api/search ────────────────────────────────────────────────────────
app.post("/api/search", async (req: Request, res: Response): Promise<void> => {
  const { query } = req.body as { query?: string };

  if (!query || typeof query !== "string" || query.trim() === "") {
    res.status(400).json({ error: "A non-empty 'query' string is required." });
    return;
  }

  try {
    // 1. Embed the user query
    const queryVector = await embeddings.embedQuery(query.trim());

    // 2. Retrieve top-5 closest chunks from Qdrant
    const searchResult = await qdrant.search(COLLECTION, {
      vector: queryVector,
      limit: 5,
      with_payload: true,
    });

    // 3. Build context from retrieved chunks
    const contextChunks = searchResult
      .map((hit, i) => {
        const p = hit.payload as Record<string, unknown>;
        // LangChain stores chunk text in page_content and metadata in metadata.*
        const meta = (p?.metadata ?? p) as Record<string, unknown>;
        const pmid = String(meta?.pmid ?? "unknown");
        const title = String(meta?.title ?? "");
        const year = String(meta?.year ?? "");
        const text = String(p?.page_content ?? p?.text ?? p?.chunk ?? p?.content ?? "");
        return `[${i + 1}] PMID: ${pmid} | Year: ${year} | Title: ${title}\n${text}`;
      })
      .join("\n\n---\n\n");

    const pmids = searchResult.map((hit) => {
      const p = hit.payload as Record<string, unknown>;
      const meta = (p?.metadata ?? p) as Record<string, unknown>;
      return String(meta?.pmid ?? "unknown");
    });

    // 4. Construct the prompt
    const prompt = `You are a clinical research assistant specialising in oncology. \
Answer the question below using ONLY the provided abstracts. \
Extract any reported statistical data (sample size, p-value, hazard ratio) from the text.

QUESTION: ${query}

RETRIEVED ABSTRACTS:
${contextChunks}

Available source PMIDs: ${pmids.join(", ")}

Respond with a structured JSON object containing:
- summary: concise answer to the question
- sample_size: extracted sample size or null
- p_value: extracted p-value or null
- hazard_ratio: extracted hazard ratio or null
- sources: array of PMID strings you actually used`;

    // 5. Call Claude with structured output
    const result: SearchResult = await structuredLlm.invoke(prompt);

    res.json(result);
  } catch (err) {
    console.error("Error in /api/search:", err);
    res.status(500).json({ error: "Internal server error.", detail: String(err) });
  }
});

// ── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
