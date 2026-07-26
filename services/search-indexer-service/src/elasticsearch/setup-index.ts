import { getEsClient } from "./client";
import { logger } from "@infrastructure/observability/logger";

export const PRODUCT_INDEX = "products";

// Edge n-gram analyzer for "search-as-you-type" autocomplete on product name;
// the standard analyzer alone only matches whole tokens, not partial prefixes.
// Fuzzy typo-tolerance is handled at query time (match with fuzziness: AUTO),
// not at index time — no analyzer changes needed for that.
const PRODUCT_INDEX_CONFIG = {
  settings: {
    analysis: {
      filter: {
        autocomplete_filter: {
          type: "edge_ngram",
          min_gram: 2,
          max_gram: 20,
        },
      },
      analyzer: {
        autocomplete_analyzer: {
          type: "custom",
          tokenizer: "standard",
          filter: ["lowercase", "autocomplete_filter"],
        },
        autocomplete_search_analyzer: {
          type: "custom",
          tokenizer: "standard",
          filter: ["lowercase"],
        },
      },
    },
  },
  mappings: {
    properties: {
      product_id: { type: "keyword" },
      category_id: { type: "keyword" },
      name: {
        type: "text",
        analyzer: "autocomplete_analyzer",
        search_analyzer: "autocomplete_search_analyzer",
        fields: {
          // exact/sort-friendly variant — autocomplete_analyzer alone isn't
          // suitable for exact match or sorting due to the n-gram expansion
          keyword: { type: "keyword" },
        },
      },
      description: { type: "text" },
      price: { type: "double" },
      is_active: { type: "boolean" },
      stock_quantity: { type: "integer" },
      thumbnail_url: { type: "keyword", index: false },
      list_image_url: { type: "keyword", index: false },
      indexed_at: { type: "date" },
    },
  },
} as const;

// Idempotent — create only if missing. Safe to call on every service boot.
export async function ensureProductIndex(): Promise<void> {
  const es = getEsClient();
  const exists = await es.indices.exists({ index: PRODUCT_INDEX });
  if (exists) return;

  await es.indices.create({
    index: PRODUCT_INDEX,
    ...PRODUCT_INDEX_CONFIG,
  });

  logger.info("search-indexer-service", "Created Elasticsearch product index", {
    index: PRODUCT_INDEX,
  });
}
