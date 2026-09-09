import os
import io
import base64
import json

from pathlib import Path
from sarvamai import SarvamAI
from agno.agent import Agent
from agno.models.openai.like import OpenAILike
from dotenv import load_dotenv
from textwrap import dedent


load_dotenv()


def func__navigator(interaction):
    with open(Path(__file__).resolve().parent.parent.parent/"interface"/"index.json", "r") as fl:
        jsn = json.load(fl)

    pmpt__navigator_interaction = \
    f"""
    name :: agentLakshmi
    task :: an innovative intelligent assistant
    context :: as per the query return the json containing the step to perform along with highlighting the element as per the requirements by reading the structure of the file-elements
    instructions ::
        - the response needs to be in the json with structure {{"interaction" : "...", "element" : <js code to hightling the element with 'box-shadow' of '0px 0px 2px 2px gray'>}}
        - donot add the codeblocks while returing the content
    restrictions ::
        - if no element relavent within the file then return empty json with the structural keys as "interaction" with "no matching element detected" and for "element" with "<script></script>"
    content ::
    {jsn}
    """

    model = SarvamAI(api_subscription_key=os.getenv("SARVAM_API_KEY"))

    s2t = model.speech_to_text.transcribe(file=io.BytesIO(base64.b64decode(interaction)), model="saaras:v3").transcript
    t2t = Agent(model = OpenAILike(base_url="https://api.sarvam.ai/v1", api_key=os.getenv("SARVAM_API_KEY"), id="sarvam-105b", system_prompt=dedent(pmpt__navigator_interaction), supports_json_schema_outputs=True))
    print(t2t.run(input=s2t).content)
    parsed = json.loads(t2t.run(input=s2t).content)
    t2s = model.text_to_speech.convert(text=parsed["interaction"], model="bulbul:v3", language_code="te-IN", speaker="ishita").audios[0]

    reqres = {"interaction" : t2s, "element" : parsed["element"]}
    # print(reqres)

    # info = ...
    # # reqres = info.content.strip("\n")

    return reqres

















































































# from pathlib import Path

# # Resolved relative to this file, not the process's current working
# # directory. The service can be launched with different CWDs (e.g.
# # `npm run dev` runs it from inside inference/, not the repo root where
# # interface/ actually lives, since that's what inference/package.json's
# # "dev" script's cwd is) - a CWD-relative "interface" string then silently
# # resolves to a nonexistent directory, get_all_files() returns zero files,
# # and every guidance question fails with "No matching file found" no matter
# # what was asked.
# INTERFACE_DIR = Path(__file__).resolve().parent.parent.parent / "interface"


# # --------------------------------------------------
# # Find every file recursively
# # --------------------------------------------------

# def get_all_files(project_path: str) -> list[str]:
#     root = Path(project_path)

#     excluded_dirs = {
#         ".git",
#         ".venv",
#         "__pycache__",
#         ".pytest_cache",
#         ".ruff_cache",
#         "node_modules",
#     }

#     excluded_files = {
#         ".env",
#     }

#     files = []

#     for file in root.rglob("*"):
#         if not file.is_file():
#             continue

#         if any(part in excluded_dirs for part in file.parts):
#             continue

#         if file.name in excluded_files:
#             continue

#         files.append(str(file.relative_to(root)))

#     return files

# # --------------------------------------------------
# # Read file content
# # --------------------------------------------------

# def read_file(file_path: str) -> str:
#     path = INTERFACE_DIR / file_path


#     try:
#         return path.read_text(encoding="utf-8")
#     except (UnicodeDecodeError, OSError):
#         return ""