import json5
import os
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
from supabase import create_client
from dotenv import load_dotenv

from tools.miscellaneous import *

load_dotenv()


db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def func__init_credential():
    with open(Path(__file__).resolve().parent.parent.parent/"datum"/"raw"/"indian_ap_district_postal_pincode.jsonc") as fl:
        lookup = {itr["district_code"]: itr for itr in json5.load(fl)}
    lst_ap_state_district_code = [37, 502, 503, 504, 505, 506, 510, 511, 515, 517, 519, 520, 521, 523, 743, 744, 745, 746, 747, 748, 749, 750, 751, 752, 753, 754, 755, 790, 791]
    for itr in lst_ap_state_district_code:
        email = f"sAP.{itr:03d}@ap.gov.in"
        passkey_hex = "\\x"+f"sAP#{itr:03d}".encode().hex()

        if(): pass
        elif(itr!=37):
            var_district = lookup[itr]
            info = [{"role": "district", "district_name": var_district["district_name"], "list_pincode": var_district["list_pincode"]}]
        elif(itr==37):
            info = [{"role": "state", "district_name": var_district["district_name"], "list_pincode": var_district["list_pincode"]} for var_district in lookup.values()]
        else: pass

        db.table("credential")\
        .upsert\
        (
            {"email": email, "passkey": passkey_hex, "info": info, "is_authenticated": 1}, 
            on_conflict="email", ignore_duplicates=True
        )\
        .execute()

    lst_dct__default_user = \
    [
        {
            "email": "retailer.user@example.com",
            "passkey": "retailer#0000",
            "info": \
            [
                {
                    "role": "retailer", "mode": "individual", "name": "retailer", 
                    "contact": "+9100000000", "address": "NTR",
                    "pincode": "520001", "nationality": "India"
                }
            ]
        },
        {
            "email": "SHG.user@example.com",
            "passkey": "SHG#4444",
            "info": \
            [
                {
                    "role": "SHG", "mode": "individual", "name": "SHG",
                    "contact": "+914444444444", "address": "NTR",
                    "pincode": "520001", "nationality": "India"
                }
            ]
        },
        {
            "email": "consumer.user@example.com",
            "passkey": "consumer#8888",
            "info": \
            [
                {
                    "role": "consumer", "mode": "individual", "name": "consumer",
                    "contact": "+9188888888", "address": "NTR",
                    "pincode": "520001", "nationality": "India"
                }
            ]
        }
    ]
    for itr in lst_dct__default_user:
        db.table("credential")\
        .upsert\
        (
            {"email": itr["email"], "passkey": "\\x"+itr["passkey"].encode().hex(), "info": itr["info"], "is_authenticated": 1}, 
            on_conflict="email", ignore_duplicates=True
        )\
        .execute()

    dct__db_agentlakshmi__aionos = \
    {
        "email" : "db.agentLakshmi@aionos.ai",
        "passkey" : "agentLakshmi#20240423",
        "info" : [{"db" : "agentLakshmi", "organisation" : "AIONOS"}]
    }
    db.table("credential").upsert\
    (
        {"email": dct__db_agentlakshmi__aionos["email"], "passkey": "\\x"+dct__db_agentlakshmi__aionos["passkey"].encode().hex(), "info": dct__db_agentlakshmi__aionos["info"], "is_authenticated": 1}, 
        on_conflict="email", ignore_duplicates=True
    )\
    .execute()
# func__init_credential()


def func__select_credential(email, passkey, info=None):
    if(): pass
    elif(info!=None):
        info = json5.loads(info)
        if(): pass
        elif(info.get("district_name", None)):
            print()     
            query = db.table("credential").select("info->0->>list_pincode")\
                    .filter("info->0->>district_name","eq", info["district_name"])\
                    .execute()
            query = db.table("credential").select("*")\
                    .eq("info->0->>role", "SHG")\
                    .in_("info->0->>pincode", eval(query.data[0]["list_pincode"]))\
                    .execute()
        elif(info.get("role", None)):
            query = db.table("credential")\
                    .select("*")\
                    .filter("info->0->>role","eq", info["role"])\
                    .execute()
        else: pass
    elif(info==None):
        query = db.table("credential")\
                .select("*")\
                .eq("email", email)\
                .eq("passkey", "\\x"+passkey.encode().hex())\
                .execute()
    else: pass

    reqres = query.data
    return reqres


def func__insert_credential(email, passkey, info):
    query = db.table("credential")\
            .upsert\
            (
                {"email": email, "passkey": "\\x"+passkey.encode().hex(), "info": json5.loads(info), "is_authenticated": 0}, 
                on_conflict="email", ignore_duplicates=True
            )\
            .execute()
    reqres = query.data
    return reqres


def func__update_credential(uuid, is_authenticated):
    query = db.table("credential")\
            .update({"is_authenticated": is_authenticated, "modified" : datetime.now(timezone.utc).isoformat()})\
            .eq("uuid", uuid)\
            .execute()
    reqres = query.data
    return reqres


