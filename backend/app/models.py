from __future__ import annotations

from decimal import Decimal
from typing import Optional

from sqlalchemy import Integer, String, Numeric, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from .db import Base


class Car(Base):
    __tablename__ = "cars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Basic info
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    make: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    model: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Specs
    doors: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    seats: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    engine_capacity_cc: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    engine_power_cv: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fuel_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    body_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    gearbox: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    transmission: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mileage_km: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Registration
    registration_month: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    registration_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Pricing
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)

    # JSON blobs
    images: Mapped[Optional[list[str]]] = mapped_column(JSONB, nullable=True)
    fields_pt: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Featured flag (oportunidade da semana)
    is_featured: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, default=False)
