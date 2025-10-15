from __future__ import annotations

import json
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException, UploadFile, File, Query
import os
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from . import crud, schemas
from .db import check_database_connection, get_session, init_db


app = FastAPI(title="StandAutomoveis API", version="0.2.0")

# Pilot mode: enable read-only to disable create/bulk/edit endpoints.
# Set env READ_ONLY_MODE=0 to re-enable writes.
READ_ONLY_MODE = str(os.getenv("READ_ONLY_MODE", "1")).lower() not in ("0", "false", "off", "no")

def _ensure_writable():
    if READ_ONLY_MODE:
        raise HTTPException(status_code=403, detail="Read-only mode: writes are disabled")

# Allow local dev frontend
app.add_middleware(
    CORSMiddleware,
    # For development, allow all origins. Since we do not use
    # cookies/auth here, disable credentials to remain spec-compliant
    # with wildcard origins and to avoid browser CORS rejections.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def read_root():
    return {"message": "StandAutomoveis API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db/health")
def db_health():
    ok = check_database_connection()
    return {"database": "ok" if ok else "unavailable"}


def _first_present(d: Dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None


def _raw_to_carcreate(d: Dict[str, Any]) -> schemas.CarCreate:
    # Map common scraped key names (EN + PT) to our schema
    return schemas.CarCreate(
        url=_first_present(d, "url"),
        title=_first_present(d, "title", "T\u00EDtulo"),
        make=_first_present(d, "make", "Marca"),
        model=_first_present(d, "model", "Modelo"),
        version=_first_present(d, "version", "Vers\u00E3o"),
        color=_first_present(d, "color", "Cor"),
        doors=_first_present(d, "doors", "N\u00BA de portas"),
        seats=_first_present(d, "seats", "Lota\u00E7\u00E3o"),
        engine_capacity_cc=_first_present(d, "engine_capacity", "engine_capacity_cc", "Cilindrada"),
        engine_power_cv=_first_present(d, "engine_power", "engine_power_cv", "Pot\u00EAncia"),
        fuel_type=_first_present(d, "fuel_type", "Combust\u00EDvel"),
        body_type=_first_present(d, "body_type", "Segmento"),
        gearbox=_first_present(d, "gearbox", "Tipo de Caixa"),
        transmission=_first_present(d, "transmission"),
        mileage_km=_first_present(d, "mileage", "mileage_km", "Quil\u00F3metros"),
        registration_month=_first_present(d, "registration_month", "M\u00EAs de Registo"),
        registration_year=_first_present(d, "registration_year", "Ano"),
        price=_first_present(d, "price", "priceNumber", "Pre\u00E7o"),
        currency=_first_present(d, "currency", "priceCurrency"),
        images=_first_present(d, "images") or [],
        fields_pt=_first_present(d, "fields_pt"),
    )


@app.get("/cars", response_model=List[schemas.CarRead])
def list_cars(
    make: str | None = Query(default=None),
    model: str | None = Query(default=None),
    price_min: int | None = Query(default=None, ge=0),
    price_max: int | None = Query(default=None, ge=0),
    year_min: int | None = Query(default=None, ge=1900),
    year_max: int | None = Query(default=None, ge=1900),
    sort: str | None = Query(default=None, description="price|mileage|year|id"),
    direction: str | None = Query(default="asc", description="asc|desc"),
    image_mode: str | None = Query(default=None, description="first|all"),
):
    with get_session() as db:
        cars = crud.list_cars(
            db,
            make=make,
            model=model,
            price_min=price_min,
            price_max=price_max,
            year_min=year_min,
            year_max=year_max,
            sort=sort,
            direction=direction,
        )
        if image_mode == 'first':
            out = []
            for car in cars:
                data = schemas.CarRead.model_validate(car, from_attributes=True)
                imgs = data.images or []
                data.images = imgs[:1]
                out.append(data)
            return out
        return cars


@app.get("/cars/featured", response_model=schemas.CarRead)
def get_featured():
    with get_session() as db:
        car = crud.get_featured_car(db)
        if not car:
            raise HTTPException(status_code=404, detail="No featured car")
        return car


@app.delete("/cars/featured", status_code=204)
def clear_featured():
    with get_session() as db:
        crud.clear_featured_car(db)
    return JSONResponse(status_code=204, content=None)


@app.get("/cars/{car_id}", response_model=schemas.CarRead)
def get_car(car_id: int):
    with get_session() as db:
        car = crud.get_car(db, car_id)
        if not car:
            raise HTTPException(status_code=404, detail="Car not found")
        return car


@app.post("/cars", response_model=schemas.CarRead, status_code=201)
def create_car(car_in: schemas.CarCreate):
    _ensure_writable()
    with get_session() as db:
        car = crud.create_car(db, car_in)
        return car


@app.post("/cars/bulk", response_model=List[schemas.CarRead], status_code=201)
def create_cars_bulk(cars_in: List[schemas.CarCreate]):
    _ensure_writable()
    # Basic debug log to help diagnose hanging requests in dev
    try:
        import time
        t0 = time.time()
        print(f"/cars/bulk received: {len(cars_in)} items", flush=True)
    except Exception:
        t0 = None  # type: ignore
    with get_session() as db:
        cars = crud.create_cars_bulk(db, cars_in)
    try:
        if t0 is not None:
            dt = int((time.time() - t0) * 1000)
            print(f"/cars/bulk stored: {len(cars)} items in {dt}ms", flush=True)
    except Exception:
        pass
    return list(cars)


@app.post("/cars/import", response_model=List[schemas.CarRead], status_code=201)
async def import_cars(file: UploadFile = File(...)):
    _ensure_writable()
    try:
        raw_bytes = await file.read()
        text = raw_bytes.decode("utf-8")
        data = json.loads(text)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {exc}")

    records: List[dict]
    if isinstance(data, list):
        records = data
    elif isinstance(data, dict):
        records = list(data.values())
    else:
        raise HTTPException(status_code=400, detail="JSON must be an array or an object of cars")

    car_creates = []
    for item in records:
        if not isinstance(item, dict):
            continue
        payload = item
        # Prefer nested fields_pt if it's a dict; keep images at top-level
        if isinstance(item.get("fields_pt"), dict):
            payload = {**item["fields_pt"]}
            if "images" in item:
                payload["images"] = item["images"]
            if "url" in item:
                payload["url"] = item["url"]
            if "title" in item:
                payload["title"] = item["title"]
            if "priceNumber" in item:
                payload["priceNumber"] = item["priceNumber"]
            if "priceCurrency" in item:
                payload["priceCurrency"] = item["priceCurrency"]
        car_creates.append(_raw_to_carcreate(payload))

    try:
        import time
        t0 = time.time()
        print(f"/cars/import records: {len(car_creates)}", flush=True)
    except Exception:
        t0 = None  # type: ignore

    with get_session() as db:
        cars = crud.create_cars_bulk(db, car_creates)

    try:
        if t0 is not None:
            dt = int((time.time() - t0) * 1000)
            print(f"/cars/import stored: {len(cars)} items in {dt}ms", flush=True)
    except Exception:
        pass

    return list(cars)


@app.put("/cars/{car_id}", response_model=schemas.CarRead)
def update_car(car_id: int, car_in: schemas.CarUpdate):
    _ensure_writable()
    with get_session() as db:
        car = crud.get_car(db, car_id)
        if not car:
            raise HTTPException(status_code=404, detail="Car not found")
        car = crud.update_car(db, car, car_in)
        return car


@app.delete("/cars/{car_id}", status_code=204)
def delete_car(car_id: int):
    with get_session() as db:
        car = crud.get_car(db, car_id)
        if not car:
            raise HTTPException(status_code=404, detail="Car not found")
        crud.delete_car(db, car)
    return JSONResponse(status_code=204, content=None)

@app.put("/cars/{car_id}/feature", response_model=schemas.CarRead)
def feature_car(car_id: int):
    with get_session() as db:
        car = crud.set_featured_car(db, car_id)
        if not car:
            raise HTTPException(status_code=404, detail="Car not found")
        return car
