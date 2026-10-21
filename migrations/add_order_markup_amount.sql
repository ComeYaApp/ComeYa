-- Modelo de precios compuesto (Fase 2): el markup (5 %) y la comisión se
-- guardan por separado para que el CSV y las finanzas cuadren al céntimo.
-- Solo afecta a pedidos nuevos; los históricos no se reescriben.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS markup_amount INT DEFAULT 0 AFTER productos_base;
