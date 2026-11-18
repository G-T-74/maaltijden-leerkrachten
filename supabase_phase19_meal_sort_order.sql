-- Phase 19: Volgorde van maaltijden instellen door beheerders
-- Voeg sort_order kolom toe aan meals en student_meals

ALTER TABLE public.meals ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.student_meals ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Initialiseer bestaande leerkrachtenmaaltijden met een volgorde
WITH ranked_meals AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY caterer_id ORDER BY category, name) AS rn
  FROM public.meals
)
UPDATE public.meals m
SET sort_order = r.rn
FROM ranked_meals r
WHERE m.id = r.id AND (m.sort_order IS NULL OR m.sort_order = 0);

-- Initialiseer bestaande leerlingenmaaltijden met een volgorde
WITH ranked_student_meals AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY caterer_id ORDER BY name) AS rn
  FROM public.student_meals
)
UPDATE public.student_meals sm
SET sort_order = r.rn
FROM ranked_student_meals r
WHERE sm.id = r.id AND (sm.sort_order IS NULL OR sm.sort_order = 0);
