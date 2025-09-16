# Next.js Demo Template

A common template to quickly start, maintain consistency, and speed up development for new Next.js demos.

## Quick Start

### Prerequisites

- Node.js 22 or higher
- MongoDB connection string (to test MongoDB access)

### Setup

1. **Create a new repository from this template for your demo.**
2. **Clone your new demo repository.**
3. **Run the development server:**

   ```bash
   npm run dev
   ```

   Or using Docker

   ```bash
   make build
   ```

4. _(Optional)_ To check MongoDB connectivity:
   - Copy the example env file: `cp EXAMPLE.env .env`
   - Update `MONGODB_URI` and `DATABASE_NAME` in `.env`.
   - Rerun the template and use the home page button to test the connection.
5. If no data is found in the collection, seed the test database:
   ```bash
   npm run seed
   ```

## How to Use This Template

### Project Structure

- `environments/` — Used by CI/CD for Kanopy deployments
- `public/` — Static assets (images, PDFs, etc.)
- `scripts/` — Helper scripts for demo setup
- `src/` — Main source code for your demo. See [STYLE-GUIDE.md](utils/style/STYLE-GUIDE.md) for more info
- `utils/` — General utilities for development and setup (not needed at runtime)
- `utils/data/` — Initial data for the demo, used by the seed script
- `utils/style/` — Style guides, customizable for your coding preferences
- `utils/templates/` — Reusable components and integrations ([see templates README](utils/templates/README.md))

### Scripts & Automation

Scripts make demos easy to set up for any user. Automate as much as possible—like creating collections, initial data, indexes, and embeddings—so users don’t need to do it manually. Always include a seed script for MongoDB setup; see `scripts/seed.mjs` for a simple example.

### Before Publishing the Demo

Before making the repo public or deploying in production, make sure to check these recommendations:

- Update the README to describe your actual demo, not the template. See [README-demo.md](README-demo.md) for an example.
- Test the set up instructions in a clean environment to verify that it works.
- Remove or `.gitignore` folders used only for development or template content not needed in the demo.
- Before deploying, run `npm run lint`.
- Avoid using `--legacy-dep-peers` by managing dependencies well. _(Note: LeafyGreen UI packages may have issues with TS5.8; for now, use versions prior to the TS5.8 update.)_

### Access MongoDB

MongoDB access is handled securely using Next.js server actions (instead of API Routes). This keeps all database logic on the server and prevents unsafe operations from the browser.

**Example:**

`src/lib/db/test.js`

```js
import { mongoAction } from "@/integrations/mongodb/actions.js";

export async function fetchTestDocuments() {
  try {
    return await mongoAction("find", {
      collection: "test",
      filter: {},
      limit: 10,
    });
  } catch (error) {
    return { error: error.message };
  }
}
```

`src/components/test/Test.js`

```js
import { fetchTestDocuments } from "@/lib/api/test.js";

const handleClick = async () => {
  const data = await fetchTestDocuments();
  setResult(data);
};
```

### Other Integrations

Keep external libraries (e.g., Bedrock, GCP Vertex AI, mail services) in the `src/integrations/` folder for separation of concerns. See [templates](utils/templates/README.md) for included integrations.

## How to Contribute

Request access to the repository through MANA. Submit pull requests for improvements. If you build reusable demo code, consider adding it to `/utils/templates/`.

## Contact

This demo template is maintained by the Industry Solutions team. For issues or feedback, contact industry.solutions@mongodb.com or Slack channel [#industry-solutions](https://mongodb.enterprise.slack.com/archives/C061PEMD4KB).
