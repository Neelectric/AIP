# Main driver file to prompt our model
# System imports
import subprocess
from os import getenv, path
from threading import Thread

# External imports
from dotenv import load_dotenv

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer
from pydantic import BaseModel

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import uvicorn


#--- Environment prep --#
# Automatic device recognition
device = "cpu"
if torch.cuda.is_available(): device = "cuda"
elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available(): device = "mps"
# print(f"Using device {device}")

# Read in environment variables
app_base_path = path.dirname(__file__)
app_root_path = path.join(app_base_path, '../')
load_dotenv(dotenv_path=path.join(app_root_path, '.env'))

server_http_host=getenv("SERVER_HTTP_HOST")
api_http_port=int(getenv("API_HTTP_PORT"))
api_http_url=getenv("API_HTTP_URL")

ui_folder_root="frontend"
ui_proxy_launch_cmd = getenv("UI_PROXY_LAUNCH_CMD")

app_frontend_path = path.join(app_root_path, ui_folder_root)

# -----------------------------------------------------------------------------------------------------------

# Load the model
model_id = "meta-llama/Llama-3.1-8B-Instruct"
#model_id = "Unispac/Gemma-2-9B-IT-With-Deeper-Safety-Alignment"
max_new_tokens = 600
num_choices = 7

tokenizer = AutoTokenizer.from_pretrained(
    model_id
)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map=device,
    attn_implementation="eager",
    load_in_4bit=True
)
tokenizer.pad_token = tokenizer.eos_token
model.generation_config.pad_token_id = tokenizer.pad_token_id
model.generation_config.return_dict_in_generate = True
model.generation_config.output_scores = True
model.generation_config.output_logits = True
model.generation_config.do_sample = False

streamer = TextIteratorStreamer(
    tokenizer, 
    skip_prompt=True, 
    decode_kwargs=dict(skip_special_tokens = True)
)

chat_history = []
#system_prompt = "You are a chatbot simulating a resident of Leith, in Scotland. In recent years the demand for housing increased immensely in the whole city, as well as Leith. As a result, rent prices shot up immensely, and many landlords forced tenants out of their flats to capitalize on new rental contracts with higher rates. You and many close friends of your community lost your long-term homes and had to resettle to other parts of the city were you were still able to afford rent. You are incredibly bitter and sad about this development, and have strong opinions about people who have taken your old flat and the landlords who forced you out."
system_prompt = "You are a chatbot very knowledgeable about Edinburgh, giving responses in no more than one sentence."


def generator(prompt: str, chat_history=chat_history):
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]
    input_messages = tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
    inputs = tokenizer(input_messages, return_tensors='pt').to(device)
    generation_kwargs = dict(inputs, streamer=streamer, max_new_tokens=1000)
    thread = Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()
    generated_text = ""
    for new_text in streamer:
        print(new_text)
        if "<|eot_id|>" in new_text:
            new_text = new_text.replace("<|eot_id|>", "")
        generated_text += new_text
        # yield new_text
    return generated_text
    # print(generated_text)
    # chat_history += generated_text
    # print(chat_history)


def generator_dynamic(prompt: str, chat_history=chat_history):
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]
    input_messages = tokenizer.apply_chat_template(
        messages, 
        add_generation_prompt=True,
        tokenize=False
        )
    inputs = tokenizer(input_messages, return_tensors='pt').to(device)

    input_ids = inputs["input_ids"]
    num_tokens_input = input_ids.shape[-1]
    attention_mask = inputs["attention_mask"]

    # generate a token at a time
    for i in range(max_new_tokens):
        generate_decoder_only_output = model.generate(
            input_ids=input_ids, 
            attention_mask=attention_mask, 
            max_new_tokens=1, 
            do_sample=False, 
            temperature=None, 
            top_p=None
        ) # is now of type GenerateDecoderOnlyOutput

        # softmax the scores and find the topk tokens with their probabilities
        output_ids = generate_decoder_only_output["sequences"]
        scores = generate_decoder_only_output["scores"][0]
        probs = torch.nn.functional.softmax(scores, dim=-1)
        topk, indices = torch.topk(probs, k=num_choices, dim=-1)
        topk = torch.squeeze(topk).tolist()
        indices = torch.squeeze(indices)

        # if highest probability is below 40% we branch
        if topk[0] < 0.3: 
            print("-"*100)
            for i, pair in enumerate(zip(topk, indices)):
                prob, index = pair
                detokenized = tokenizer.decode(index, skip_special_tokens=True)
                prob*=100
                print(f"{i+1}, {prob:.2f}%, {int(index)}, {detokenized}") #     
            print("-"*100)
            input_text = input("'Please add enter the number of the token you believe should come next:' ")
            choice_index = int(input_text)-1
            choice = indices[choice_index]

        else:
            choice = indices[0]
        choice = choice.unsqueeze(dim=0).unsqueeze(dim=0) # this is quite ugly but we effectively need it to have shape [1,1]
        input_ids = torch.cat((input_ids, choice), dim=1)
        attention_mask = torch.ones(1, input_ids.shape[-1]).to(device)
        detokenized_current_text = tokenizer.decode(input_ids.squeeze()[num_tokens_input:])
        print(tokenizer.decode(int(choice)))
        yield tokenizer.decode(int(choice))

    #     if "<|eot_id|>" in new_text:
    #         new_text = new_text.replace("<|eot_id|>", "")
    #     yield new_text
    # chat_history += generated_text


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()


# Launch the app
class Question(BaseModel):
    prompt: str

app = FastAPI()

# Route for testing the API
@app.get("/")
async def root():
    return {"message": "Hello from FastAPI!"}

# Route for getting a response to a query
@app.post('/ask')
async def ask(question: Question):
    # print(question)
    return StreamingResponse(
        generator_dynamic(question.prompt),
        media_type='text/event-stream'
    )

# Route for testing websockets
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # await manager.send_personal_message(f"You asked: {data}", websocket)
            await manager.broadcast(f"Client {client_id} asked: {data}")
            reply = generator(data)
            await manager.broadcast(reply)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(f"Client {client_id} left the chat")
# Single-socket connection
# async def websocket_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     while True:
#         data = await websocket.receive_text()
#         reply = generator(data)
#         await websocket.send_text(reply)


if __name__ == "__main__":
    # Launch the frontend app as a separate Python subprocess
    # (essentially just goes to the frontend server and runs 'npm run dev' there for us)
    spa_process = subprocess.Popen(
        args=ui_proxy_launch_cmd.split(" "),
        cwd=app_frontend_path
    )
    # Launch the backend server
    # Uvicorn is a server programme that runs the 'app' object in 'main.py' (here)
    uvicorn.run("main:app", host=server_http_host, port=api_http_port)
