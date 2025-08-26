import { openai } from "@ai-sdk/openai";
import { generateObject, embedMany } from "ai";
import { z } from "zod";
import { MIN_CHUNK_CORRELATION } from "@/lib/highlight";
import {
  clusterEmbeddings,
  sentencesToChunks,
} from "@/lib/embeddings";
import type { TextChunk, ClusterResult, EmbeddingResult } from "@/types/embedding";

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
      };
    });

    // Sort clusters by confidence and chunk count
    const sortedClusters = enrichedClusters
      .sort((a, b) => (b.confidence * b.chunks.length) - (a.confidence * a.chunks.length))
      .slice(0, 3); // Return top 3 themes

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
          // Use correlation computed during clustering, filtered by threshold
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
 * Generate comprehensive theme data using AI with improved prompt engineering
 */
async function generateComprehensiveThemes(
  clusters: ClusterResult[],
  fullText?: string
): Promise<Array<{ clusterId: string; label: string; description: string; confidence: number; color: string }>> {
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

    // Construct the comprehensive system prompt
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

**Colors**: Choose semantic color names that adapt to light/dark themes for optimal contrast:

- \`blue\` - Daily life, routine, neutral reflection, calmness
- \`purple\` - Creativity, dreams, aspirations, spirituality  
- \`green\` - Growth, positive experiences, achievements, nature
- \`amber\` - Important memories, significant moments, warmth
- \`red\` - Stress, challenges, intense emotions, passion
- \`pink\` - Relationships, love, personal connections, tenderness
- \`cyan\` - Clarity, insight, intellectual pursuits
- \`lime\` - Energy, optimism, new beginnings
- \`orange\` - Enthusiasm, adventure, social connections
- \`indigo\` - Depth, introspection, wisdom
- \`violet\` - Imagination, mystery, transformation
- \`teal\` - Balance, harmony, emotional stability

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

    // Construct the user prompt with the data
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

    // Use a valid, fast JSON-capable model
    const result = await generateObject({
      model: openai("gpt-5-nano"),
      system: systemPrompt,
      prompt: userPrompt,
      schema: ComprehensiveThemeSchema,
    });

    console.log("🎨 AI generated themes:", result.object);

    // Transform the AI response to match our expected return format
    const themes = result.object.themes.map((theme: any, index: number) => ({
      clusterId: clusterSummaries[index]?.id || `cluster-${index}`,
      label: theme.theme,
      description: theme.description || `Theme representing ${theme.theme.toLowerCase()}`,
      confidence: theme.confidence || 0.8,
      color: theme.color,
    }));

    console.log("✅ Processed themes:", themes);

    return themes;

  } catch (error) {
    console.error("❌ Theme generation failed - detailed error:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      clustersLength: clusters.length,
      hasFullText: !!fullText
    });

    // Enhanced fallback with semantic color names for theme adaptation
    const fallbackColors = [
      "blue", "purple", "green", "amber", "red", "pink",
      "cyan", "lime", "orange", "indigo", "violet", "teal"
    ];
    const fallbackThemes = clusters.map((cluster, index) => ({
      clusterId: cluster.id,
      label: `Theme ${index + 1}`,
      description: "A collection of related thoughts and experiences",
      confidence: 0.5,
      color: fallbackColors[index % fallbackColors.length],
    }));

    console.log("🔄 Using fallback themes:", fallbackThemes);
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

    // Attach embeddings to chunks
    const chunksWithEmbeddings = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: result.embeddings[index],
    }));

    return {
      chunks: chunksWithEmbeddings,
      embeddings: result.embeddings,
      usage: {
        tokens: result.usage?.tokens || 0,
        cost: (result.usage?.tokens || 0) * 0.00002, // Approximate cost for text-embedding-3-small
      },
    };
  } catch (error) {
    console.error("❌ Embedding generation failed:", error);
    throw new Error("Failed to generate embeddings");
  }
}
