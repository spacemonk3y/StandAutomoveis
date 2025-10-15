from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, field_validator


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int,)):
        return value
    s = str(value)
    digits = "".join(ch for ch in s if ch.isdigit())
    return int(digits) if digits else None


def _to_price(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    s = str(value)
    # keep digits and at most one decimal separator (.)
    # common input: "24 990" -> 24990; "24.990" -> 24990; "24,990" -> 24990
    cleaned = "".join(ch for ch in s if ch.isdigit())
    return Decimal(cleaned) if cleaned else None


class CarBase(BaseModel):
    url: Optional[str] = None
    title: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    version: Optional[str] = None
    color: Optional[str] = None

    doors: Optional[int] = None
    seats: Optional[int] = None
    engine_capacity_cc: Optional[int] = None
    engine_power_cv: Optional[int] = None
    fuel_type: Optional[str] = None
    body_type: Optional[str] = None
    gearbox: Optional[str] = None
    transmission: Optional[str] = None
    mileage_km: Optional[int] = None

    registration_month: Optional[str] = None
    registration_year: Optional[int] = None

    price: Optional[Decimal] = None
    currency: Optional[str] = None

    images: Optional[list[str]] = None
    fields_pt: Optional[dict] = None
    is_featured: Optional[bool] = None

    # Coercion validators for common scraped string formats
    @field_validator("doors", "seats", "engine_capacity_cc", "engine_power_cv", "mileage_km", "registration_year", mode="before")
    @classmethod
    def _coerce_ints(cls, v):
        return _to_int(v)

    @field_validator("price", mode="before")
    @classmethod
    def _coerce_price(cls, v):
        return _to_price(v)


class CarCreate(CarBase):
    pass


class CarUpdate(CarBase):
    pass


class CarRead(CarBase):
    id: int

    class Config:
        from_attributes = True
