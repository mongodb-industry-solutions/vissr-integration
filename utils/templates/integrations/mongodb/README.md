# MongoDB Vector Search Integration Template

This template provides utilities to use MongoDB Atlas Vector Search. It pairs with the Bedrock embeddings template to generate query vectors.

## Prerequisites

- MongoDB Atlas cluster with Vector Search enabled
- A database and collection to query
- Environment variables for MongoDB connection (see `EXAMPLE.env`)
- Bedrock embeddings configured (the sample depends on `../bedrock/embeddings.js`)

## Environment variables

Add these to your `.env.local` (or environment):

- `MONGODB_URI` — your Atlas connection string
- `DATABASE_NAME` — the target database name

> [!NOTE]
> Vector search utilities call Bedrock embeddings by default. Ensure your Bedrock configuration is set up (see the Bedrock template README).

## Files

- `vectorSearch.js` —
  - `vectorSearch(query, dbConfig, n?, options?)` to run a similarity search using Atlas Vector Search.
  - `createVectorSearchIndex(collectionName, embeddingField, indexName?, similarity?, numDimensions?)` to create a vector index.
  - Imports MongoDB client from `./client.js` and `generateEmbedding` from `../bedrock/embeddings.js`.

## Quick start

1. Ensure you have a MongoDB client helper at `src/integrations/mongodb/client.js` (the demo includes one).
2. Copy `vectorSearch.js` into `src/integrations/mongodb/`.
3. Set `MONGODB_URI` and `DATABASE_NAME` in your environment.
4. (Optional) Create an Atlas Vector Search index:

```js
import { createVectorSearchIndex } from "@/integrations/mongodb/vectorSearch";
await createVectorSearchIndex(
  "myCollection",
  "embedding",
  "default",
  "dotProduct",
  1536
);
```

5. Run a vector search in an API route:

```js
import { vectorSearch } from "@/integrations/mongodb/vectorSearch";

export async function POST(req) {
  const { query } = await req.json();
  const results = await vectorSearch(
    query,
    {
      collection: "myCollection",
      indexName: "default",
      textKey: ["title", "content"],
      embeddingKey: "embedding",
      includeScore: true,
    },
    10
  );
  return new Response(JSON.stringify(results), { status: 200 });
}
```
