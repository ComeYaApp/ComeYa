-- ComeYa: token de push por usuario (para notificaciones Expo reales)
-- Idempotente; tolera columna ya existente al aplicarse con
-- scripts/apply-pending-migrations.js

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS push_token TEXT NULL
    COMMENT 'Expo push token del dispositivo';
