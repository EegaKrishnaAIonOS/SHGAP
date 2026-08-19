import os
import json
from pathlib import Path

from dotenv import load_dotenv
from agno.agent import Agent
from agno.models.openai import OpenAIChat

from tools import tools


# --------------------------------------------------
# Load environment variables
# --------------------------------------------------

load_dotenv()


# --------------------------------------------------
# Create NVIDIA + Agno agent
# --------------------------------------------------

agent = Agent(
    model=OpenAIChat(
        id="meta/llama-3.1-8b-instruct",
        api_key=os.getenv("NVIDIA_API_KEY"),
        base_url="https://integrate.api.nvidia.com/v1",
    )
)


# --------------------------------------------------
# Discover all project files
# --------------------------------------------------

files = tools.get_all_files(str(tools.INTERFACE_DIR))

print("Files discovered:")

for file in files:
    print(f"  {file}")


# --------------------------------------------------
# Main function called by FastAPI
# --------------------------------------------------

def run_guidance(question: str):

    # ==================================================
    # STEP 1: LLM selects the relevant file
    # ==================================================

    file_prompt = f"""
You are a file-selection assistant.

These are the ONLY files that exist in the project:

{chr(10).join(files)}

User question:
{question}

Select the most relevant file or files.

Rules:
- Only return paths from the provided list.
- Never invent a filename.
- If no file is relevant, return exactly: NO_MATCH
- Do not read file contents.
- Return only file paths or NO_MATCH.
"""

    response = agent.run(file_prompt)

    result = response.content.strip()

    selected_files = []

    for line in result.splitlines():

        line = line.strip()

        if line in files:
            selected_files.append(line)


    # ==================================================
    # If no matching file
    # ==================================================

    if not selected_files:

        return {
            "element_id": None,
            "override_code": "",
            "message": "No matching file found."
        }


    # ==================================================
    # STEP 2: Read the selected files
    # ==================================================

    file_contents = {}

    for file in selected_files:

        content = tools.read_file(file)

        if content:
            file_contents[file] = content


    # ==================================================
    # STEP 3: Send file contents to LLM
    # ==================================================

    content_text = ""

    for file, content in file_contents.items():

        content_text += f"""
FILE: {file}

CONTENT:
{content}

--------------------------------
"""


    # ==================================================
    # STEP 4: Ask LLM for guidance JSON
    # ==================================================

    guidance_prompt = f"""
You are a UI guidance assistant.

User question:
{question}

The relevant project files and their contents are:

{content_text}

Your task:

1. Find the HTML element that the user should interact with.
2. Find the actual id attribute of that element.
3. The element_id MUST already exist in the provided HTML.
4. Never invent an element ID.
5. Generate JavaScript that applies a box-shadow to that element.
6. Generate a short helpful message for the user.

Return ONLY valid JSON.

Required JSON format:

{{
    "element_id": "actual-id-from-html",
    "override_code": "document.getElementById('actual-id-from-html').style.boxShadow = '0 0 10px 4px gray';",
    "message": "Short instruction for the user."
}}

IMPORTANT:
- Use the exact HTML id.
- Do not create a new ID.
- Make sure the JavaScript syntax is valid.
- Use single quotes consistently inside the JavaScript string.
- Do not include markdown.
- Do not include ```json.
- Return JSON only.

If no suitable element exists, return:

{{
    "element_id": null,
    "override_code": "",
    "message": "No suitable element found."
}}
"""


    # ==================================================
    # STEP 5: Ask LLM
    # ==================================================

    guidance_response = agent.run(guidance_prompt)

    guidance_text = guidance_response.content.strip()


    # ==================================================
    # STEP 6: Parse LLM response as JSON
    # ==================================================

    try:

        guidance = json.loads(guidance_text)

    except json.JSONDecodeError:

        return {
            "element_id": None,
            "override_code": "",
            "message": "LLM returned invalid JSON."
        }


    # ==================================================
    # STEP 7: Validate element ID
    # ==================================================

    element_id = guidance.get("element_id")

    if element_id:

        found = False

        for content in file_contents.values():

            if (
                f'id="{element_id}"' in content
                or f"id='{element_id}'" in content
            ):
                found = True
                break


        if not found:

            return {
                "element_id": None,
                "override_code": "",
                "message": "Element ID does not exist in the selected file."
            }


    # ==================================================
    # STEP 8: Save guidance JSON
    # ==================================================

    guidance_file = Path("guidance.json")

    guidance_file.write_text(
        json.dumps(guidance, indent=4),
        encoding="utf-8"
    )


    # ==================================================
    # STEP 9: Return result to FastAPI
    # ==================================================

    return guidance