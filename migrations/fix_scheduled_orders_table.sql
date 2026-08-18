-- ComeYa: alinear scheduled_orders con el esquema usado por el código
-- (la migración original tenía columnas distintas). Idempotente.

ALTER TABLE scheduled_orders
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(255) NULL
    COMMENT 'ID del pedido real creado al ejecutarse';

ALTER TABLE scheduled_orders
  ADD COLUMN IF NOT EXISTS delivery_latitude TEXT NULL;

ALTER TABLE scheduled_orders
  ADD COLUMN IF NOT EXISTS delivery_longitude TEXT NULL;

-- Columnas de la migración antigua que el código ya no usa
ALTER TABLE scheduled_orders
  DROP COLUMN IF EXISTS recurring_pattern;
