
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('citizen', 'police');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profile policies
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'police'));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- user_roles policies
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create profile + default citizen role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  selected_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  selected_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'citizen');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, selected_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Violation records
CREATE TABLE public.violation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  annotated_image_url TEXT,
  plate_number TEXT,
  violation_types TEXT[] NOT NULL DEFAULT '{}',
  confidence_scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  detections JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_accident BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_role TEXT NOT NULL,
  chalan_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.violation_records TO authenticated;
GRANT ALL ON public.violation_records TO service_role;
ALTER TABLE public.violation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated insert violation_records" ON public.violation_records
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Read own or police all" ON public.violation_records
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'police'));
CREATE POLICY "Police update violations" ON public.violation_records
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'police'));

-- Chalans
CREATE TABLE public.chalans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_record_id UUID NOT NULL REFERENCES public.violation_records(id) ON DELETE CASCADE,
  plate_number TEXT,
  citizen_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'issued',
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chalans TO authenticated;
GRANT ALL ON public.chalans TO service_role;
ALTER TABLE public.chalans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Police manage chalans" ON public.chalans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'police'))
  WITH CHECK (public.has_role(auth.uid(), 'police'));
CREATE POLICY "Citizens read own chalans" ON public.chalans FOR SELECT TO authenticated
  USING (
    citizen_user_id = auth.uid() OR
    violation_record_id IN (SELECT id FROM public.violation_records WHERE uploaded_by = auth.uid())
  );
CREATE POLICY "Citizens pay own chalans" ON public.chalans FOR UPDATE TO authenticated
  USING (
    citizen_user_id = auth.uid() OR
    violation_record_id IN (SELECT id FROM public.violation_records WHERE uploaded_by = auth.uid())
  );
