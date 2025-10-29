-- Create a function that allows clients to notify admins
-- This bypasses RLS by using SECURITY DEFINER

CREATE OR REPLACE FUNCTION notify_admin_about_cancellation(
  p_appointment_id UUID,
  p_cancel_reason TEXT,
  p_appointment_date DATE,
  p_start_time TIME,
  p_service_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_notification_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();

  -- Verify the caller is a client
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_user_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'Only clients can call this function';
  END IF;

  -- Get the first admin user
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found';
  END IF;

  -- Insert notification for admin
  INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    data,
    is_read,
    delivered_at
  ) VALUES (
    v_admin_id,
    'appointment_cancelled_by_client',
    'Клиент отмени резервация',
    format(
      'Резервация за %s на %s в %s е отменена.

Причина: %s',
      p_service_name,
      p_appointment_date::TEXT,
      substring(p_start_time::TEXT from 1 for 5),
      p_cancel_reason
    ),
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'cancel_reason', p_cancel_reason
    ),
    false,
    NOW()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION notify_admin_about_cancellation(UUID, TEXT, DATE, TIME, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION notify_admin_about_cancellation IS
'Allows clients to send cancellation notifications to admins. Uses SECURITY DEFINER to bypass RLS.';
