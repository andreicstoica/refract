"use client";

import type { Prod } from "@/types/prod";
import type { Sentence } from "@/types/sentence";
import type { SentencePosition } from "@/types/sentence";

interface QueueState {
  items: Array<{ status: string }>;
  isProcessing: boolean;
}

interface TextInputDebugProps {
  text: string;
  filteredSentences: Sentence[];
  prods: Prod[];
  queueState: QueueState;
  sentencePositions: SentencePosition[];
  onClearQueue: () => void;
  prodMetrics?: { durations: number[]; slowCount: number; last: number | null };
}

export function TextInputDebug({
  text,
  filteredSentences,
  prods,
  queueState,
  sentencePositions,
  onClearQueue,
  prodMetrics,
}: TextInputDebugProps) {
  // Only show in development
  if (process.env.NODE_ENV === "production") return null;

  const durs = prodMetrics?.durations ?? [];
  const last5 = durs.slice(-5);
  const stats = (() => {
    if (!durs.length) return null;
    const sorted = [...durs].sort((a, b) => a - b);
    const min = Math.round(sorted[0]);
    const max = Math.round(sorted[sorted.length - 1]);
    const mid = Math.floor(sorted.length / 2);
    const p50 = Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
    return { min, p50, max };
  })();

  return (
    <div className="absolute bottom-2 right-2 z-50 text-xs opacity-70 bg-background/80 p-2 rounded max-w-xs">
      <div>📏 Text length: {text.length}</div>
      <div>💾 Cached sentences: {filteredSentences.length}</div>
      <div>🤖 AI Status:</div>
      <div className="ml-2">prodsCount: {prods.length}</div>
      <div className="ml-2">queueLength: {queueState.items.length}</div>
      <div className="ml-2">
        isProcessing: {queueState.isProcessing ? "yes" : "no"}
      </div>
      <div className="ml-2 text-blue-400">
        pending: {queueState.items.filter((i) => i.status === "pending").length}
        , processing:{" "}
        {queueState.items.filter((i) => i.status === "processing").length}
      </div>
      <div className="ml-2">
        <button
          onClick={onClearQueue}
          className="text-xs px-1 py-0.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40"
        >
          Clear Queue
        </button>
      </div>
      <div>⏱️ Prod timings:</div>
      <div className="ml-2">
        last: {prodMetrics?.last ? Math.round(prodMetrics.last) : 0}ms,
        slow(≥5s): {prodMetrics?.slowCount ?? 0}
      </div>
      {stats && (
        <div className="ml-2">min/p50/max: {stats.min} / {stats.p50} / {stats.max} ms</div>
      )}
      {last5.length > 0 && (
        <div className="ml-2">last5: {last5.map((x) => Math.round(x)).join(", ")} ms</div>
      )}
      <div>💡 Current prods:</div>
      <div className="ml-2 space-y-1">
        {prods.map((prod) => (
          <div
            key={prod.id}
            className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs mr-1 mb-1"
          >
            {prod.text}
          </div>
        ))}
      </div>
      <div>📍 Sentence positions: {sentencePositions.length}</div>
      <div className="ml-2 space-y-1">
        {sentencePositions.map((pos) => (
          <div
            key={pos.sentenceId}
            className="inline-block bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded text-xs mr-1 mb-1"
          >
            {pos.sentenceId}: {pos.top},{pos.left}
          </div>
        ))}
      </div>
    </div>
  );
}
