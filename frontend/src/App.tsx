import "./App.css";
import { useEffect, useState } from "react";
import { useCompletion } from "ai/react";

function App() {
  const [apiResponse, setApiResponse] = useState("");

  useEffect(() => {
    fetch("/api/reply?value=Hello from React App!")
      .then((response) => response.json())
      .then((result) => setApiResponse(JSON.stringify(result)));
  }, []);

  const { input, completion, handleInputChange, handleSubmit } = useCompletion({
    api: "/api/ask",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return (
    <div>
      <code>{apiResponse}</code>

      <form onSubmit={handleSubmit}>
        <label htmlFor="ask-input"></label>
        <input
          id="ask-input"
          type="text"
          value={input}
          onChange={handleInputChange}
        />

        <button type="submit">POST</button>
      </form>

      <textarea value={completion} rows={20}></textarea>
    </div>
  );
}

export default App;