import os
import base64
import uvicorn

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tools import tools


class cls__insert_credential(BaseModel):
    email: str
    passkey: str
    info: str


class cls__insert_commodity(BaseModel):
    email: str
    avatar: str
    product_name: str
    product_category: str
    product_description: str
    mfg_date: str
    exp_date: str | None = None
    mrp_per_unit: float
    n_units: int
    min_qty_per_order: int
    max_qty_per_order: int


class cls__insert_catalog(BaseModel):
    email: str
    avatar: str
    product_name: str
    product_category: str
    product_description: str
    mfg_date: str
    exp_date: str | None = None
    mrp_per_unit: float
    n_units: int
    min_qty_per_order: int
    max_qty_per_order: int


class cls__s2t(BaseModel):
    speech: str

class cls__navigator(BaseModel):
    interaction: str

route = FastAPI(title="agentLakshmi")
route.add_middleware\
(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


@route.get("/route/select/credential/email/{email}/passkey/{passkey}/info/{info}")
@route.get("/route/select/credential/email/{email}/passkey/{passkey}")
@route.get("/route/select/credential/info/{info}")
def func__select_credential(email=None, passkey=None, info=None):
    reqres = tools.func__select_credential(email, passkey, info)
    return reqres


@route.post("/route/insert/credential")
def func__insert_credential(credential : cls__insert_credential):
    reqres = tools.func__insert_credential(credential.email, credential.passkey, credential.info)
    return reqres


@route.post("/route/update/credential/uuid/{uuid}/is_authenticated/{is_authenticated}")
def func__update_credential(uuid, is_authenticated):
    reqres = tools.func__update_credential(uuid, is_authenticated)
    return reqres


@route.get("/route/select/commodity/email/{email}/info/{info}")
@route.get("/route/select/commodity/email/{email}")
@route.get("/route/select/commodity/info/{info}")
def func__select_commodity(email=None, info=None, relavence: bool = False):
    reqres = tools.func__select_commodity(email, info, relavence)
    return reqres


@route.post("/route/insert/commodity")
def func__insert_commodity(commodity: cls__insert_commodity):
    reqres = tools.func__insert_commodity(commodity.email, commodity.avatar, commodity.product_name, commodity.product_category, commodity.product_description, commodity.mfg_date, commodity.exp_date, commodity.mrp_per_unit, commodity.n_units, commodity.min_qty_per_order, commodity.max_qty_per_order)
    return reqres


@route.post("/route/update/commodity/uuid/{uuid}/is_authenticated/{is_authenticated}")
def func__update_commodity(uuid, is_authenticated):
    reqres = tools.func__update_commodity(uuid, is_authenticated)
    return reqres


@route.post("/route/delete/commodity/uuid/{uuid}")
def func__delete_commodity(uuid):
    reqres = tools.func__delete_commodity(uuid)
    return reqres


@route.get("/route/select/catalog/email/{email}/info/{info}")
@route.get("/route/select/catalog/email/{email}")
@route.get("/route/select/catalog/info/{info}")
def func__select_catalog(email=None, info=None, relavence: bool = False):
    reqres = tools.func__select_catalog(email, info, relavence)
    return reqres


@route.post("/route/insert/catalog")
def func__insert_catalog(catalog: cls__insert_catalog):
    reqres = tools.func__insert_catalog(catalog.email, catalog.avatar, catalog.product_name, catalog.product_category, catalog.product_description, catalog.mfg_date, catalog.exp_date, catalog.mrp_per_unit, catalog.n_units, catalog.min_qty_per_order, catalog.max_qty_per_order)
    return reqres


@route.post("/route/update/catalog/uuid/{uuid}/is_authenticated/{is_authenticated}")
def func__update_catalog(uuid, is_authenticated):
    reqres = tools.func__update_catalog(uuid, is_authenticated)
    return reqres


@route.post("/route/delete/catalog/uuid/{uuid}")
def func__delete_catalog(uuid):
    reqres = tools.func__delete_catalog(uuid)
    return reqres


@route.post("/route/message/s2t/speech")
def func__s2t(speech: cls__s2t):
    reqres = tools.func__s2t(speech.speech)
    return reqres


@route.get("/route/message/t2t/message/{message}")
def func__t2t(message):
    reqres = tools.func__t2t(message)
    return reqres


@route.post("/route/message/t2s/text/{text}")
def func__t2s(text):
    reqres = tools.func__t2s(text)
    return Response(content=base64.b64decode(reqres), media_type="audio/wav")


@route.post("/route/navigator")
def func__navigator(interaction: cls__navigator):
    reqres = tools.func__navigator(interaction.interaction)
    return reqres


@route.get("/route/scrape/url/{url:path}")
def func__scrape(url):
    reqres = tools.func__scrape(url)
    return reqres


if(): pass
elif(__name__=="__main__"):
    uvicorn.run("route:route", host="127.0.0.1", port=8008, reload=False)
else: pass



















































































# import os
# from typing import Optional

# from fastapi import FastAPI, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel

# from agent__lakshmi import run_guidance


# app = FastAPI(title="Lakshmi SHG Guidance API")


# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


# class GuidanceRequest(BaseModel):
#     question: str


# class GuidanceResponse(BaseModel):
#     element_id: Optional[str]
#     override_code: str
#     message: str


# @app.get("/health")
# def health():
#     return {"status": "ok"}


# @app.post("/api/guidance", response_model=GuidanceResponse)
# def get_guidance(payload: GuidanceRequest):

#     question = payload.question.strip()

#     if not question:
#         raise HTTPException(
#             status_code=400,
#             detail="question must not be empty"
#         )

#     try:
#         return run_guidance(question)

#     except ValueError as exc:
#         raise HTTPException(
#             status_code=502,
#             detail=str(exc)
#         ) from exc


# if __name__ == "__main__":
#     import uvicorn

#     uvicorn.run(
#         "route:route",
#         port=int(os.getenv("PORT", "8008")),
#         reload=False
#     )