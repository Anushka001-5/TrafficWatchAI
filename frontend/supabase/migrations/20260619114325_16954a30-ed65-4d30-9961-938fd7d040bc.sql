
CREATE POLICY "Auth read violation imgs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('violation-images', 'annotated-images'));
CREATE POLICY "Auth upload violation imgs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('violation-images', 'annotated-images'));
