-- Métodos de pago para ComeYa España
-- Ejecutar en Aiven MySQL

INSERT INTO payment_methods (id, name, provider, display_name, is_active, requires_manual_verification, instructions, commission_percentage, created_at)
VALUES 
  ('pm-stripe-card',  'stripe_card',  'stripe_card',  'Tarjeta',  1, 0, 'Pago seguro con tarjeta via Stripe. Visa, Mastercard y Amex aceptadas.', 1.5, NOW()),
  ('pm-stripe-bizum', 'stripe_bizum', 'stripe_bizum', 'Bizum',    1, 0, 'Pago instantaneo con Bizum via Stripe. Solo disponible en Espana.',      0.0, NOW()),
  ('pm-bizum-manual', 'bizum',        'bizum',        'Bizum Manual', 1, 1, 'Transfiere via Bizum al numero de ComeYa y sube el comprobante.',      0.0, NOW()),
  ('pm-transferencia','transferencia','transferencia','Transferencia bancaria', 1, 1, 'Transfiere via SEPA/IBAN y sube el comprobante.',              0.0, NOW())
ON DUPLICATE KEY UPDATE
  is_active = VALUES(is_active),
  instructions = VALUES(instructions);
