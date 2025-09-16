# Integrations Templates

This folder contains optional templates you can copy into your demo to extend the base template during development.

> [!IMPORTANT]
> This folder is for development only. Before making the repository public or shipping a demo, remove this folder from the repo. These files are not loaded by the app automatically.

## Supported templates

Currently, only integration templates are provided.

| Name                            | Description                                                          | Path       | README                                   |
| ------------------------------- | -------------------------------------------------------------------- | ---------- | ---------------------------------------- |
| AWS Bedrock (Chat + Embeddings) | Example integration showing chat and embeddings with Amazon Bedrock. | `bedrock/` | [bedrock/README.md](./bedrock/README.md) |
| MongoDB Vector Search           | Example utilities for Vector Search in MongoDB Atlas.                | `mongodb/` | [mongodb/README.md](./mongodb/README.md) |

## How to use a template

1. Choose a template from the table above.
2. Copy the relevant files into your app under `src/integrations/<provider>/` (or another location that fits your structure).
3. Install any required SDKs or dependencies referenced by the template.
4. Configure environment variables (e.g., API keys, URIs) as required by the integration.
5. Wire the integration into your app code or API routes (e.g., import the utility, call it from an API route, handle errors, and add minimal tests).

> [!WARNING]
> Don’t import directly from `utils/templates/` at runtime. Treat these as scaffolds you copy into `src/`.

## Removing this folder

When you’re done scaffolding your demo:

- Remove this folder from version control.
- Verify no code in `src/` imports from `utils/templates`.
- Ensure all secrets are sourced from environment variables, not committed files.

```bash
# Optional helper
git rm -r utils/templates
```
