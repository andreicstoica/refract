import { z } from "zod";
import { clusterEmbeddings, sentencesToChunks } from "@/lib/clustering";
import { debug } from "@/lib/debug";
import { generateEmbeddingVectors } from "@/features/themes/services/embeddingGenerator";
import { generateThemesForClusters } from "@/features/themes/services/themeGenerator";
import {
  enrichClustersWithThemes,
  selectTopClusters,
  formatClustersForResponse,
} from "@/features/themes/services/clusterEnrichment";

export const maxDuration = 40;

const EmbeddingsRequestSchema = z.object({
  sentences: z.array(z.object({
    id: z.string(),
    text: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
  })),
  fullText: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sentences, fullText } = EmbeddingsRequestSchema.parse(body);

    if (sentences.length === 0) {
      return Response.json({
        error: "No sentences provided",
        clusters: [],
        themes: [],
        usage: { tokens: 0, cost: 0 },
      }, { status: 400 });
    }

    debug.dev(`🎯 Processing ${sentences.length} sentences`);

    // Convert sentences to chunks
    const chunks = sentencesToChunks(sentences);

    // Generate embeddings from OpenAI
    const embeddingResult = await generateEmbeddingVectors(chunks);

    // Cluster embeddings using k-means
    const numClusters = Math.min(3, Math.max(2, Math.floor(chunks.length / 3)));
    const clusters = clusterEmbeddings(
      embeddingResult.chunks,
      embeddingResult.embeddings,
      numClusters
    );

    debug.dev(`📊 Created ${clusters.length} clusters from ${chunks.length} chunks`);

    // Generate AI themes for clusters
    const themeData = await generateThemesForClusters(clusters, fullText);

    // Enrich clusters with theme data and select top 3
    const enrichedClusters = enrichClustersWithThemes(clusters, themeData);
    const topClusters = selectTopClusters(enrichedClusters, 3);

    // Format for response
    const themes = formatClustersForResponse(topClusters);

    return Response.json({
      clusters: topClusters,
      themes,
      usage: embeddingResult.usage,
    });

  } catch (error) {
    debug.error("❌ Embeddings API error:", error);

    if (error instanceof z.ZodError) {
      return Response.json({
        error: "Invalid request format",
        details: error.issues,
      }, { status: 400 });
    }

    return Response.json({
      error: "Failed to generate embeddings",
      clusters: [],
      themes: [],
      usage: { tokens: 0, cost: 0 },
    }, { status: 500 });
  }
}
