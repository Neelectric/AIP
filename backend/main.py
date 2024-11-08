import subprocess
from pydantic import BaseModel
import uvicorn

from os import getenv, path
from dotenv import load_dotenv

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

# from langchain.llms.openai import OpenAI
from langchain_ollama import OllamaLLM

app_base = path.dirname(__file__)
app_root = path.join(app_base, '../')
# app_public = path.join(app_base, "public/")
app_public = path.join(app_root, "frontend/public")

load_dotenv(dotenv_path=path.join(app_root, '.env'))

app_env = getenv("APP_ENVIRONMENT")
app_host = getenv("APP_HTTP_HOST")
app_port = int(getenv("APP_HTTP_PORT"))
app_spa_folder = path.join(app_root, getenv("APP_SPA_FOLDER_ROOT"))
app_spa_proxy_url = getenv("APP_SPA_PROXY_URL")
app_spa_proxy_launch_cmd = getenv("APP_SPA_PROXY_LAUNCH_CMD")

# APP_SPA_PROXY_LAUNCH_CMD
class Question(BaseModel):
    prompt: str


app = FastAPI()
templates = Jinja2Templates(directory=app_public)
app.mount("/public", StaticFiles(directory=app_public), name="public")

# llm = OpenAI(
#     streaming=True,
#     verbose=True,
#     temperature=0,
#     openai_api_key=getenv("OPENAI_API_KEY")
# )

llm = OllamaLLM(
    model="llama3.1",
    streaming=True,
    verbose=True,
    temperature=0,
    )

response = llm.invoke("The first man on the moon was ...")
print(response)


@app.post('/api/ask')
async def ask(question: Question):
    print(question)

    def generator(prompt: str):
        for item in llm.stream(prompt):
            print(item)
            # stream to second ipad()
            # if item needs branching:
            # 
            yield item

    return StreamingResponse(
        generator(question.prompt),
        media_type='text/event-stream'
        )


@app.get("/api/reply")
def reply(value: str):
    print(f"reply: {value}")

    return {"reply": value}


@app.get("/{full_path:path}")
async def serve_spa_app(request: Request, full_path: str):
    """Serve the react app
    `full_path` variable is necessary to serve each possible endpoint with
    `index.html` file in order to be compatible with `react-router-dom
    """
    if app_env.lower() == "development":
        return RedirectResponse(app_spa_proxy_url)

    return templates.TemplateResponse("index.html", {"request": request})


if __name__ == "__main__":

    # Launching the SPA proxy server
    if app_env.lower() == "development":
        print("Launching the SPA proxy server...", app_spa_folder)
        spa_process = subprocess.Popen(
            args=app_spa_proxy_launch_cmd.split(" "),
            cwd=app_spa_folder)

    uvicorn.run("main:app", host=app_host, reload=True, port=app_port)