def func__delete_credential():
    ...


def func__init_commodity():
    lst_dct__default_commodity = \
    [
        {
            "product_name": "Raw Cotton Yarn",
            "product_category": "Textile Raw Material",
            "product_description": "Grade A combed cotton yarn, 40s count, sourced from Guntur ginning mills, used for handloom weaving",
            "mfg_date": "2026-06-15",
            "exp_date": None,
            "mrp_per_unit": 185.00,
            "n_units": 500,
            "min_qty_per_order": 10,
            "max_qty_per_order": 100
        },
        {
            "product_name": "Turmeric Powder (Bulk)",
            "product_category": "Spice Raw Material",
            "product_description": "Unpolished turmeric powder from Duggirala variety, curcumin content 3.5%+, sold in 25kg sacks",
            "mfg_date": "2026-05-20",
            "exp_date": "2027-11-20",
            "mrp_per_unit": 220.00,
            "n_units": 300,
            "min_qty_per_order": 5,
            "max_qty_per_order": 50
        },
        {
            "product_name": "Palm Leaf Sheets",
            "product_category": "Handicraft Raw Material",
            "product_description": "Dried and pressed palm leaf sheets for basket and plate weaving, sourced from coastal AP",
            "mfg_date": "2026-04-10",
            "exp_date": None,
            "mrp_per_unit": 12.50,
            "n_units": 2000,
            "min_qty_per_order": 50,
            "max_qty_per_order": 500
        },
        {
            "product_name": "Raw Groundnut Oilseed",
            "product_category": "Oilseed Raw Material",
            "product_description": "Unprocessed groundnut kernels for cold-press oil extraction, sourced from Anantapur farms",
            "mfg_date": "2026-06-01",
            "exp_date": "2026-12-01",
            "mrp_per_unit": 95.00,
            "n_units": 1000,
            "min_qty_per_order": 20,
            "max_qty_per_order": 200
        }
    ]
    for itr in lst_dct__default_commodity:
        db.table("commodity")\
        .upsert\
        (
            {"product_name": itr["product_name"], "product_category": itr["product_category"], "product_description": itr["product_description"], "mfg_date": itr["mfg_date"], "exp_date": itr["exp_date"], "mrp_per_unit": itr["mrp_per_unit"], "n_units": itr["n_units"], "min_qty_per_order": itr["min_qty_per_order"], "max_qty_per_order": itr["max_qty_per_order"], "email": "retailer.user@example.com", "is_authenticated": 1},
        )\
        .execute()
# func__init_commodity()


def func__select_commodity(email=None, info=None, relavence=False):
    info = json5.loads(info) if(info!=None) else None
    if(): pass
    elif(email != None and info == None):
        query = db.table("commodity")\
                .select("*")\
                .eq("email", email)\
                .execute()
    elif(info.get("role", None) in ["AIONOS", "state"]):
        query = db.table("commodity")\
                .select("*")\
                .execute()
    elif(info.get("role", None) in ["district", "SHG"]):
        query = db.table("commodity")\
                .select("*")\
                .eq("is_authenticated", 1)\
                .execute()
    reqres = query.data

    if(): pass
    elif(relavence == True):
        query = db.table("catalog")\
                .select("product_category")\
                .eq("email", email)\
                .execute()

        max__product_catogery__catalog = Counter(itr["product_category"] for itr in query.data).most_common(1)[0][0]
        dct__product_catogery__commodity = [{itr["uuid"] : itr["product_category"]} for itr in reqres]

        reqres = {"reqres" : reqres, "relavence" : func__relavence_product(dct__product_catogery__commodity, max__product_catogery__catalog)}
    else: pass

    return reqres


def func__insert_commodity(email, avatar, product_name, product_category, product_description, mfg_date, exp_date, mrp_per_unit, n_units, min_qty_per_order, max_qty_per_order):
    query = db.table("commodity")\
            .insert\
            (
                {"email": email, "avatar": avatar, "product_name": product_name, "product_category": product_category, "product_description": product_description, "mfg_date": mfg_date, "exp_date": exp_date, "mrp_per_unit": mrp_per_unit, "n_units": n_units, "min_qty_per_order": min_qty_per_order, "max_qty_per_order": max_qty_per_order, "is_authenticated": 0}
            )\
            .execute()
    reqres = query.data
    return reqres


def func__update_commodity(uuid, is_authenticated):
    query = db.table("commodity")\
            .update({"is_authenticated": is_authenticated, "modified" : datetime.now(timezone.utc).isoformat()})\
            .eq("uuid", uuid)\
            .execute()
    reqres = query.data
    return reqres


def func__delete_commodity(uuid):
    query = db.table("commodity")\
            .delete()\
            .eq("uuid", uuid)\
            .execute()
    reqres = query.data
    return reqres


