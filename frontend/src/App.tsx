import React, { useEffect, useRef, useState } from "react";
// import sql from "./db";


type Loc = "outside" | "inside";

type Data = {
  type: string;
  data: any;
};

// Figure out what our location is
const params = new URLSearchParams(document.location.search);
const loc = params.get("loc") as Loc;


// Download file method
const downloadFile = (uriComponent: string | number | boolean, fileName: string) => {
	const data = "data:text/json;charset=utf-8," + encodeURIComponent(uriComponent);
	const downloadAnchor = document.createElement("a");
	downloadAnchor.setAttribute("href", data);
	downloadAnchor.setAttribute("download", fileName + ".json");
	document.body.appendChild(downloadAnchor);
	downloadAnchor.click();
	downloadAnchor.remove();
};


function App() {
  const [gameFinished, setGameFinished] = useState(false);
  const responseRef = useRef("");

  const responseCounter = useRef(0);
  const prevToken = useRef("");

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
     ws.current = new WebSocket(`ws://127.0.0.1:5000/ws/${loc}`);
    //ws.current = new WebSocket(`wss://dashing-treefrog-actively.ngrok-free.app/ws/${loc}`);

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
          // const responseContent = document.createTextNode(`EdinBot: `);
          // response.appendChild(responseContent);
          responses.appendChild(response);
        }
      }
      else if(data.type === "next_token") {
        const token = data.data as string;
        let respID = "";
        if(loc == 'inside'){
          respID = 'response';
        }
        else {
          respID = `response-${responseCounter.current}`;
        }
        const response = document.getElementById(respID);
        if(!response) return;

        if (token === "<|eot_id|>") {
          responseRef.current = responseRef.current.concat(token);
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
          responseRef.current = responseRef.current.concat(token);
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
      else if(data.type === "finish") {
        setGameFinished(true);
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
    ws.current?.send(JSON.stringify({ type: "start_game", data: input.value}));
    setWaitingForQuery(false);
  };

  // const insertConversation = async (name: string) => {
  //   const insertion = await sql`
  //     insert into tests
  //       (name)
  //     values
  //       (${name})
  //     returning name
  //   `;

  //   return insertion;
  // };

  const restartGame = () => {
    if (confirm("Would you like to save this conversation?")) {
      // Save the conversation
      // insertConversation("test test test");
      downloadFile(JSON.stringify({ date: Date.now(), prompt: userQuery, response: responseRef.current }), (new Date()).toISOString());
    }
    responseRef.current = "";
    setGameFinished(false);
    setWaitingForQuery(true);
    setUserQuery("");
  };

  // Handle inside
  const choiceSelect = (choice: number) => {
    ws.current?.send(JSON.stringify({ type: "choice", data: choice }));
  };


  // Render the interface
  return loc === "outside" ? (
    <div className={`w-screen h-screen flex flex-col items-center justify-center bg-[url("/editomorrow.webp")] bg-center bg-cover bg-no-repeat bg-white/30 bg-blend-lighten`}>
      <img 
        src="./edinbot.webp"
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
              autoComplete="off"
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
            <div className="flex items-center p-6 border-t border-white/80">
              { !gameFinished &&
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" className="inline-block mr-4 animate-spin" viewBox="0 0 16 16">
                  <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                </svg>
              }
              <ul
                id="responses"
                className="text-xl space-y-2"
              >
              </ul>
            </div>
          }
        </div>
      </div>
      { gameFinished &&
        <button
          className="mt-8 border border-white/80 backdrop-blur-3xl rounded-full shadow-[4px_4px_32px_#bebebe,-4px_-4px_32px_#ffffff] active:shadow-[2px_2px_16px_#bebebe,-2px_-2px_16px_#ffffff] overflow-hidden transition-shadow"
          onClick={restartGame}
        >
          <div className="bg-white/70 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" className="fill-blue-950" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2z"/>
              <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466"/>
            </svg>
          </div>
        </button>
      }
    </div>
  ) : (
    <div>
      <div className="absolute position-center flex flex-col justify-around p-8 text-center z-10 w-[90vw] h-[90vh] mx-[5vw] my-[5vh] bg-black bg-opacity-80 rounded-lg border-solid border-lime-500 border-2 text-lime-600 shadow-[0px_0px_30px_#65a30d]">
        <h2 className="font-bold">Welcome</h2>
        <p>Text generators respond to prompts by predicting the most likely next token, essentially building replies one word at a time. A bit of randomness, 
          like choosing (sampling) from the top 5 words instead of the most likely one, keeps their answers interesting but also makes them less reliable.</p>
        <p>Today, <span className="underline">you</span> get to be that random factor. See how much your choices steer the output, and decide
        exactly how helpful you want EdinBot to be!</p>
      </div>
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
          {!gameFinished && <img className="w-full px-[9.5%]" src="connectors.svg"></img>}
          {!gameFinished && <div id="choices" className="w-full grid grid-cols-5 justify-items-center text-center text-lg">
            <ul id="opt-0" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(1)}></ul>
            <ul id="opt-1" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(2)}></ul>
            <ul id="opt-2" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(3)}></ul>
            <ul id="opt-3" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(4)}></ul>
            <ul id="opt-4" className="cursor-pointer rounded-lg shadow-[0px_0px_20px_#65a30d] hover:font-bold m-2 p-2" onClick={() => choiceSelect(5)}></ul>
          </div>}
        </div>
        <div className="font-bold">
          {!gameFinished && <h3>Select the next word to continue the response</h3>}
          {gameFinished && <h3>Response complete. Thanks for playing!</h3>}
        </div>
      </div>
    </div>
  );
}

export default App;
