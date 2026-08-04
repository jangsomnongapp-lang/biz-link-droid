DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own portfolio photos'
  ) THEN
    CREATE POLICY "Users can upload own portfolio photos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'portfolio-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own portfolio photos'
  ) THEN
    CREATE POLICY "Users can update own portfolio photos"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'portfolio-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'portfolio-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own portfolio photos'
  ) THEN
    CREATE POLICY "Users can delete own portfolio photos"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'portfolio-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Portfolio photos are publicly readable'
  ) THEN
    CREATE POLICY "Portfolio photos are publicly readable"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'portfolio-photos');
  END IF;
END $$;