-- Add promotion_id column to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN appointments.promotion_id IS 'Reference to promotion if this appointment is for a promotion instead of a service';

-- Add check constraint to ensure either service_id or promotion_id is set (but not both)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_service_or_promotion_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_service_or_promotion_check
  CHECK (
    (service_id IS NOT NULL AND promotion_id IS NULL) OR
    (service_id IS NULL AND promotion_id IS NOT NULL)
  );

-- Add promotion_id column to appointment_requests table
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN appointment_requests.promotion_id IS 'Reference to promotion if this request is for a promotion instead of a service';

-- Add check constraint to ensure either service_id or promotion_id is set (but not both)
ALTER TABLE appointment_requests DROP CONSTRAINT IF EXISTS appointment_requests_service_or_promotion_check;
ALTER TABLE appointment_requests ADD CONSTRAINT appointment_requests_service_or_promotion_check
  CHECK (
    (service_id IS NOT NULL AND promotion_id IS NULL) OR
    (service_id IS NULL AND promotion_id IS NOT NULL)
  );
