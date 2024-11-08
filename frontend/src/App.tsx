import React from 'react';
import { useEffect, useState } from "react";
import { useCompletion } from "ai/react";

function App() {
  const [completion, setCompletion] = useState("");

  const { input, handleInputChange, handleSubmit } = useCompletion({
    api: "/api/ask",
    headers: {
      "Content-Type": "application/json",
    },
    onResponse: (response: Response) => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let currentCompletion = "";

      const readStream = async () => {
        if (!reader) return;
        const { value, done } = await reader.read();
        if (value) {
          const chunk = decoder.decode(value);
          currentCompletion += chunk;
          setCompletion(currentCompletion);
        }
        if (!done) {
          readStream();
        }
      };

      readStream();
    },
  });

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <textarea
        value={completion}
        rows={20}
        cols={100}
        className="w-3/4 mb-4 p-4 bg-gray-800 text-white rounded-md"
      ></textarea>
      <form onSubmit={handleSubmit} className="w-3/4">
        <input style={{ width:"760px" }}
          id="ask-input"
          type="text"
          value={input}
          onChange={handleInputChange}
          className="w-full p-4 bg-gray-800 text-white rounded-md mb-4"
        />
        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          ASK
        </button>
      </form>
    </div>
  );
}

export default App;