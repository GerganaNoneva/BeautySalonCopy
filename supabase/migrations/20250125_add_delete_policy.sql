-- Enable DELETE for clients on their own appointments
DROP POLICY IF EXISTS "clients_can_delete_own_appointments" ON appointments;

CREATE POLICY "clients_can_delete_own_appointments"
ON appointments FOR DELETE
TO authenticated
USING (client_id = auth.uid());

-- Also allow admins to delete any appointment
DROP POLICY IF EXISTS "admins_can_delete_any_appointment" ON appointments;

CREATE POLICY "admins_can_delete_any_appointment"
ON appointments FOR DELETE
TO authenticated
USING (is_admin());
