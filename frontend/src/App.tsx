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
        if (loc == 'inside') {
          const query = document.getElementById("userQuery");
          if (!query) return;
          query.innerText = data.data;
          const response = document.getElementById("response");
          if (!response) return;
          response.innerHTML = "";
        }
        else{
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
      }
      else if(data.type === "next_token") {
        const token = data.data as string;
        console.log(token);
        var respID = "";
        if(loc == 'inside'){
          respID = 'response';
        }
        else {
          respID = `response-${responseCounter.current}`;
        }
        const response = document.getElementById(respID)
        if(!response) return;

        if (token === "<|eot_id|>") {
          if (loc == 'inside'){

          }
          else{
          responseCounter.current += 1;
          const response = document.createElement("li");
          response.setAttribute("id", `response-${responseCounter.current}`);
          responses.appendChild(response);
          }
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
        if (loc == 'inside') {
          for (let i = 0; i < 5; i++){
            const button = document.getElementById(`opt-${i}`);
            if(!button)
              continue;
            var content = data.data[i].token;
            content += "<br></br>";
            content += Math.floor(data.data[i].prob * 100) + "%";
            button.innerHTML = content;
          }
        }
      }
    };
  });
  
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      const input = document.getElementById("ask-input")! as HTMLInputElement;
      ws.current?.send(input.value);
      input.value = "";
      event.preventDefault();
  };

  function choiceSelect(choice)  {
    ws.current?.send(choice);
  }


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
    <div className="flex flex-col items-center justify-between h-screen p-4 bg-black text-lime-600">
      <div className="flex flex-row justify-start margin-20 mb-4 text-lg font-bold border-solid border-lime-500 border-2 p-2 shadow-[4px_4px_0px_#65a30d]">
        <h1 className="mr-2">User Query: </h1>
        <h2 id="userQuery"></h2>
      </div>
      <div className="flex flex-col items-center justify-center w-full max-w-[1100px]">
        <div className="w-3/4 mb-4 p-4 border-2 border-lime-500 rounded-md max-h-[300px] max-w-[1100px] overflow-y-scroll">
          <h1 className="font-bold">Your Response:</h1>
          <span id="response"></span>
          ...
        </div>
        <img className="w-full px-[9.5%]" src="public/connectors.svg"></img>
        <div id="choices" className="w-full grid grid-cols-5 justify-items-center text-center text-lg">
          <ul id="opt-0" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(1)}></ul>
          <ul id="opt-1" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(2)}></ul>
          <ul id="opt-2" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(3)}></ul>
          <ul id="opt-3" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(4)}></ul>
          <ul id="opt-4" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(5)}></ul>
        </div>
      </div>
      <div className="font-bold">
        <h3>Select the next word to continue the response</h3>
      </div>
    </div>
  );
}

export default App;
