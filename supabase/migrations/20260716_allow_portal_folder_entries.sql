-- Match the access model used by folders, folder_catalogs, and folder_sources.
-- Authenticated users can read the organizer hierarchy; only admins can change it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'folder_entries'
      AND policyname = 'Authenticated users can read folder_entries'
  ) THEN
    CREATE POLICY "Authenticated users can read folder_entries"
      ON public.folder_entries
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'folder_entries'
      AND policyname = 'Admins can manage folder_entries'
  ) THEN
    CREATE POLICY "Admins can manage folder_entries"
      ON public.folder_entries
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;
