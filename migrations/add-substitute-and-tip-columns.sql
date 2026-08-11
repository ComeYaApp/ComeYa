-- Migración: Agregar columnas para sustituciones y propinas
-- Fecha: 2026-07-08

-- Columna para guardar los IDs de productos sustitutos en órdenes
-- MySQL no soporta IF NOT EXISTS en ADD COLUMN, usar sintaxis simple
ALTER TABLE orders 
ADD COLUMN substitute_product_ids TEXT NULL 
COMMENT 'JSON: { originalProductId: substituteProductId }';

ALTER TABLE reviews 
ADD COLUMN tip_amount INT DEFAULT 0 
COMMENT 'Propina en centavos (ej: 100 = €1.00)';
