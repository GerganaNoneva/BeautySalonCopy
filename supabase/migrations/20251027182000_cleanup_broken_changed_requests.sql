-- Изтриваме всички заявки със статус 'changed' които нямат попълнени данни за предложението
-- Това са повредени заявки от старата имплементация
DELETE FROM appointment_requests
WHERE status = 'changed'
  AND (
    suggested_date IS NULL
    OR suggested_start_time IS NULL
    OR suggested_end_time IS NULL
  );

-- Проверяваме колко заявки са останали
DO $$
DECLARE
    total_count INTEGER;
    changed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM appointment_requests;
    SELECT COUNT(*) INTO changed_count FROM appointment_requests WHERE status = 'changed';

    RAISE NOTICE 'Total requests after cleanup: %', total_count;
    RAISE NOTICE 'Changed requests with valid data: %', changed_count;
END $$;
