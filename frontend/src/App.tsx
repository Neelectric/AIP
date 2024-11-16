import React, { useEffect, useRef, useState } from "react";


type Loc = "outside" | "inside";

type Data = {
  type: string;
  data: any;
};

// Figure out what our location is
const params = new URLSearchParams(document.location.search);
const loc = params.get("loc") as Loc;


function App() {
  const responseCounter = useRef(0);
  const prevToken = useRef("");

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
      const data = JSON.parse(event.data) as Data;
      const responses = document.getElementById("responses")!;
      
      if(data.type === "prompt") {
        const prompt = document.createElement("li");
        const promptContent = document.createTextNode(`You: ${data.data}`);
        prompt.appendChild(promptContent);
        responses.appendChild(prompt);

        responseCounter.current += 1;
        const response = document.createElement("li");
        response.setAttribute("id", `response-${responseCounter.current}`);
        const responseContent = document.createTextNode(`EdinBot: `);
        response.appendChild(responseContent);
        responses.appendChild(response);
      }
      else if(data.type === "next_token") {
        const response = document.getElementById(`response-${responseCounter.current}`);
        if(!response) return;
        
        const token = data.data as string;
        console.log(token);
        if (token === "<|eot_id|>") {
          responseCounter.current += 1;
          const response = document.createElement("li");
          response.setAttribute("id", `response-${responseCounter.current}`);
          responses.appendChild(response);
        }
        else if (
          token === "<|start_header_id|>" ||
          token === "<|end_header_id|>" ||
          (prevToken.current === "<|start_header_id|>" && token === "assistant")
        ) {}
        else {
          for (const char of token) {
            const content = document.createTextNode(char);
            response.appendChild(content);
          }
        }

        prevToken.current = token;
      }
      else if(data.type === "inside_choice") {
        // const response = document.createElement("li");
        // const content = document.createTextNode(event.data);
        // response.appendChild(content);
        // responses.appendChild(response);
      }
    };
  });
  
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      const input = document.getElementById("ask-input")! as HTMLInputElement;
      ws.current?.send(input.value);
      input.value = "";
      event.preventDefault();
  };


  // Render the interface
  return loc === "outside" ? (
    <div className={`w-screen h-screen flex flex-col justify-center bg-[url("/editomorrow.webp")] bg-center bg-cover bg-no-repeat`}>
      {/* <div>
        Edinbot
      </div> */}
      <div className="h-full w-[70%] mx-auto mt-16 mb-32 backdrop-blur-3xl rounded-lg overflow-hidden shadow-[4px_4px_32px_#bebebe,-4px_-4px_32px_#ffffff]">
        <div className="w-full h-full flex flex-col items-center rounded-lg bg-white/70 border-0 border-white">
          <div
            id="output_window"
            className="w-full m-4 grow overflow-y-auto"
          >
            <ul
              id="responses"
              className="mx-4"
            >

            </ul>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex w-full h-16 mb-4"
          >
            <input
              id="ask-input"
              type="text"
              placeholder="Ask me about Edinburgh!"
              value={input}
              onChange={handleInputChange}
              className="grow ml-4 mr-2 p-4 rounded-md bg-white/70 hover:bg-white/90 focus:bg-white/90 transition-colors"
            />
            <button
              type="submit"
              className="w-20 mr-4 bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 rounded"
            >
              ASK
            </button>
          </form>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="mb-4 text-lg font-bold uppercase">
        { loc }
      </h1>
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
