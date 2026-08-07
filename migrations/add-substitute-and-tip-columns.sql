-- Migración: Agregar columnas para sustituciones y propinas
-- Fecha: 2026-07-08

-- Columna para guardar los IDs de productos sustitutos en órdenes
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS substitute_product_ids TEXT NULL 
COMMENT 'JSON: { originalProductId: substituteProductId }';

-- Columna para guardar el monto de propina en reseñas
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS tip_amount INT DEFAULT 0 
COMMENT 'Propina en centavos (ej: 100 = €1.00)';