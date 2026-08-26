import os
import uvicorn

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from tools import tools

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


@route.post("/route/insert/credential/email/{email}/passkey/{passkey}/info/{info}")
def func__insert_credential(email, passkey, info):
    reqres = tools.func__insert_credential(email, passkey, info)
    return reqres


@route.post("/route/update/credential/uuid/{uuid}/is_authenticated/{is_authenticated}")
def func__update_credential(uuid, is_authenticated):
    reqres = tools.func__update_credential(uuid, is_authenticated)
    return reqres


@route.get("/route/select/commodity/email/{email}/info/{info}")
@route.get("/route/select/commodity/email/{email}")
@route.get("/route/select/commodity/info/{info}")
def func__select_commodity(email=None, info=None):
    reqres = tools.func__select_commodity(email, info)
    return reqres


@route.post("/route/insert/commodity/product_name/{product_name}/product_category/{product_category}/product_description/{product_description}/mfg_date/{mfg_date}/exp_date/{exp_date}/mrp_per_unit/{mrp_per_unit}/n_units/{n_units}/min_qty_per_order/{min_qty_per_order}/max_qty_per_order/{max_qty_per_order}/email/{email}")
def func__insert_commodity(product_name, product_category, product_description, mfg_date, exp_date, mrp_per_unit, n_units, min_qty_per_order, max_qty_per_order, email):
    reqres = tools.func__insert_commodity(product_name, product_category, product_description, mfg_date, exp_date, mrp_per_unit, n_units, min_qty_per_order, max_qty_per_order, email)
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
def func__select_catalog(email=None, info=None):
    reqres = tools.func__select_catalog(email, info)
    return reqres


@route.post("/route/insert/catalog/product_name/{product_name}/product_category/{product_category}/product_description/{product_description}/mfg_date/{mfg_date}/exp_date/{exp_date}/mrp_per_unit/{mrp_per_unit}/n_units/{n_units}/min_qty_per_order/{min_qty_per_order}/max_qty_per_order/{max_qty_per_order}/email/{email}")
def func__insert_catalog(product_name, product_category, product_description, mfg_date, exp_date, mrp_per_unit, n_units, min_qty_per_order, max_qty_per_order, email):
    reqres = tools.func__insert_catalog(product_name, product_category, product_description, mfg_date, exp_date, mrp_per_unit, n_units, min_qty_per_order, max_qty_per_order, email)
    return reqres


@route.post("/route/update/catalog/uuid/{uuid}/is_authenticated/{is_authenticated}")
def func__update_catalog(uuid, is_authenticated):
    reqres = tools.func__update_catalog(uuid, is_authenticated)
    return reqres


@route.post("/route/delete/catalog/uuid/{uuid}")
def func__delete_catalog(uuid):
    reqres = tools.func__delete_catalog(uuid)
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