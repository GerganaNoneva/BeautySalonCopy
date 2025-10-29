-- Allow users to delete their own notifications
-- Run this in your Supabase SQL editor or apply via migrations pipeline.

-- Ensure RLS is enabled on the notifications table (safe to run if already enabled)
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
-- Policy: allow users to DELETE rows where user_id matches their authenticated UID
-- Some Postgres versions do not support `CREATE POLICY IF NOT EXISTS`, so
-- we create policies conditionally using a PL/pgSQL DO block that checks
-- pg_policy before creating.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'users_can_delete_own_notifications'
      AND polrelid = 'public.notifications'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY users_can_delete_own_notifications
      ON public.notifications
      FOR DELETE
      USING (user_id = auth.uid());';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Also ensure users can UPDATE their own notifications (mark as read)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'users_can_update_own_notifications'
      AND polrelid = 'public.notifications'::regclass
  ) THEN
    EXECUTE 'CREATE POLICY users_can_update_own_notifications
      ON public.notifications
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Note: after applying, verify in Supabase Dashboard > Auth > Policies that these policies behave as expected.
-- If your application also performs deletes from a server-side service role, those will bypass RLS.
