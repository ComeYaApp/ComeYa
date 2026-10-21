-- Verificaciones (Fase 3): petición de documentos desde el panel admin y
-- normalización del estado legacy "approved" → "verified".
-- Solo cambia el estado; los documentos subidos no se tocan.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS document_requested_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS document_request_note TEXT NULL,
  ADD COLUMN IF NOT EXISTS document_requested_by VARCHAR(255) NULL;

UPDATE users SET verification_status = 'verified'
  WHERE verification_status = 'approved';
UPDATE businesses SET verification_status = 'verified'
  WHERE verification_status = 'approved';
