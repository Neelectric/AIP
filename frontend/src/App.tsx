import { useState } from "react";
import { useCompletion } from "ai/react";


function App() {
  // Send the query to the LLM server and stream its response
  const [completion, setCompletion] = useState("");

  const { input, handleInputChange, handleSubmit } = useCompletion({
    api: "/api/ask",
    headers: { "Content-Type": "application/json" },
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
    onError: (error: Error) => {
      setCompletion(error.toString());
    }
  });

  
  // For easy testing of the FastAPI implementation - simply import axios and print `message` somewhere in the UI to check
  // const [message, setMessage] = useState<string>("");
  // useEffect(() => {
  //     axios.get("/api/")
  //         .then(response => setMessage(response.data.message))
  //         .catch(error => console.error("Error fetching data", error));
  // }, []);


  // Render the interface
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <textarea
        value={completion}
        rows={20}
        cols={100}
        readOnly
        className="w-3/4 mb-4 p-4 border-2 border-black rounded-md"
      >
      </textarea>
      <form
        onSubmit={handleSubmit}
        className="flex w-3/4"
      >
        <input
          id="ask-input"
          type="text"
          value={input}
          onChange={handleInputChange}
          className="grow mr-2 p-4 border-2 border-black rounded-md"
        />
        <button
          type="submit"
          className="w-20 bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 rounded"
        >
          ASK
        </button>
      </form>
    </div>
  );
}

export default App;
