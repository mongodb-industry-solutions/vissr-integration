"use client";

import Button from "@leafygreen-ui/button";
import React, { useState } from "react";
import { fetchTestDocuments } from "@/lib/db/test.js";

export default function Test() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const data = await fetchTestDocuments();
    setLoading(false);
    if (data.error) {
      setError(data.error);
      setResult(null);
    } else {
      setResult(data);
    }
  };

  // Success message
  const successMsg = (
    <div className="mb-2 text-green-600 font-semibold">
      🎉 Demo template is ready! You can start building your app.
    </div>
  );

  // Error instructions
  const errorInstructions = (
    <div className="mb-2 text-black">
      <strong>Could not connect to MongoDB.</strong>
      <br />
      Please check your environment variables:
      <br />
      <code>MONGODB_URI</code> and <code>DATABASE_NAME</code>.<br />
      <span className="text-red-600">Error: {error}</span>
    </div>
  );

  // Empty instructions
  const emptyInstructions = (
    <div className="mb-2 text-black">
      <strong>No data found in the test collection.</strong>
      <br />
      Seed your test database, or change the collection name in{" "}
      <code>src/lib/api/test.js</code> if you are connected to a different
      database.
    </div>
  );

  return (
    <div className="max-w-xl mx-auto p-4">
      {error && errorInstructions}
      {!error &&
        result &&
        (Array.isArray(result) ? result.length === 0 : !result) &&
        emptyInstructions}
      {!error &&
        result &&
        (Array.isArray(result) ? result.length > 0 : !!result) &&
        successMsg}
      <Button onClick={handleClick} disabled={loading} variant="primary">
        {loading ? "Loading..." : "Run Test Query"}
      </Button>
      <div className="mt-4">
        {result && Array.isArray(result) && result.length > 0 && (
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
        {result && !Array.isArray(result) && (
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
