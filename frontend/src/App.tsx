import React, { useEffect, useRef, useState } from "react";
// import { useCompletion } from "ai/react";


type Loc = "outside" | "inside";

// Figure out what our location is
const params = new URLSearchParams(document.location.search);
const loc = params.get("loc") as Loc;


function App() {
  // For easy testing of the FastAPI implementation - simply import axios and print `message` somewhere in the UI to check
  // const [message, setMessage] = useState<string>("");
  // useEffect(() => {
  //     axios.get("/api/")
  //         .then(response => setMessage(response.data.message))
  //         .catch(error => console.error("Error fetching data", error));
  // }, []);


  // Send the query to the LLM server and stream its response
  // const [completion, setCompletion] = useState("");

  // const { input, handleInputChange, handleSubmit } = useCompletion({
  //   api: "/api/ask",
  //   headers: { "Content-Type": "application/json" },
  //   onResponse: (response: Response) => {
  //     const reader = response.body?.getReader();
  //     const decoder = new TextDecoder();
  //     let currentCompletion = "";

  //     const readStream = async () => {
  //       if (!reader) return;
  //       const { value, done } = await reader.read();
  //       if (value) {
  //         const chunk = decoder.decode(value);
  //         currentCompletion += chunk;
  //         setCompletion(currentCompletion);
  //       }
  //       if (!done) {
  //         readStream();
  //       }
  //     };

  //     readStream();
  //   },
  //   onError: (error: Error) => {
  //     setCompletion(error.toString());
  //   }
  // });


  // Set up WebSockets
  const [input, setInput] = useState("");
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => setInput(event.target.value);

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(`ws://127.0.0.1:5000/ws/${loc}`);
    // ws.current = new WebSocket(`ws://dashing-treefrog-actively.ngrok-free.app/ws/${loc}`);

    return () => {
      ws.current?.close();
    }
  }, []);

  useEffect(() => {
    if (!ws.current) return;
    ws.current.onmessage = event => {
      const responses = document.getElementById("responses")!;
      const response = document.createElement("li");
      const content = document.createTextNode(event.data);
      response.appendChild(content);
      responses.appendChild(response);
    };
  });
  
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      const input = document.getElementById("ask-input")! as HTMLInputElement;
      ws.current?.send(input.value);
      input.value = "";
      event.preventDefault();
  };


  // Render the interface
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="mb-4 text-lg font-bold uppercase">
        { loc }
      </h1>
      {/* <textarea
        value={completion}
        rows={20}
        cols={100}
        readOnly
        className="w-3/4 mb-4 p-4 border-2 border-black rounded-md"
      >
      </textarea> */}
      <div className="w-3/4 h-[300px] mb-4 p-4 border-2 border-black rounded-md overflow-y-scroll">
        <ul id="responses"></ul>
      </div>
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
