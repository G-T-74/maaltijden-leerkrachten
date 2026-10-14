-- Voeg student_order_deadline toe aan scholen
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS student_order_deadline TIME DEFAULT '08:15:00'::TIME;

-- Herdefinieer is_student_order_allowed om rekening te houden met de nieuwe deadline
CREATE OR REPLACE FUNCTION public.is_student_order_allowed(order_date DATE, p_school_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  day_of_week INTEGER;
  is_locked BOOLEAN;
  brussels_now timestamp;
  brussels_today date;
  brussels_time time;
  school_deadline time;
BEGIN
  -- Bepaal de dag van de week (1=Maandag, 7=Zondag)
  day_of_week := EXTRACT(ISODOW FROM order_date);
  
  -- Controleer of het Woensdag (3), Zaterdag (6) of Zondag (7) is
  IF day_of_week = 3 OR day_of_week = 6 OR day_of_week = 7 THEN
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

  -- Deadline check
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
