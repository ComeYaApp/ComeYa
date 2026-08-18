-- ComeYa: preferencias de notificaciones + sistema de referidos
-- Aplicar sobre la BD de producción (MySQL/Aiven). Idempotente.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_preferences TEXT NULL
    COMMENT 'JSON {promotions:bool, news:bool}; pedidos siempre activos';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by VARCHAR(255) NULL
    COMMENT 'users.id de quien invitó a este usuario';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_rewarded_at TIMESTAMP NULL
    COMMENT 'Fecha en que se otorgó la recompensa por su primer pedido';

-- Índice único para el código de referido (permite NULL repetidos en MySQL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON users (referral_code);

-- Valor por defecto: promos y novedades activadas para usuarios existentes
UPDATE users
  SET notification_preferences = '{"promotions":true,"news":true}'
  WHERE notification_preferences IS NULL;
