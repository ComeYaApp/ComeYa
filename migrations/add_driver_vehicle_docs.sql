-- ComeYa: columnas de documentos del vehículo en delivery_drivers
-- (el código las usaba pero la tabla real no las tenía: las subidas de
-- fotos fallaban con "unknown column"). Idempotente.

ALTER TABLE delivery_drivers
  ADD COLUMN vehicle_plate_photo TEXT NULL
    COMMENT 'Foto de la matrícula';

ALTER TABLE delivery_drivers
  ADD COLUMN vehicle_itv_photo TEXT NULL
    COMMENT 'Ficha ITV';

ALTER TABLE delivery_drivers
  ADD COLUMN vehicle_insurance_photo TEXT NULL
    COMMENT 'Seguro del vehículo';

ALTER TABLE delivery_drivers
  ADD COLUMN vehicle_license_photo TEXT NULL
    COMMENT 'Permiso de circulación / licencia';
