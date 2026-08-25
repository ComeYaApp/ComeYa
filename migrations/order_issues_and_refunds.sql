-- Migración: incidencias de pedido (order_issues) y libro de devoluciones (refunds)
-- Cierra el circuito "cliente reporta problema -> admin resuelve -> se devuelve dinero"
-- y da a Finanzas el concepto de cliente como destinatario de un pago.

CREATE TABLE IF NOT EXISTS order_issues (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  order_id VARCHAR(255) NOT NULL,
  ticket_id VARCHAR(255) NULL,                    -- support_tickets.id (hilo de mensajes)
  reported_by VARCHAR(255) NOT NULL,
  reporter_role VARCHAR(30) NOT NULL,             -- customer, business_owner, delivery_driver
  issue_type VARCHAR(40) NOT NULL,                -- missing_items, wrong_items, damaged, quality,
                                                  -- late_delivery, never_arrived, incomplete,
                                                  -- driver_issue, other
  description TEXT NOT NULL,
  photos TEXT NULL,                               -- JSON array de URLs
  affected_items TEXT NULL,                       -- JSON array (reembolso parcial por ítem)
  status VARCHAR(20) NOT NULL DEFAULT 'open',     -- open, in_review, resolved, rejected
  priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  resolution_type VARCHAR(30) NULL,               -- refund_full, refund_partial,
                                                  -- redelivery, rejected
  resolution_amount INT NULL,                     -- centavos
  liable_party VARCHAR(20) NULL,                  -- business, driver, platform
  customer_message TEXT NULL,
  internal_note TEXT NULL,
  assigned_to VARCHAR(255) NULL,
  resolved_by VARCHAR(255) NULL,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_issues_order (order_id),
  INDEX idx_issues_status (status),
  INDEX idx_issues_reporter (reported_by),
  INDEX idx_issues_created (created_at)
);

CREATE TABLE IF NOT EXISTS refunds (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  order_id VARCHAR(255) NOT NULL,
  issue_id VARCHAR(255) NULL,
  customer_id VARCHAR(255) NOT NULL,
  amount INT NOT NULL,                            -- centavos
  type VARCHAR(20) NOT NULL,                      -- issue, cancellation, dispute, manual
  reason TEXT NULL,
  method VARCHAR(20) NOT NULL,                    -- stripe, manual_transfer, cash_none
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  stripe_refund_id VARCHAR(255) NULL,
  stripe_payment_intent_id VARCHAR(255) NULL,
  liable_party VARCHAR(20) NULL,                  -- business, driver, platform
  business_deduction INT NOT NULL DEFAULT 0,
  driver_deduction INT NOT NULL DEFAULT 0,
  platform_cost INT NOT NULL DEFAULT 0,
  payout_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
  requested_by VARCHAR(255) NULL,                 -- admin que autorizó (NULL = automático)
  processed_at TIMESTAMP NULL,
  failure_reason TEXT NULL,
  proof_url TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_refunds_order (order_id),
  INDEX idx_refunds_issue (issue_id),
  INDEX idx_refunds_customer (customer_id),
  INDEX idx_refunds_status (status),
  INDEX idx_refunds_created (created_at)
);

-- Descuento al negocio/repartidor responsable de una incidencia
-- (modelo Uber "order error adjustment"): payouts.amount ya lo refleja.
-- MySQL 8 no soporta ADD COLUMN IF NOT EXISTS: si ya existen, saltar el error 1060.
-- scripts/apply-issue-refunds-migration.ts aplica este archivo de forma idempotente.
ALTER TABLE payouts
  ADD COLUMN adjustment_amount INT NOT NULL DEFAULT 0
    COMMENT 'Descuento por incidencia de la que este destinatario es responsable';

ALTER TABLE payouts
  ADD COLUMN adjustment_reason TEXT NULL;
