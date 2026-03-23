import { useState } from 'react';
import { getReliability } from './utils/reliability';

// Backend sends sources as an array of PMID strings
interface SearchResult {
  summary: string;
  sample_size: number | null;
  p_value: number | null;
  hazard_ratio: number | null;
  sources: string[];
}

// ─── Reliability Badge ────────────────────────────────────────────────────────

function ReliabilityBadge({
  p_value,
  sample_size,
}: {
  p_value: number | null;
  sample_size: number | null;
}) {
  const r = getReliability(p_value, sample_size);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${r.bgClass} ${r.colorClass}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.dotClass}`} />
      {r.label}
    </span>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center items-center py-20">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
    </div>
  );
}

// ─── High-Level Insight Box ───────────────────────────────────────────────────

function InsightBox({ result }: { result: SearchResult }) {
  const fmt = (v: number | null, dec: number) =>
    v === null ? 'N/A' : v.toFixed(dec);

  const r = getReliability(result.p_value, result.sample_size);

  const borderColor =
    r.level === 'high'
      ? 'border-emerald-300'
      : r.level === 'moderate'
      ? 'border-amber-300'
      : 'border-slate-300';

  const headerBg =
    r.level === 'high'
      ? 'bg-emerald-50'
      : r.level === 'moderate'
      ? 'bg-amber-50'
      : 'bg-slate-100';

  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden mb-4`}>
      <div className={`px-5 py-3 flex items-center justify-between ${headerBg}`}>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          High-Level Insight
        </span>
        <ReliabilityBadge p_value={result.p_value} sample_size={result.sample_size} />
      </div>
      <div className="bg-white px-5 py-4 grid grid-cols-3 divide-x divide-slate-100">
        <div className="pr-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
            Sample Size
          </p>
          <p className="text-2xl font-bold text-slate-800">
            {result.sample_size !== null ? result.sample_size.toLocaleString() : 'N/A'}
          </p>
        </div>
        <div className="px-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
            Hazard Ratio
          </p>
          <p className="text-2xl font-bold text-slate-800">{fmt(result.hazard_ratio, 2)}</p>
        </div>
        <div className="pl-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
            P-Value
          </p>
          <p className="text-2xl font-bold text-slate-800">{fmt(result.p_value, 4)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Source Mini-Card ─────────────────────────────────────────────────────────

function SourceCard({ pmid, index }: { pmid: string; index: number }) {
  return (
    <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">PMID</p>
          <p className="text-sm font-semibold text-slate-800 font-mono">{pmid}</p>
        </div>
      </div>
      <a
        href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}`}
        target="_blank"
        rel="noreferrer"
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
      >
        View on PubMed
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    </div>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: SearchResult }) {
  return (
    <div className="space-y-4">
      {/* 1. High-Level Insight (metrics + reliability at top) */}
      <InsightBox result={result} />

      {/* 2. Summary */}
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Evidence Summary
        </h2>
        <p className="text-slate-800 leading-relaxed text-sm">{result.summary}</p>
      </div>

      {/* 3. Source Evidence — one mini-card per PMID */}
      {result.sources.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
            Source Evidence · {result.sources.length} paper{result.sources.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-2">
            {result.sources.map((pmid, i) => (
              <SourceCard key={pmid} pmid={pmid} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server error ${res.status}`);
      }

      const data: SearchResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0"
              style={{ minWidth: '2rem', minHeight: '2rem' }}
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ width: '1rem', height: '1rem' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">
                Oncology Evidence Engine
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                NSCLC Clinical Trial Search · RAG-powered
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. pembrolizumab first-line NSCLC overall survival"
            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-700 text-white text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                style={{ minWidth: '1rem', minHeight: '1rem' }}
              />
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ width: '1rem', height: '1rem' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                />
              </svg>
            )}
            Search
          </button>
        </form>

        {/* States */}
        {loading && <Spinner />}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && !loading && <ResultCard result={result} />}

        {!loading && !result && !error && (
          <div className="text-center mt-20">
            <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500">Ready to search</p>
            <p className="text-xs text-slate-400 mt-1">
              Searching across 4,482 NSCLC clinical trial abstracts
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
