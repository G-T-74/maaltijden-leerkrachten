'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Controleer of de gebruiker een admin is
async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, isAdmin: false }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { user, isAdmin: profile?.role === 'admin' }
}

export async function importStudentsCsv(payload: any[]) {
  const supabase = await createClient()
  const { user, isAdmin } = await checkAdmin(supabase)
  
  if (!user || !isAdmin) {
    return { error: 'Geen toegang' }
  }

  // Roep de RPC functie aan
  const { data, error } = await supabase.rpc('import_students_csv', {
    p_payload: payload,
    p_imported_by: user.id
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin')
  return { success: true, result: data }
}

export async function getClassesAndStudents(schoolId: string) {
  const supabase = await createClient()
  const { user, isAdmin } = await checkAdmin(supabase)
  
  if (!user || !isAdmin) {
    return { error: 'Geen toegang' }
  }

  if (!schoolId) return { classes: [] }

  const { data: classesData, error: classesError } = await supabase
    .from('classes')
    .select(`
      id, name, level, group_id,
      students ( id, class_number, first_name, is_hidden )
    `)
    .eq('school_id', schoolId)
    .order('name')

  if (classesError) return { error: classesError.message }

  // Sorteer studenten binnen de klassen op klasnummer
  const classes = classesData?.map(c => ({
    ...c,
    students: c.students.sort((a: any, b: any) => a.class_number - b.class_number)
  })) || []

  return { classes }
}

export async function toggleStudentVisibility(studentId: string, currentHidden: boolean) {
  const supabase = await createClient()
  const { isAdmin } = await checkAdmin(supabase)
  if (!isAdmin) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('students')
    .update({ is_hidden: !currentHidden })
    .eq('id', studentId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

export async function addStudentManually(classId: string, classNumber: number, firstName: string) {
  const supabase = await createClient()
  const { isAdmin } = await checkAdmin(supabase)
  if (!isAdmin) return { error: 'Geen toegang' }

  // Check if classNumber already exists
  const { data: existing } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId)
    .eq('class_number', classNumber)
    .single()

  if (existing) {
    return { error: 'Dit klasnummer bestaat al in deze klas.' }
  }

  const { error } = await supabase
    .from('students')
    .insert({
      class_id: classId,
      class_number: classNumber,
      first_name: firstName
    })

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}
