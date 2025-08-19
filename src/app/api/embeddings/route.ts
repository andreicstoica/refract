import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { generateEmbeddingVectors } from "@/services/embeddingsClient";
import {
  clusterEmbeddings,
  sentencesToChunks,
} from "@/utils/embeddingUtils";
import type { Sentence } from "@/types/sentence";
import type { TextChunk, ClusterResult } from "@/types/embedding";

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

const ComprehensiveThemeSchema = z.object({
  themes: z.array(z.object({
    clusterId: z.string(),
    label: z.string(),
    description: z.string(),
    confidence: z.number(),
    color: z.string(),
    intensity: z.number(),
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
    const embeddingResult = await generateEmbeddingVectors(chunks);

    // Step 3: Cluster embeddings (default to 3 clusters, adjust based on content)
    const numClusters = Math.min(3, Math.max(2, Math.floor(chunks.length / 3)));
    const clusters = clusterEmbeddings(
      embeddingResult.chunks,
      embeddingResult.embeddings,
      numClusters
    );

    console.log(`📊 Created ${clusters.length} clusters from ${chunks.length} chunks`);

    // Step 4: Generate rich theme data with AI
    const themeData = await generateComprehensiveThemes(clusters, fullText);

    // Step 5: Enrich clusters with AI-generated theme data
    const enrichedClusters = clusters.map((cluster, index) => {
      const theme = themeData.find(t => t.clusterId === cluster.id);
      return {
        ...cluster,
        label: theme?.label || cluster.label,
        description: theme?.description || "",
        confidence: Math.min(cluster.confidence, theme?.confidence || 0.5),
        color: theme?.color || "#3b82f6",
        intensity: theme?.intensity || 0.5,
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
        description: c.description || "",
        confidence: c.confidence,
        chunkCount: c.chunks.length,
        color: c.color,
        intensity: c.intensity,
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

/**
 * Generate comprehensive theme data using AI with deduplication
 */
async function generateComprehensiveThemes(
  clusters: ClusterResult[],
  fullText?: string
): Promise<Array<{ clusterId: string; label: string; description: string; confidence: number; color: string; intensity: number }>> {
  if (clusters.length === 0) return [];

  try {
    // Prepare cluster summaries for the AI
    const clusterSummaries = clusters.map((cluster, index) => ({
      id: cluster.id,
      index: index + 1,
      texts: cluster.chunks.map(chunk => chunk.text).slice(0, 6),
      chunkCount: cluster.chunks.length,
    }));

    console.log("📝 Sending to AI:", {
      clustersCount: clusters.length,
      clusterSummaries: clusterSummaries.map(c => ({
        index: c.index,
        textCount: c.texts.length,
        firstText: c.texts[0],
        chunkCount: c.chunkCount
      })),
      fullTextLength: fullText?.length || 0
    });

    const result = await generateObject({
      model: openai("gpt-5-turbo"),
      system: `Create meaningful theme labels for personal writing clusters.

REQUIREMENTS:
1. Each theme must have a UNIQUE label - never duplicate
2. Labels should be 2-4 words and specific to content  
3. Use exact hex colors: #3B82F6 #8B5CF6 #10B981 #F59E0B #EF4444 #EC4899
4. Set intensity 0.3 to 1.0 based on emotional weight
5. Return valid JSON matching the schema

EXAMPLES:
- "Work Stress" #EF4444 intensity 0.8
- "Creative Ideas" #8B5CF6 intensity 0.7  
- "Family Time" #EC4899 intensity 0.6
- "Daily Routine" #3B82F6 intensity 0.4

Make each theme unique and meaningful based on the text content.`,

      prompt: `${fullText ? `FULL WRITING CONTEXT:\n${fullText}\n\n` : ''}
CLUSTERS TO ANALYZE:
${clusterSummaries.map((cluster) =>
        `Cluster ${cluster.index} (${cluster.chunkCount} segments):
${cluster.texts.join('\n')}
`
      ).join('\n')}

Generate unique, engaging themes for each cluster. Focus on what makes each cluster distinct. Choose appropriate colors and intensity levels based on the emotional content and importance of each theme.`,

      schema: ComprehensiveThemeSchema,
    });

    console.log("🎨 Generated comprehensive themes:", result.object.themes);

    // Map themes back to cluster IDs
    return result.object.themes.map((theme, index) => ({
      clusterId: clusters[index]?.id || `cluster-${index}`,
      label: theme.label,
      description: theme.description,
      confidence: theme.confidence,
      color: theme.color,
      intensity: theme.intensity,
    }));

  } catch (error) {
    console.error("❌ Theme generation failed - detailed error:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      clustersLength: clusters.length,
      hasFullText: !!fullText
    });

    // Enhanced fallback with better variety
    const fallbackColors = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];
    const fallbackThemes = clusters.map((cluster, index) => ({
      clusterId: cluster.id,
      label: `Theme ${index + 1}`,
      description: "A collection of related thoughts",
      confidence: 0.5,
      color: fallbackColors[index % fallbackColors.length],
      intensity: 0.6,
    }));

    console.log("🔄 Using fallback themes:", fallbackThemes);
    return fallbackThemes;
  }
}