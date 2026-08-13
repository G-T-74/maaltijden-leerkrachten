-- Voeg class_groups tabel toe
CREATE TABLE class_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Zorg dat groepen via RLS beschermd kunnen worden (simpel beleid voor beheerders)
ALTER TABLE class_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beheerders kunnen class_groups bekijken" 
ON class_groups FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
);

CREATE POLICY "Beheerders kunnen class_groups aanmaken" 
ON class_groups FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
);

CREATE POLICY "Beheerders kunnen class_groups wijzigen" 
ON class_groups FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
);

CREATE POLICY "Beheerders kunnen class_groups verwijderen" 
ON class_groups FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'admin' OR profiles.role = 'superadmin')
  )
);

-- Voeg class_group_id toe aan classes tabel
ALTER TABLE classes ADD COLUMN class_group_id UUID REFERENCES class_groups(id) ON DELETE SET NULL;
