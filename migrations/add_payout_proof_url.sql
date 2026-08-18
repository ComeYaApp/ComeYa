-- Añade columna para el comprobante de transferencia subido por el admin
-- al marcar un payout manual como pagado (captura de Bizum/SEPA/PayPal).
ALTER TABLE payouts ADD COLUMN proof_url TEXT DEFAULT NULL;
