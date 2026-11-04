-- Fase 18: Dagen sluiten door beheerders (bv. vakanties en vrije dagen)

-- 1. Zorg dat de day_locks tabel de juiste kolommen heeft
CREATE TABLE IF NOT EXISTS public.day_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
  lock_date DATE NOT NULL,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  reason TEXT,
  UNIQUE(school_id, lock_date)
);

-- Voeg kolom reason toe voor het geval de tabel al bestond zonder reason
ALTER TABLE public.day_locks ADD COLUMN IF NOT EXISTS reason TEXT;

-- 2. RLS inschakelen
ALTER TABLE public.day_locks ENABLE ROW LEVEL SECURITY;

-- Admins volledige toegang
DROP POLICY IF EXISTS "Admins full access to day_locks" ON public.day_locks;
CREATE POLICY "Admins full access to day_locks" ON public.day_locks 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- Alle ingelogde gebruikers mogen day_locks lezen
DROP POLICY IF EXISTS "Authenticated users can read day_locks" ON public.day_locks;
CREATE POLICY "Authenticated users can read day_locks" ON public.day_locks 
FOR SELECT USING (auth.role() = 'authenticated');


-- 3. Update is_order_allowed (voor leerkrachtenmaaltijden)
CREATE OR REPLACE FUNCTION public.is_order_allowed(p_order_date date, p_school_id uuid)
RETURNS boolean AS $$
DECLARE
  brussels_now timestamp;
  brussels_today date;
  brussels_time time;
  school_deadline time;
  has_active_unlock boolean;
  is_locked boolean;
BEGIN
  -- Weiger weekenddagen (zaterdag = 6, zondag = 7 in isodow)
  IF EXTRACT(ISODOW FROM p_order_date) IN (6, 7) THEN
    RETURN false;
  END IF;

  -- Controleer eerst of er een uitzonderlijke actieve openstelling is voor deze datum
  SELECT EXISTS(
    SELECT 1 FROM public.day_unlocks
    WHERE school_id = p_school_id 
      AND unlock_date = p_order_date 
      AND open_until > now()
  ) INTO has_active_unlock;

  IF has_active_unlock THEN
    RETURN true;
  END IF;

  -- Controleer of de dag is afgesloten door een beheerder (bv. vakantiedag)
  SELECT EXISTS(
    SELECT 1 FROM public.day_locks 
    WHERE school_id = p_school_id AND lock_date = p_order_date
  ) INTO is_locked;

  IF is_locked THEN
    RETURN false;
  END IF;

  -- Haal de huidige tijd en datum in België op
  brussels_now := now() at time zone 'Europe/Brussels';
  brussels_today := brussels_now::date;
  brussels_time := brussels_now::time;

  -- Haal deadline van de school op
  SELECT order_deadline INTO school_deadline FROM public.schools WHERE id = p_school_id;
  IF school_deadline IS NULL THEN
    school_deadline := '08:15:00'::time;
  END IF;

  IF p_order_date > brussels_today THEN
    RETURN true; -- Bestellen voor een datum in de toekomst mag
  ELSIF p_order_date = brussels_today THEN
    IF brussels_time < school_deadline THEN
      RETURN true;
    ELSE
      RETURN false;
    END IF;
  ELSE
    RETURN false; -- Bestellen in het verleden is verboden
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Update is_student_order_allowed (voor leerlingenmaaltijden)
CREATE OR REPLACE FUNCTION public.is_student_order_allowed(order_date DATE, p_school_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  day_of_week INTEGER;
  is_locked BOOLEAN;
  brussels_now timestamp;
  brussels_today date;
  brussels_time time;
  school_deadline time;
  has_active_unlock boolean;
BEGIN
  -- Weiger zaterdag (6) en zondag (7)
  day_of_week := EXTRACT(ISODOW FROM order_date);
  IF day_of_week IN (6, 7) THEN
    RETURN FALSE;
  END IF;

  -- Controleer eerst of er een uitzonderlijke actieve openstelling is
  SELECT EXISTS(
    SELECT 1 FROM public.day_unlocks
    WHERE school_id = p_school_id 
      AND unlock_date = order_date 
      AND open_until > now()
  ) INTO has_active_unlock;

  IF has_active_unlock THEN
    RETURN TRUE;
  END IF;

  -- Woensdag (3) is standaard niet toegestaan tenzij geopend
  IF day_of_week = 3 THEN
    RETURN FALSE;
  END IF;

  -- Controleer of de dag is afgesloten door een beheerder
  SELECT EXISTS(
    SELECT 1 FROM public.day_locks 
    WHERE school_id = p_school_id AND lock_date = order_date
  ) INTO is_locked;

  IF is_locked THEN
    RETURN FALSE;
  END IF;

  -- Deadline check (Brusselse tijd)
  brussels_now := now() at time zone 'Europe/Brussels';
  brussels_today := brussels_now::date;
  brussels_time := brussels_now::time;

  -- Haal student_order_deadline van de school op
  SELECT student_order_deadline INTO school_deadline FROM public.schools WHERE id = p_school_id;
  IF school_deadline IS NULL THEN
    school_deadline := '08:15:00'::time;
  END IF;

  IF order_date > brussels_today THEN
    RETURN TRUE;
  ELSIF order_date = brussels_today THEN
    IF brussels_time < school_deadline THEN
      RETURN TRUE;
    ELSE
      RETURN FALSE;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