def func__init_catalog():
    lst_dct__default_catalog = \
    [
        {
            "product_name": "Handwoven Cotton Saree",
            "product_category": "Handloom Textile",
            "product_description": "Traditional handwoven cotton saree with ikat border, made by SHG weavers using locally sourced yarn",
            "mfg_date": "2026-07-05",
            "exp_date": None,
            "mrp_per_unit": 1450.00,
            "n_units": 60,
            "min_qty_per_order": 1,
            "max_qty_per_order": 10
        },
        {
            "product_name": "Homemade Turmeric-Chili Pickle",
            "product_category": "Packaged Food",
            "product_description": "Traditional AP-style pickle made with sun-dried chili and turmeric, no preservatives, 250g jar",
            "mfg_date": "2026-07-20",
            "exp_date": "2027-01-20",
            "mrp_per_unit": 120.00,
            "n_units": 400,
            "min_qty_per_order": 2,
            "max_qty_per_order": 30
        },
        {
            "product_name": "Palm Leaf Woven Basket",
            "product_category": "Handicraft",
            "product_description": "Eco-friendly woven basket made from palm leaf sheets, ideal for home storage and gifting",
            "mfg_date": "2026-06-25",
            "exp_date": None,
            "mrp_per_unit": 350.00,
            "n_units": 150,
            "min_qty_per_order": 1,
            "max_qty_per_order": 20
        },
        {
            "product_name": "Cold-Pressed Groundnut Oil",
            "product_category": "Packaged Food",
            "product_description": "100% pure cold-pressed groundnut oil, bottled and sealed by SHG unit, 1L bottle",
            "mfg_date": "2026-07-01",
            "exp_date": "2027-01-01",
            "mrp_per_unit": 210.00,
            "n_units": 250,
            "min_qty_per_order": 1,
            "max_qty_per_order": 15
        }
    ]
    for itr in lst_dct__default_catalog:
        db.table("catalog")\
        .upsert\
        (
            {"product_name": itr["product_name"], "product_category": itr["product_category"], "product_description": itr["product_description"], "mfg_date": itr["mfg_date"], "exp_date": itr["exp_date"], "mrp_per_unit": itr["mrp_per_unit"], "n_units": itr["n_units"], "min_qty_per_order": itr["min_qty_per_order"], "max_qty_per_order": itr["max_qty_per_order"], "email": "SHG.user@example.com", "is_authenticated": 1},
        )\
        .execute()
# func__init_catalog()


def func__select_catalog(email=None, info=None, relavence=False):
    info = json5.loads(info) if(info!=None) else None
    if(): pass
    elif(email != None):
        query = db.table("catalog")\
                .select("*")\
                .eq("email", email)\
                .execute()
    elif(info.get("role", None) in ["AIONOS", "state"]):
        query = db.table("catalog")\
                .select("*")\
                .execute()
    elif(info.get("role", None) in ["district"]):
            if(): pass
            elif(info.get("district_name", None)):
                query = db.table("credential").select("info->0->>list_pincode")\
                        .filter("info->0->>district_name","eq", info["district_name"])\
                        .execute()
                query = db.table("credential").select("email")\
                        .eq("info->0->>role", "SHG")\
                        .in_("info->0->>pincode", eval(query.data[0]["list_pincode"]))\
                        .execute()
                query = db.table("catalog").select("*")\
                        .in_("email", [itr["email"] for itr in query.data])\
                        .execute()
            # elif(info.get("role", None)):
            #     query = db.table("catalog")\
            #             .select("*")\
            #             .filter("info->0->>role","eq", info["role"])\
            #             .execute()
            else: pass
    elif(info.get("role", None) in ["consumer"]):
        query = db.table("catalog")\
                .select("*")\
                .eq("is_authenticated", 1)\
                .execute()
    reqres = query.data
    return reqres


def func__insert_catalog(email, avatar, product_name, product_category, product_description, mfg_date, exp_date, mrp_per_unit, n_units, min_qty_per_order, max_qty_per_order):
    query = db.table("catalog")\
            .insert\
            (
                {"email": email, "avatar": avatar, "product_name": product_name, "product_category": product_category, "product_description": product_description, "mfg_date": mfg_date, "exp_date": exp_date, "mrp_per_unit": mrp_per_unit, "n_units": n_units, "min_qty_per_order": min_qty_per_order, "max_qty_per_order": max_qty_per_order, "is_authenticated": 0}
            )\
            .execute()
    reqres = query.data
    return reqres

def func__update_catalog(uuid, is_authenticated):
    query = db.table("catalog")\
            .update({"is_authenticated": is_authenticated, "modified" : datetime.now(timezone.utc).isoformat()})\
            .eq("uuid", uuid)\
            .execute()
    reqres = query.data
    return reqres


def func__delete_catalog(uuid):
    query = db.table("catalog")\
            .delete()\
            .eq("uuid", uuid)\
            .execute()
    reqres = query.data
    return reqres


# info = {"role" : "district", "district_name" : "NTR"}