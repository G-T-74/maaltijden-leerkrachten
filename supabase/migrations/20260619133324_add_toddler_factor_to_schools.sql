-- Add a column to apply the toddler factor to the schools table
ALTER TABLE schools ADD COLUMN apply_toddler_factor boolean DEFAULT false;
