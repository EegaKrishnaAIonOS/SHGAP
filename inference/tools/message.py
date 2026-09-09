import os
import io
import base64

from dotenv import load_dotenv
from sarvamai import SarvamAI
from agno.agent import Agent
from agno.models.openai.like import OpenAILike
from textwrap import dedent

from tools.miscellaneous import *

load_dotenv()


def func__s2t(speech):
    s2t = SarvamAI(api_subscription_key=os.getenv("SARVAM_API_KEY"))
    reqres = s2t.speech_to_text.transcribe(file=io.BytesIO(base64.b64decode(speech)), model="saaras:v3")
    return reqres.transcript


def func__t2t(message):
    pmpt__t2t = \
    """
    name :: agentLakshmi
    task :: an innovative intelligent assistant
    context :: as per the query return the info in the scope of "Government of 'Andhra Pradesh' State-India"-"SHG" in which the primary user roles are {{retailers | SHG | consumer}} where retailer supply goods to SHG and consumer purchase goods from SHG
    instructions ::
        - be polite, obideient and helpful where the terms needs to be well-known to a general public
        - provide information in the same query language structured as step-by-step manner than just formating in a plain text
    restrictions ::
        - if the query is not related to the scope kindly inform that it is out of scope by structuring as a meaning sentence without providing information as per the query
    toolcall ::
        - when the query is about to get info of "how to make a product" in any of the language, then must need to call the `func__video_search` by passing the parameter as "how to make <product> in <language>" in english language argument and need to return as a markdown format of by compiling the template:
            ```{{md}}
            <explain the process as in steps>
            <br>
            <b>source</b>:
                * [title](<url>)
            ```
    """

    t2t = Agent\
    (
        model = OpenAILike\
        (
            base_url="https://api.sarvam.ai/v1",
            api_key=os.getenv("SARVAM_API_KEY"),
            id="sarvam-105b-conversations",
            system_prompt=dedent(pmpt__t2t)
        ),
        tools=[func__video_search]
    )

    info = t2t.run(input=message)
    reqres = info.content.strip("\n")

    return reqres


def func__t2s(text):
    t2s = SarvamAI(api_subscription_key=os.getenv("SARVAM_API_KEY"))
    reqres = t2s.text_to_speech.convert(text=text, model="bulbul:v3", language_code="te-IN", speaker="ishita")
    return reqres.audios[0]