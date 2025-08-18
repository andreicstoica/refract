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
}

export function TextInputDebug({
  text,
  filteredSentences,
  prods,
  queueState,
  sentencePositions,
  onClearQueue,
}: TextInputDebugProps) {
  // Only show in development
  if (process.env.NODE_ENV === "production") return null;

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
