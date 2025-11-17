import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { ClusterResult } from "@/types/embedding";
import { debug } from "@/lib/debug";

type OpenAIModelId = Parameters<typeof openai>[0];

const THEME_MODEL = (process.env.OPENAI_THEME_MODEL || "gpt-4o-mini") as OpenAIModelId;

const ComprehensiveThemeSchema = z.object({
    themes: z.array(z.object({
        clusterId: z.string(),
        theme: z.string().max(30, "Theme label must be 30 characters or less"),
        description: z.string(),
        confidence: z.number(),
        color: z.string(),
    })),
});

export interface ThemeData {
    clusterId: string;
    label: string;
    description: string;
    confidence: number;
    color: string;
}

/**
 * Generate comprehensive theme data using AI with improved prompt engineering
 */
export async function generateThemesForClusters(
    clusters: ClusterResult[],
    fullText?: string
): Promise<ThemeData[]> {
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

        const result = await generateObject({
            model: openai(THEME_MODEL),
            system: buildSystemPrompt(),
            prompt: buildUserPrompt(clusterSummaries, fullText),
            schema: ComprehensiveThemeSchema,
        });

        debug.dev("🎨 AI generated themes:", result.object);

        // Normalize AI response before merging to guard against missing keys
        const clusterIdSet = new Set(clusterSummaries.map((summary) => summary.id));
        const resolvedThemes = new Map<string, ThemeData>();

        for (let index = 0; index < result.object.themes.length; index++) {
            const theme = result.object.themes[index];
            const suggestedClusterId = theme.clusterId;
            const fallbackClusterId = clusterSummaries[index]?.id;
            const clusterId = suggestedClusterId && clusterIdSet.has(suggestedClusterId)
                ? suggestedClusterId
                : fallbackClusterId ?? `cluster-${index}`;

            if (resolvedThemes.has(clusterId)) {
                continue;
            }

            resolvedThemes.set(clusterId, {
                clusterId,
                label: theme.theme,
                description: theme.description || `Theme representing ${theme.theme.toLowerCase()}`,
                confidence: theme.confidence || 0.8,
                color: theme.color,
            });
        }

        const missingClusters = clusters.filter((cluster) => !resolvedThemes.has(cluster.id));
        if (missingClusters.length > 0) {
            debug.dev("⚠️ Adding fallback themes for missing clusters", {
                missingClusterIds: missingClusters.map((cluster) => cluster.id),
            });
            const fallbackThemes = generateFallbackThemes(missingClusters);
            fallbackThemes.forEach((fallback) => {
                resolvedThemes.set(fallback.clusterId, fallback);
            });
        }

        const themes = Array.from(resolvedThemes.values());

        debug.dev("✅ Processed themes:", themes);

        return themes;

    } catch (error) {
        debug.error("❌ Theme generation failed - detailed error:", {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            clustersLength: clusters.length,
            hasFullText: !!fullText
        });

        return generateFallbackThemes(clusters);
    }
}

/**
 * Generate fallback themes when AI fails
 */
function generateFallbackThemes(clusters: ClusterResult[]): ThemeData[] {
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

/**
 * Build the system prompt that encodes UI constraints and instructions
 */
function buildSystemPrompt(): string {
    return `You are an expert at analyzing personal writing and creating meaningful thematic categorizations. Your task is to generate distinct, emotionally resonant theme labels for clusters of personal writing segments.

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
}

/**
 * Build the user prompt with cluster data and context
 */
function buildUserPrompt(
    clusterSummaries: Array<{ id: string; index: number; texts: string[]; chunkCount: number }>,
    fullText?: string
): string {
    const contextSection = fullText
        ? `### Full Writing Context
${fullText.slice(0, 4000)}${fullText.length > 4000 ? '\n[Content truncated for brevity]' : ''}

`
        : '';

    const clustersSection = clusterSummaries.map((cluster) =>
        `**Cluster ${cluster.index}** (ID: ${cluster.id}, ${cluster.chunkCount} writing segments):
${cluster.texts.map(text => `• ${text}`).join('\n')}
`
    ).join('\n');

    return `${contextSection}### Clusters for Theme Generation

${clustersSection}

## Your Task

Generate a unique, meaningful theme for each cluster above. Consider:
- What emotional journey or experience does this cluster represent?
- How does it differ from the other clusters?  
- What would best help the writer recognize and connect with this theme?
- What color best reflects its emotional significance?
- How confident are you that this theme accurately represents the cluster?

Generate themes that are distinct, emotionally resonant, and help the writer understand their own patterns of thought and feeling.`;
}
