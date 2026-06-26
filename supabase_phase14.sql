-- Phase 14: Voeg kleuterfactor toe aan scholen
ALTER TABLE public.schools ADD COLUMN apply_toddler_factor boolean DEFAULT false;
