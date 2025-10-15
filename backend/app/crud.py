from __future__ import annotations

from typing import Iterable, List, Sequence, Optional

from sqlalchemy.orm import Session

from . import models, schemas


def list_cars(
    db: Session,
    *,
    make: Optional[str] = None,
    model: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    sort: Optional[str] = None,
    direction: Optional[str] = "asc",
) -> List[models.Car]:
    q = db.query(models.Car)
    if make:
        q = q.filter(models.Car.make.ilike(f"%{make}%"))
    if model:
        q = q.filter(models.Car.model.ilike(f"%{model}%"))
    if price_min is not None:
        q = q.filter(models.Car.price.isnot(None)).filter(models.Car.price >= price_min)
    if price_max is not None:
        q = q.filter(models.Car.price.isnot(None)).filter(models.Car.price <= price_max)
    if year_min is not None:
        q = q.filter(models.Car.registration_year.isnot(None)).filter(models.Car.registration_year >= year_min)
    if year_max is not None:
        q = q.filter(models.Car.registration_year.isnot(None)).filter(models.Car.registration_year <= year_max)

    sort_map = {
        "price": models.Car.price,
        "mileage": models.Car.mileage_km,
        "year": models.Car.registration_year,
        "id": models.Car.id,
    }
    col = sort_map.get((sort or "").lower())
    if col is None:
        col = models.Car.id
        direction = "desc"

    if (direction or "asc").lower() == "desc":
        q = q.order_by(col.desc())
    else:
        q = q.order_by(col.asc())
    return q.all()


def get_car(db: Session, car_id: int) -> models.Car | None:
    return db.get(models.Car, car_id)


def create_car(db: Session, car_in: schemas.CarCreate) -> models.Car:
    car = models.Car(**car_in.model_dump(exclude_unset=True))
    db.add(car)
    db.commit()
    db.refresh(car)
    return car


def create_cars_bulk(db: Session, cars_in: Iterable[schemas.CarCreate]) -> Sequence[models.Car]:
    cars = [models.Car(**c.model_dump(exclude_unset=True)) for c in cars_in]
    db.add_all(cars)
    db.commit()
    for c in cars:
        db.refresh(c)
    return cars


def update_car(db: Session, car: models.Car, car_in: schemas.CarUpdate) -> models.Car:
    data = car_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(car, field, value)
    db.add(car)
    db.commit()
    db.refresh(car)
    return car


def delete_car(db: Session, car: models.Car) -> None:
    db.delete(car)
    db.commit()


def get_featured_car(db: Session) -> models.Car | None:
    return db.query(models.Car).filter(models.Car.is_featured.is_(True)).first()


def set_featured_car(db: Session, car_id: int) -> models.Car | None:
    # Clear existing featured flags, then set for the requested car
    db.query(models.Car).update({models.Car.is_featured: False})
    car = db.get(models.Car, car_id)
    if not car:
        db.commit()
        return None
    car.is_featured = True
    db.add(car)
    db.commit()
    db.refresh(car)
    return car


def clear_featured_car(db: Session) -> None:
    db.query(models.Car).update({models.Car.is_featured: False})
    db.commit()
