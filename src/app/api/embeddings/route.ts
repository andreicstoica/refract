import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import {
  generateEmbeddings,
  clusterEmbeddings,
  sentencesToChunks,
  type TextChunk,
  type ClusterResult
} from "@/lib/embeddingUtils";
import type { Sentence } from "@/lib/sentenceUtils";

export const maxDuration = 30; // Embeddings can take longer than prods

const EmbeddingsRequestSchema = z.object({
  sentences: z.array(z.object({
    id: z.string(),
    text: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
  })),
  fullText: z.string().optional(),
});

const ThemeLabelSchema = z.object({
  themes: z.array(z.object({
    clusterId: z.string(),
    label: z.string().max(30).describe("Concise theme name, 2-4 words"),
    description: z.string().max(100).describe("Brief description of the theme"),
    confidence: z.number().min(0).max(1).describe("Confidence in theme quality"),
  })),
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

    console.log(`🎯 Generating embeddings for ${sentences.length} sentences`);

    // Step 1: Convert sentences to chunks
    const chunks = sentencesToChunks(sentences);

    // Step 2: Generate embeddings
    const embeddingResult = await generateEmbeddings(chunks);

    // Step 3: Cluster embeddings (default to 3 clusters, adjust based on content)
    const numClusters = Math.min(3, Math.max(2, Math.floor(chunks.length / 3)));
    const clusters = clusterEmbeddings(
      embeddingResult.chunks,
      embeddingResult.embeddings,
      numClusters
    );

    console.log(`📊 Created ${clusters.length} clusters from ${chunks.length} chunks`);

    // Step 4: Generate meaningful theme labels using LLM
    const themeLabels = await generateThemeLabels(clusters, fullText);

    // Step 5: Merge cluster data with theme labels
    const enrichedClusters = clusters.map(cluster => {
      const themeLabel = themeLabels.find(t => t.clusterId === cluster.id);
      return {
        ...cluster,
        label: themeLabel?.label || cluster.label,
        description: themeLabel?.description || "",
        confidence: Math.min(cluster.confidence, themeLabel?.confidence || 0.5),
      };
    });

    // Sort clusters by confidence and chunk count
    const sortedClusters = enrichedClusters
      .sort((a, b) => (b.confidence * b.chunks.length) - (a.confidence * a.chunks.length))
      .slice(0, 3); // Return top 3 themes

    return Response.json({
      clusters: sortedClusters,
      themes: sortedClusters.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description,
        confidence: c.confidence,
        chunkCount: c.chunks.length,
        chunks: c.chunks.map(chunk => ({
          text: chunk.text,
          sentenceId: chunk.sentenceId,
        })),
      })),
      usage: embeddingResult.usage,
      debug: {
        totalSentences: sentences.length,
        totalClusters: clusters.length,
        finalClusters: sortedClusters.length,
      },
    });

  } catch (error) {
    console.error("❌ Embeddings API error:", error);

    if (error instanceof z.ZodError) {
      return Response.json({
        error: "Invalid request format",
        details: error.errors,
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

/**
 * Generate meaningful theme labels for clusters using LLM
 */
async function generateThemeLabels(
  clusters: ClusterResult[],
  fullText?: string
): Promise<Array<{ clusterId: string; label: string; description: string; confidence: number }>> {
  if (clusters.length === 0) return [];

  try {
    // Prepare cluster summaries for the LLM
    const clusterSummaries = clusters.map(cluster => ({
      id: cluster.id,
      texts: cluster.chunks.map(chunk => chunk.text).slice(0, 5), // Limit to 5 representative texts
      chunkCount: cluster.chunks.length,
    }));

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      system: `You are a thoughtful analyst who identifies themes in reflective writing.

TASK: Generate concise, meaningful theme labels for text clusters from a journal entry.

REQUIREMENTS:
- Create 2-4 word theme labels that capture the essence of each cluster
- Provide brief descriptions explaining what the theme represents
- Assign confidence scores based on how coherent and meaningful each theme is
- Focus on emotional, conceptual, or topical patterns rather than literal content

EXAMPLES:
- "Work Stress" for texts about deadlines, pressure, workload
- "Personal Growth" for texts about learning, self-reflection, improvement
- "Relationships" for texts about family, friends, social connections
- "Future Planning" for texts about goals, aspirations, decisions

Be insightful but concise. Avoid generic labels like "Theme 1" or overly specific ones.`,
      prompt: `${fullText ? `FULL CONTEXT:\n${fullText}\n\n` : ''}CLUSTERS TO LABEL:\n${clusterSummaries.map((cluster, i) =>
        `Cluster ${i + 1} (${cluster.chunkCount} texts):\n${cluster.texts.join('\n')}\n`
      ).join('\n')
        }\n\nGenerate theme labels for these clusters:`,
      schema: ThemeLabelSchema,
    });

    // Map back to cluster IDs
    return result.object.themes.map((theme, index) => ({
      clusterId: clusters[index]?.id || `cluster-${index}`,
      label: theme.label,
      description: theme.description,
      confidence: theme.confidence,
    }));

  } catch (error) {
    console.error("❌ Theme labeling failed:", error);
    // Return fallback labels
    return clusters.map((cluster, index) => ({
      clusterId: cluster.id,
      label: `Theme ${index + 1}`,
      description: "A collection of related thoughts",
      confidence: 0.5,
    }));
  }
}