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

from fastapi import FastAPI
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

ui_folder_root=getenv("UI_FOLDER_ROOT")
ui_proxy_url = getenv("UI_PROXY_URL")
ui_proxy_launch_cmd = getenv("UI_PROXY_LAUNCH_CMD")

app_frontend_path = path.join(app_root_path, ui_folder_root)

# -----------------------------------------------------------------------------------------------------------

# Load the model
model_id = "meta-llama/Llama-3.1-8B-Instruct"
#model_id = "Unispac/Gemma-2-9B-IT-With-Deeper-Safety-Alignment"
max_new_tokens = 50
num_choices = 5

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
system_prompt = "You are a chatbot that is incredibly knowledgeable about Scotland."

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
        generated_text += new_text
        if "<|eot_id|>" in new_text:
            new_text = new_text.replace("<|eot_id|>", "")
        yield new_text
    # print(generated_text)
    chat_history += generated_text
    # print(chat_history)


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
        generator(question.prompt),
        media_type='text/event-stream'
    )


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
