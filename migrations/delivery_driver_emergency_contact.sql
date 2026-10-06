-- Contacto de emergencia del repartidor (declarado en "Ser Repartidor").
-- Antes se pedía en la app pero se descartaba al no existir la columna.
ALTER TABLE delivery_drivers ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
