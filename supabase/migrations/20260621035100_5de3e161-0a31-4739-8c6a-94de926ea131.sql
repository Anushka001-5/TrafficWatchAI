
DROP POLICY IF EXISTS "Citizens pay own chalans" ON public.chalans;

-- Enforce immutability and payment-only updates via trigger (no self-select in RLS)
CREATE OR REPLACE FUNCTION public.enforce_citizen_chalan_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'police') THEN
    RETURN NEW;
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.plate_number IS DISTINCT FROM OLD.plate_number
     OR NEW.violation_record_id IS DISTINCT FROM OLD.violation_record_id
     OR NEW.issued_by IS DISTINCT FROM OLD.issued_by
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.citizen_user_id IS DISTINCT FROM OLD.citizen_user_id THEN
    RAISE EXCEPTION 'Citizens cannot modify chalan fields other than status/paid_at';
  END IF;
  IF NEW.status <> 'paid' OR NEW.paid_at IS NULL THEN
    RAISE EXCEPTION 'Citizens can only mark chalans as paid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_citizen_chalan_update_trg ON public.chalans;
CREATE TRIGGER enforce_citizen_chalan_update_trg
  BEFORE UPDATE ON public.chalans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_citizen_chalan_update();

CREATE POLICY "Citizens pay own chalans" ON public.chalans
FOR UPDATE TO authenticated
USING (
  (citizen_user_id = auth.uid()
   OR violation_record_id IN (SELECT id FROM public.violation_records WHERE uploaded_by = auth.uid()))
  AND NOT public.has_role(auth.uid(), 'police')
)
WITH CHECK (
  citizen_user_id = auth.uid()
  OR violation_record_id IN (SELECT id FROM public.violation_records WHERE uploaded_by = auth.uid())
);
