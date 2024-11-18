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
        else {
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
          else {
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

  // Handle outside
  const [waitingForQuery, setWaitingForQuery] = useState(true);
  
  const [userQuery, setUserQuery] = useState("");
  const handleUserQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => setUserQuery(event.target.value);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = document.getElementById("ask-input")! as HTMLInputElement;
    ws.current?.send(input.value);
    setWaitingForQuery(false);
  };

  // Handle inside
  function choiceSelect(choice: number)  {
    ws.current?.send(choice.toString());
  }


  // Render the interface
  return loc === "outside" ? (
    <div className={`w-screen h-screen flex flex-col items-center justify-center bg-[url("/editomorrow.webp")] bg-center bg-cover bg-no-repeat bg-white/30 bg-blend-lighten`}>
      <img 
        src="/edinbot.webp"
        alt="Edinbot logo"
        className="w-[16.5rem] -mb-6 drop-shadow-[0_0_32px_white]"
      />
      <div className="w-[70%] flex flex-col border border-white/80 backdrop-blur-3xl rounded-lg shadow-[4px_4px_32px_#bebebe,-4px_-4px_32px_#ffffff] overflow-hidden">
        <div className={`bg-white/70 ${waitingForQuery ? "hover:bg-white/90 focus-within:bg-white/90" : ""} transition-colors`}>
          {/* User input */}
          <form
            onSubmit={handleSubmit}
            className="flex"
          >
            <input
              id="ask-input"
              type="text"
              value={userQuery}
              placeholder="Ask me about Edinburgh!"
              onChange={handleUserQueryChange}
              readOnly={!waitingForQuery}
              className={`grow p-6 text-xl placeholder:text-gray-600 bg-transparent focus:outline-none ${waitingForQuery ? "rounded-l-lg" : "rounded-lg"}`}
            />
            {
              waitingForQuery &&
              <button
                type="submit"
                className="p-6 bg-blue-950 hover:bg-blue-800 text-white font-bold text-xl"
              >
                ASK
              </button>
            }
          </form>
          {/* Model output */}
          { !waitingForQuery &&
            <ul
              id="responses"
              className="p-6 text-xl space-y-2 border-t border-white/80"
            >
            </ul>
          }
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
