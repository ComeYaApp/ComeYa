-- Suscripciones por negocio (Fase 6): el plan se contrata para un negocio
-- concreto. Null = plan de cliente o suscripción legacy (todos los negocios).
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS business_id VARCHAR(255) NULL AFTER user_id;
