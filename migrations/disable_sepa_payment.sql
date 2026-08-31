-- SEPA eliminada como método de pago del cliente (agosto 2026).
-- Se desactivan el método de pago y la cuenta receptora de transferencia.
-- Los pedidos y comprobantes antiguos con provider 'sepa'/'transferencia'
-- conservan sus etiquetas en la app (solo lectura, no se ofrecen de nuevo).

UPDATE payment_methods SET is_active = 0
WHERE id = 'pm-transferencia' OR LOWER(provider) IN ('sepa', 'transferencia');

UPDATE payment_receiving_accounts SET is_active = 0
WHERE LOWER(provider) IN ('sepa', 'transferencia');
