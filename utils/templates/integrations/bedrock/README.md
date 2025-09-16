# AWS Bedrock Integration Template

This template shows how to integrate Amazon Bedrock for chat and embeddings.
It uses `@langchain/aws` (ChatBedrockConverse) and the AWS SDK Bedrock Runtime client.

## Prerequisites

- AWS account with access to Bedrock models in your region
- AWS Region enabled for Bedrock (e.g., `us-east-1`)
- Credentials via SSO or default provider chain

## Environment variables

Add these to your `.env.local` (or environment) as needed:

- `AWS_REGION` — e.g., `us-east-1`
- `AWS_PROFILE` — for SSO on local dev (optional)
- `NEXT_PUBLIC_ENV` — e.g., `development` or `production`
- `COMPLETION_MODEL` — Bedrock chat model ID (e.g., `anthropic.claude-3-5-sonnet-20240620-v1:0`)
- `EMBEDDING_MODEL` — Bedrock embedding model ID

## Files

- `chat.js` — Initializes a Bedrock chat client and exposes `invokeBedrock`/`streamFromBedrock` helpers.
- `embeddings.js` — Uses Bedrock Runtime API to generate embeddings.

## Installation

Install the packages used by this template in your project:

- `@aws-sdk/client-bedrock-runtime`
- `@aws-sdk/credential-provider-sso`
- `@aws-sdk/credential-provider-node`
- `@langchain/aws`

## Quick start

1. Copy `chat.js` and/or `embeddings.js` into `src/integrations/bedrock/`.
2. Set required environment variables.
3. Use the helpers in your API route or server code, for example:

```js
import { invokeBedrock } from "@/integrations/bedrock/chat";

export async function POST(req) {
  const body = await req.json();
  const messages = body.messages || [{ role: "user", content: "Hello!" }];
  const response = await invokeBedrock(messages);
  return new Response(JSON.stringify(response), { status: 200 });
}
```

## Docker & Kanopy Setup

- **Docker:** Uncomment the AWS credential volume lines in `docker-compose.yml` to allow authentication to AWS services.
- **Kanopy:** Uncomment the `serviceAccount` section in your `environments/production.yaml` or `environments/staging.yaml` to enable Kanopy access to AWS services.

## Security

- Do not commit credentials. Use environment variables or your platform’s secret manager.
- In production, prefer the default credential provider chain with a role; avoid long‑lived keys.
