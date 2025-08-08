// src/app/page.tsx
'use client'; // This is a Next.js directive to make the component interactive

import { useState } from 'react';

export default function HomePage() {
  // 'useState' is a React hook to manage the component's state (data)
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // This function is called when the form is submitted
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevents the page from reloading on submit
    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      // This is the 'fetch' call to our own API endpoint
      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If the server responded with an error, capture it
        throw new Error(data.details || 'An error occurred.');
      }

      setResponse(data.response); // Set the successful response to display it

    } catch (err: Error) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-8">AI Executive Assistant</h1>
      
      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your command... (e.g., 'Draft an email to the team' or 'Schedule a meeting with Jane for 3pm tomorrow')"
          className="w-full p-4 rounded-md bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-4 p-4 rounded-md bg-blue-600 hover:bg-blue-700 font-bold disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Execute Task'}
        </button>
      </form>

      {/* This section displays the response from the API */}
      {response && (
        <div className="mt-8 p-6 w-full max-w-2xl bg-gray-800 rounded-md border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Response:</h2>
          <p className="whitespace-pre-wrap">{response}</p>
        </div>
      )}

      {/* This section displays any errors */}
      {error && (
        <div className="mt-8 p-6 w-full max-w-2xl bg-red-900 bg-opacity-50 rounded-md border border-red-700">
          <h2 className="text-xl font-bold mb-4">Error:</h2>
          <p className="text-red-300">{error}</p>
        </div>
      )}
    </main>
  );
}