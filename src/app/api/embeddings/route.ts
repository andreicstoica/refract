import { openai } from "@ai-sdk/openai";
import { embedMany, generateObject } from "ai";
import { z } from "zod";
import { MIN_CHUNK_CORRELATION } from "@/lib/highlight";
import { clusterEmbeddings, sentencesToChunks } from "@/lib/embeddings";
import { debug } from "@/lib/debug";
import type { ClusterResult, EmbeddingResult, TextChunk } from "@/types/embedding";

type OpenAIModelId = Parameters<typeof openai>[0];

export const maxDuration = 40;
const THEME_MODEL = (process.env.OPENAI_THEME_MODEL || "gpt-5") as OpenAIModelId;

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
    theme: z.string().max(30, "Theme label must be 30 characters or less"),
    description: z.string(),
    confidence: z.number(),
    color: z.string(),
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

    debug.dev(`🎯 Generating embeddings for ${sentences.length} sentences`);

    const chunks = sentencesToChunks(sentences);

    const embeddingResult = await generateEmbeddingVectors(chunks);

    const numClusters = Math.min(3, Math.max(2, Math.floor(chunks.length / 3)));
    const clusters = clusterEmbeddings(
      embeddingResult.chunks,
      embeddingResult.embeddings,
      numClusters
    );

    debug.dev(`📊 Created ${clusters.length} clusters from ${chunks.length} chunks`);

    const themeData = await generateComprehensiveThemes(clusters, fullText);

    const enrichedClusters = clusters.map((cluster, index) => {
      const theme = themeData.find(t => t.clusterId === cluster.id);
      return {
        ...cluster,
        label: theme?.label || cluster.label,
        description: theme?.description || "",
        confidence: Math.min(cluster.confidence, theme?.confidence || 0.5),
        color: theme?.color || "#3b82f6",
      };
    });

    const sortedClusters = enrichedClusters
      .sort((a, b) => (b.confidence * b.chunks.length) - (a.confidence * a.chunks.length))
      .slice(0, 3); // UI renders three themes max

    return Response.json({
      clusters: sortedClusters,
      themes: sortedClusters.map(c => {
        const filtered = c.chunks.filter(ch => typeof ch.correlation === "number" && ch.correlation! >= MIN_CHUNK_CORRELATION);
        return {
          id: c.id,
          label: c.label,
          description: c.description || "",
          confidence: c.confidence,
          chunkCount: filtered.length,
          color: c.color,
          chunks: filtered.map(ch => ({
            text: ch.text,
            sentenceId: ch.sentenceId,
            correlation: ch.correlation as number,
          })),
        };
      }),
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

/**
 * Generate comprehensive theme data using AI with improved prompt engineering
 */
async function generateComprehensiveThemes(
  clusters: ClusterResult[],
  fullText?: string
): Promise<Array<{ clusterId: string; label: string; description: string; confidence: number; color: string }>> {
  if (clusters.length === 0) return [];

  try {
    // Send compact summaries so prompts stay under token budget
    const clusterSummaries = clusters.map((cluster, index) => ({
      id: cluster.id,
      index: index + 1,
      texts: cluster.chunks.map(chunk => chunk.text).slice(0, 6),
      chunkCount: cluster.chunks.length,
    }));

    debug.dev("📝 Sending to AI:", {
      clustersCount: clusters.length,
      clusterSummaries: clusterSummaries.map(c => ({
        index: c.index,
        textCount: c.texts.length,
        firstText: c.texts[0],
        chunkCount: c.chunkCount
      })),
      fullTextLength: fullText?.length || 0
    });

    // System prompt encodes UI constraints (label length/uniqueness) up front
    const systemPrompt = `You are an expert at analyzing personal writing and creating meaningful thematic categorizations. Your task is to generate distinct, emotionally resonant theme labels for clusters of personal writing segments.

## Core Requirements

**CRITICAL: Theme labels must be 30 characters or less** - this is a hard requirement for UI display. Examples of good labels:
- "Creative Flow" (13 chars)
- "Self-Doubt & Growth" (18 chars) 
- "Connection & Belonging" (22 chars)
- "Work-Life Balance" (17 chars)
- "Inner Peace" (11 chars)

**Avoid labels that are too long:**
- "The struggle between work responsibilities and personal relationships" (too long!)
- "Complex emotions around career advancement and family time" (too long!)

**Uniqueness**: Each theme label must be completely unique - no duplicates or similar variations allowed.

**Specificity**: Labels should be 2-4 words that capture the essence of what makes each cluster distinct from others. Avoid generic terms.

**Emotional Resonance**: Choose labels that reflect the emotional tone and significance of the content, not just surface topics.

Choose labels that are:
- Concise but descriptive
- Emotionally resonant
- Easy to understand at a glance
- Under 30 characters

## Technical Specifications

**Colors**: Choose any hex color that best represents the emotional tone and significance of each theme. Consider color psychology and emotional associations. Here are some examples to guide your choices:

- \`#3B82F6\` (Blue) - Daily life, routine, neutral reflection, calmness
- \`#8B5CF6\` (Purple) - Creativity, dreams, aspirations, spirituality
- \`#10B981\` (Green) - Growth, positive experiences, achievements, nature
- \`#F59E0B\` (Amber) - Important memories, significant moments, warmth
- \`#EF4444\` (Red) - Stress, challenges, intense emotions, passion
- \`#EC4899\` (Pink) - Relationships, love, personal connections, tenderness
- \`#06B6D4\` (Cyan) - Clarity, insight, intellectual pursuits
- \`#84CC16\` (Lime) - Energy, optimism, new beginnings
- \`#F97316\` (Orange) - Enthusiasm, adventure, social connections
- \`#6366F1\` (Indigo) - Depth, introspection, wisdom
- \`#A855F7\` (Violet) - Imagination, mystery, transformation
- \`#14B8A6\` (Teal) - Balance, harmony, emotional stability

Feel free to use any hex color that feels right for the theme's emotional resonance. Consider using softer pastels for gentle themes, vibrant colors for intense emotions, or muted tones for reflective content. 
Make sure that the colors are not too similar to each other for good visual contrast.

**Confidence Scale** (0.1-1.0):
- 0.7-1.0: Very clear theme with strong coherence
- 0.5-0.7: Moderately clear theme with some variation
- 0.3-0.5: Somewhat clear theme but more abstract
- 0.1-0.3: Weak theme coherence, more exploratory

## Analysis Process

1. **Read the full context** to understand the writer's overall emotional landscape
2. **Identify distinct themes** in each cluster - what makes it unique?
3. **Consider emotional weight** - how significant is this theme to the writer?
4. **Choose descriptive labels** that someone else could understand without context
5. **Assign appropriate colors** based on the emotional tone and content type
6. **Set confidence levels** based on how coherent and well-defined the theme is

Return valid JSON matching the required schema with thoughtful, distinct themes that capture the essence of each writing cluster.`;

    // User prompt injects the actual cluster payload separate from instructions
    const userPrompt = `${fullText ? `### Full Writing Context
${fullText.slice(0, 4000)}${fullText.length > 4000 ? '\n[Content truncated for brevity]' : ''}

` : ''}### Clusters for Theme Generation

${clusterSummaries.map((cluster) =>
      `**Cluster ${cluster.index}** (${cluster.chunkCount} writing segments):
${cluster.texts.map(text => `• ${text}`).join('\n')}
`
    ).join('\n')}

## Your Task

Generate a unique, meaningful theme for each cluster above. Consider:
- What emotional journey or experience does this cluster represent?
- How does it differ from the other clusters?  
- What would best help the writer recognize and connect with this theme?
- What color best reflects its emotional significance?
- How confident are you that this theme accurately represents the cluster?

Generate themes that are distinct, emotionally resonant, and help the writer understand their own patterns of thought and feeling.`;

    // Force a JSON-capable fast model so latency stays under map animation budget
    const result = await generateObject({
      model: openai(THEME_MODEL),
      system: systemPrompt,
      prompt: userPrompt,
      schema: ComprehensiveThemeSchema,
    });

    debug.dev("🎨 AI generated themes:", result.object);

    // Normalize AI response before merging to guard against missing keys
    const themes = result.object.themes.map((theme: any, index: number) => ({
      clusterId: clusterSummaries[index]?.id || `cluster-${index}`,
      label: theme.theme,
      description: theme.description || `Theme representing ${theme.theme.toLowerCase()}`,
      confidence: theme.confidence || 0.8,
      color: theme.color,
    }));

    debug.dev("✅ Processed themes:", themes);

    return themes;

  } catch (error) {
    debug.error("❌ Theme generation failed - detailed error:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      clustersLength: clusters.length,
      hasFullText: !!fullText
    });

    // Emit deterministic labels/colors when AI skips entries to keep UI predictable
    const fallbackColors = [
      "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899",
      "#06B6D4", "#84CC16", "#F97316", "#6366F1", "#A855F7", "#14B8A6",
      "#F472B6", "#34D399", "#FBBF24", "#A78BFA", "#60A5FA", "#F87171"
    ];
    const fallbackThemes = clusters.map((cluster, index) => ({
      clusterId: cluster.id,
      label: `Theme ${index + 1}`,
      description: "A collection of related thoughts and experiences",
      confidence: 0.5,
      color: fallbackColors[index % fallbackColors.length],
    }));

    debug.dev("🔄 Using fallback themes:", fallbackThemes);
    return fallbackThemes;
  }
}

/**
 * Generate embeddings for text chunks using Vercel AI SDK
 * This handles the OpenAI API integration at the service layer
 */
async function generateEmbeddingVectors(
  chunks: TextChunk[]
): Promise<EmbeddingResult> {
  if (chunks.length === 0) {
    return {
      chunks: [],
      embeddings: [],
      usage: { tokens: 0, cost: 0 },
    };
  }

  try {
    const texts = chunks.map((chunk) => chunk.text);

    const result = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: texts,
    });

    // Keep chunks + embeddings paired for downstream metrics/telemetry
    const chunksWithEmbeddings = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: result.embeddings[index],
    }));

    return {
      chunks: chunksWithEmbeddings,
      embeddings: result.embeddings,
      usage: {
        tokens: result.usage?.tokens || 0,
        cost: (result.usage?.tokens || 0) * 0.00002, // Rough per-call cost for text-embedding-3-small
      },
    };
  } catch (error) {
    debug.error("❌ Embedding generation failed:", error);
    throw new Error("Failed to generate embeddings");
  }
}
