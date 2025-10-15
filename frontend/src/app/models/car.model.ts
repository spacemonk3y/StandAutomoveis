export interface Car {
  id: number;
  url?: string | null;
  title?: string | null;
  make?: string | null;
  model?: string | null;
  version?: string | null;
  color?: string | null;

  doors?: number | null;
  seats?: number | null;
  engine_capacity_cc?: number | null;
  engine_power_cv?: number | null;
  fuel_type?: string | null;
  body_type?: string | null;
  gearbox?: string | null;
  transmission?: string | null;
  mileage_km?: number | null;

  registration_month?: string | null;
  registration_year?: number | null;

  price?: number | null;
  currency?: string | null;

  images?: string[] | null;
  fields_pt?: Record<string, unknown> | null;
  is_featured?: boolean | null;
}

export type CarCreate = Omit<Car, 'id'>;
export type CarUpdate = Partial<CarCreate>;
