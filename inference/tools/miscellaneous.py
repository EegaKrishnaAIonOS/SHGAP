import os
import json
from youtube_search import YoutubeSearch
from openai import OpenAI
from agno.tools import tool
from dotenv import load_dotenv

load_dotenv()

@tool(name="funcvideo_search")
def func__video_search(search_term):
    req = YoutubeSearch(search_term, max_results=3).to_dict()
    res = []
    for itr in range(len(req)):
        res.append({"title" : req[itr]["title"], "url" : f"https://youtube.com/{req[itr]["url_suffix"].split("&")[0]}"})
    reqres = json.dumps(res)
    return reqres


def func__relavence_product(dct__product_catogery__commodity, max__product_catogery__catalog):
    return ["49ed21f4-41ca-48c6-80a1-45f8b4425f78", "7e9dced3-7df3-4e5b-8776-e2f3812ae5d7"]

    model = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=os.getenv("NVIDIA_API_KEY"))
    message = model.chat.completions.create\
        (
            model="nvidia/nemotron-3.5-lightning-30b-a3b",
            messages=\
                [
                    {
                        "role" : "user",
                        "content": f"return the list of 'uuid' from '{dct__product_catogery__commodity}' by mapping the relativeness of the 'product_catogery' values with the '{max__product_catogery__catalog}' in the form of list [...] of 'uuid' without any intro, outro and code-blocks"
                    }
                ]
        )

    return eval(message.choices[0].message.content)
