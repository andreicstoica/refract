import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import {
  generateEmbeddings,
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

const ThemeLabelSchema = z.object({
  themes: z.array(z.object({
    clusterId: z.string(),
    label: z.string().max(30).describe("Concise theme name, 2-4 words"),
    description: z.string().max(100).describe("Brief description of the theme"),
    confidence: z.number().min(0).max(1).describe("Confidence in theme quality"),
    color: z.string().describe("CSS color for the theme bubble - use hex colors like #3B82F6, #8B5CF6, #10B981, #F59E0B, #EF4444, #EC4899"),
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

    // Step 5: Merge cluster data with theme labels and assign colors
    const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];
    const enrichedClusters = clusters.map((cluster, index) => {
      const themeLabel = themeLabels.find(t => t.clusterId === cluster.id);
      return {
        ...cluster,
        label: themeLabel?.label || cluster.label,
        description: themeLabel?.description || "",
        confidence: Math.min(cluster.confidence, themeLabel?.confidence || 0.5),
        color: colors[index % colors.length],
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
        color: c.color, // Add color to the response
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
 * Generate meaningful theme labels for clusters using LLM
 */
async function generateThemeLabels(
  clusters: ClusterResult[],
  fullText?: string
): Promise<Array<{ clusterId: string; label: string; description: string; confidence: number; color: string }>> {
  if (clusters.length === 0) return [];

  // Predefined color palette for themes
  const colorPalette = [
    "#3B82F6", // Blue
    "#8B5CF6", // Purple
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#84CC16", // Lime
    "#F97316", // Orange
    "#6366F1", // Indigo
  ];

  try {
    // Prepare cluster summaries for the LLM
    const clusterSummaries = clusters.map(cluster => ({
      id: cluster.id,
      texts: cluster.chunks.map(chunk => chunk.text).slice(0, 5), // Limit to 5 representative texts
      chunkCount: cluster.chunks.length,
    }));

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      system: `You are an expert at identifying themes in reflective writing and journal entries.

TASK: Generate meaningful, insightful theme labels for text clusters from personal writing.

CRITICAL REQUIREMENTS:
- Create 2-4 word theme labels that capture the emotional, conceptual, or topical essence
- Labels should be specific and meaningful, NOT generic like "Theme 1" or "Cluster 1"
- Focus on the underlying patterns, emotions, or topics that connect the texts
- Provide brief descriptions that explain what the theme represents
- Assign confidence scores (0.1-1.0) based on how coherent and meaningful each theme is
- Choose appropriate colors from the provided palette that match the theme's emotional tone

COLOR GUIDELINES:
- Blue (#3B82F6): Work, productivity, calm, trust
- Purple (#8B5CF6): Creativity, spirituality, wisdom, luxury
- Emerald (#10B981): Growth, health, nature, success
- Amber (#F59E0B): Energy, optimism, warmth, caution
- Red (#EF4444): Passion, urgency, stress, intensity
- Pink (#EC4899): Love, relationships, compassion, gentleness
- Cyan (#06B6D4): Clarity, communication, freshness
- Lime (#84CC16): Youth, vitality, new beginnings
- Orange (#F97316): Adventure, enthusiasm, creativity
- Indigo (#6366F1): Depth, intuition, mystery

EXAMPLES OF GOOD LABELS:
- "Work Stress & Pressure" (Red #EF4444) for texts about deadlines, workload, job anxiety
- "Personal Growth Journey" (Emerald #10B981) for texts about learning, self-improvement, reflection
- "Family Relationships" (Pink #EC4899) for texts about family dynamics, parenting, home life
- "Future Aspirations" (Blue #3B82F6) for texts about goals, dreams, career planning
- "Creative Pursuits" (Purple #8B5CF6) for texts about art, writing, hobbies, passion projects

AVOID: Generic labels like "Theme 1", "Cluster 1", "General Thoughts", "Random Ideas"

Be insightful and specific. Each label should immediately convey what the theme is about.`,
      prompt: `${fullText ? `FULL CONTEXT:\n${fullText}\n\n` : ''}CLUSTERS TO LABEL:\n${clusterSummaries.map((cluster, i) =>
        `Cluster ${i + 1} (${cluster.chunkCount} texts):\n${cluster.texts.join('\n')}\n`
      ).join('\n')
        }\n\nGenerate meaningful theme labels for these clusters. Focus on the emotional, conceptual, or topical patterns that connect the texts within each cluster. Choose colors that match the emotional tone of each theme:`,
      schema: ThemeLabelSchema,
    });

    console.log("🎨 Generated theme labels:", result.object.themes);

    // Map back to cluster IDs
    return result.object.themes.map((theme, index) => ({
      clusterId: clusters[index]?.id || `cluster-${index}`,
      label: theme.label,
      description: theme.description,
      confidence: theme.confidence,
      color: theme.color,
    }));

  } catch (error) {
    console.error("❌ Theme labeling failed:", error);

    // Improved fallback labels based on cluster content with colors
    return clusters.map((cluster, index) => {
      const texts = cluster.chunks.map(chunk => chunk.text).join(' ').toLowerCase();

      // More comprehensive word matching with colors
      const themeKeywords = {
        'Work & Career': { keywords: ['work', 'job', 'career', 'office', 'meeting', 'project', 'deadline', 'boss', 'colleague', 'promotion', 'salary'], color: '#3B82F6' },
        'Stress & Anxiety': { keywords: ['stress', 'anxiety', 'worry', 'pressure', 'overwhelmed', 'tired', 'exhausted', 'burnout'], color: '#EF4444' },
        'Family & Relationships': { keywords: ['family', 'parent', 'child', 'spouse', 'partner', 'marriage', 'relationship', 'love', 'home'], color: '#EC4899' },
        'Personal Growth': { keywords: ['learn', 'growth', 'improve', 'better', 'goal', 'achievement', 'progress', 'development'], color: '#10B981' },
        'Health & Wellness': { keywords: ['health', 'exercise', 'workout', 'diet', 'sleep', 'mental', 'physical', 'wellness', 'fitness'], color: '#10B981' },
        'Future Planning': { keywords: ['future', 'plan', 'goal', 'dream', 'aspiration', 'vision', 'tomorrow', 'next'], color: '#3B82F6' },
        'Social Life': { keywords: ['friend', 'social', 'party', 'hangout', 'community', 'network', 'connection'], color: '#84CC16' },
        'Creative Pursuits': { keywords: ['creative', 'art', 'music', 'write', 'paint', 'design', 'hobby', 'passion'], color: '#8B5CF6' },
        'Financial': { keywords: ['money', 'finance', 'budget', 'save', 'spend', 'investment', 'debt', 'income'], color: '#F59E0B' },
        'Travel & Adventure': { keywords: ['travel', 'trip', 'vacation', 'adventure', 'explore', 'visit', 'destination'], color: '#F97316' },
        'Learning & Education': { keywords: ['study', 'learn', 'course', 'education', 'knowledge', 'skill', 'training'], color: '#06B6D4' },
        'Technology': { keywords: ['tech', 'computer', 'phone', 'app', 'digital', 'online', 'internet', 'software'], color: '#6366F1' }
      };

      // Find the best matching theme
      let bestMatch = { label: `Cluster ${index + 1}`, score: 0, color: colorPalette[index % colorPalette.length] };

      for (const [themeName, themeData] of Object.entries(themeKeywords)) {
        const score = themeData.keywords.filter(keyword => texts.includes(keyword)).length;
        if (score > bestMatch.score) {
          bestMatch = { label: themeName, score, color: themeData.color };
        }
      }

      // Only use the matched theme if we found at least 2 keywords
      const label = bestMatch.score >= 2 ? bestMatch.label : `Cluster ${index + 1}`;
      const color = bestMatch.score >= 2 ? bestMatch.color : colorPalette[index % colorPalette.length];

      return {
        clusterId: cluster.id,
        label,
        description: bestMatch.score >= 2 ? `Related thoughts about ${label.toLowerCase()}` : "A collection of related thoughts",
        confidence: Math.max(0.3, bestMatch.score * 0.2),
        color,
      };
    });
  }
}