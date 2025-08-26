import { describe, test, expect } from "bun:test";
import type { Sentence } from "../../src/types/sentence";
import { shouldProcessSentence } from "../../src/lib/shouldProcessSentence";

describe("Sentence Caching Logic", () => {
  // Simulate the caching logic from useProdsEnhanced (unique by sentence.id)
  const addToCache = (cache: Sentence[], sentence: Sentence): Sentence[] => {
    // Check if sentence already exists to avoid duplicates
    const exists = cache.some(s => s.id === sentence.id);
    if (exists) return cache;

    return [...cache, sentence];
  };

  test("filters out short sentences", () => {
    const shortSentence: Sentence = {
      id: "short",
      text: "Too short.",
      startIndex: 0,
      endIndex: 10,
    };

    expect(shouldProcessSentence(shortSentence)).toBe(false);
  });

  test("filters out punctuation-only sentences", () => {
    const punctuationSentence: Sentence = {
      id: "punct",
      text: "... !!! ???",
      startIndex: 0,
      endIndex: 10,
    };

    expect(shouldProcessSentence(punctuationSentence)).toBe(false);
  });

  test("filters out simple greetings", () => {
    const greetingSentences = [
      { id: "hello", text: "hello", startIndex: 0, endIndex: 5 },
      { id: "hi", text: "Hi!", startIndex: 0, endIndex: 3 },
      { id: "thanks", text: "Thanks.", startIndex: 0, endIndex: 7 },
    ];

    greetingSentences.forEach(sentence => {
      expect(shouldProcessSentence(sentence)).toBe(false);
    });
  });

  test("allows meaningful sentences", () => {
    const meaningfulSentences: Sentence[] = [
      {
        id: "work",
        text: "I had a really productive day at work today.",
        startIndex: 0,
        endIndex: 44,
      },
      {
        id: "thoughts",
        text: "I've been thinking about my career goals lately.",
        startIndex: 45,
        endIndex: 93,
      },
      {
        id: "feelings",
        text: "This situation makes me feel quite anxious.",
        startIndex: 94,
        endIndex: 137,
      },
    ];

    meaningfulSentences.forEach(sentence => {
      expect(shouldProcessSentence(sentence)).toBe(true);
    });
  });

  test("caching avoids duplicates", () => {
    let cache: Sentence[] = [];

    const sentence: Sentence = {
      id: "test-1",
      text: "This is a meaningful sentence that should be cached.",
      startIndex: 0,
      endIndex: 52,
    };

    // Add sentence first time
    cache = addToCache(cache, sentence);
    expect(cache).toHaveLength(1);
    expect(cache[0].id).toBe("test-1");

    // Try to add same sentence again
    cache = addToCache(cache, sentence);
    expect(cache).toHaveLength(1); // Should still be 1, no duplicates
  });

  test("caching accumulates different sentences", () => {
    let cache: Sentence[] = [];

    const sentences: Sentence[] = [
      {
        id: "sentence-1",
        text: "I'm feeling really excited about this new project.",
        startIndex: 0,
        endIndex: 50,
      },
      {
        id: "sentence-2",
        text: "The weather has been absolutely beautiful lately.",
        startIndex: 51,
        endIndex: 100,
      },
      {
        id: "sentence-3",
        text: "I need to start planning my vacation for next month.",
        startIndex: 101,
        endIndex: 154,
      },
    ];

    sentences.forEach(sentence => {
      if (shouldProcessSentence(sentence)) {
        cache = addToCache(cache, sentence);
      }
    });

    expect(cache).toHaveLength(3);
    expect(cache.map(s => s.id)).toEqual(["sentence-1", "sentence-2", "sentence-3"]);
  });

  test("filtering and caching workflow", () => {
    let cache: Sentence[] = [];

    const mixedSentences: Sentence[] = [
      { id: "short", text: "Quick one.", startIndex: 0, endIndex: 10 },
      { id: "meaningful-1", text: "I've been reflecting on my personal growth journey.", startIndex: 4, endIndex: 55 },
      { id: "punct", text: "...", startIndex: 56, endIndex: 59 },
      { id: "meaningful-2", text: "Today's meeting really challenged my perspective.", startIndex: 60, endIndex: 108 },
      { id: "greeting", text: "Thanks", startIndex: 109, endIndex: 115 },
    ];

    mixedSentences.forEach(sentence => {
      if (shouldProcessSentence(sentence)) {
        cache = addToCache(cache, sentence);
      }
    });

    // Should only cache the 2 meaningful sentences
    expect(cache).toHaveLength(2);
    expect(cache[0].id).toBe("meaningful-1");
    expect(cache[1].id).toBe("meaningful-2");
  });
});
