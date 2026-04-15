import { mongoAction } from "@/integrations/mongodb/actions.js";

// Fetches documents from the test collection using the server action
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
