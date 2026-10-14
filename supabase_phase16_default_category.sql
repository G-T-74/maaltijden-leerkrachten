-- Fase 16: Voorkeur maaltijdcategorie toevoegen aan profielen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_meal_category TEXT DEFAULT NULL;
