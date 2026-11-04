'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Controleer of de gebruiker een admin is
async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin' || profile?.role === 'superadmin'
}

export async function getSchoolsWithDeadlines() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  // Haal gekoppelde scholen en de actieve school op uit het profiel
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_admin_school_id, role')
    .eq('id', user.id)
    .single()

  let schoolIds: string[] = []
  const isSuperAdmin = profile?.role === 'superadmin'

  if (isSuperAdmin) {
    const { data: allSchools } = await supabase.from('schools').select('id')
    schoolIds = allSchools?.map(s => s.id) || []
  } else {
    const { data: userSchools } = await supabase
      .from('user_schools')
      .select('school_id')
      .eq('user_id', user.id)
    schoolIds = userSchools?.map(us => us.school_id) || []
  }

  if (schoolIds.length === 0) return { schools: [], activeSchoolId: null }

  // Probeer met student_order_deadline
  let { data, error } = await supabase
    .from('schools')
    .select('id, name, logo_url, order_deadline, student_order_deadline, caterer_id, apply_toddler_factor')
    .in('id', schoolIds)
    .order('name')

  if (error && (error.code === '42703' || error.message?.includes('student_order_deadline'))) {
    // Fallback als de kolom nog niet gemigreerd is in Supabase
    const fallbackRes = await supabase
      .from('schools')
      .select('id, name, logo_url, order_deadline, caterer_id, apply_toddler_factor')
      .in('id', schoolIds)
      .order('name')
    if (fallbackRes.error) return { error: fallbackRes.error.message }
    data = fallbackRes.data?.map(s => ({ ...s, student_order_deadline: null })) || []
  } else if (error) {
    return { error: error.message }
  }

  return { schools: data, activeSchoolId: profile?.active_admin_school_id }
}

export async function setActiveAdminSchool(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('profiles')
    .update({ active_admin_school_id: schoolId })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateSchoolDeadline(schoolId: string, deadline: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('schools')
    .update({ order_deadline: deadline })
    .eq('id', schoolId)

  if (error) return { error: error.message }
  
  revalidatePath('/admin')
  revalidatePath('/')
  return { success: true }
}

export async function updateSchoolStudentDeadline(schoolId: string, deadline: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('schools')
    .update({ student_order_deadline: deadline })
    .eq('id', schoolId)

  if (error) {
    if (error.code === '42703' || error.message?.includes('student_order_deadline')) {
      return { error: 'Kolom student_order_deadline ontbreekt nog in Supabase. Voer het SQL script supabase_phase15_student_deadline.sql uit.' }
    }
    return { error: error.message }
  }
  
  revalidatePath('/admin')
  revalidatePath('/leerlingen')
  return { success: true }
}

export async function updateSchoolToddlerFactor(schoolId: string, apply: boolean) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('schools')
    .update({ apply_toddler_factor: apply })
    .eq('id', schoolId)

  if (error) return { error: error.message }
  
  revalidatePath('/admin')
  return { success: true }
}

export async function getCaterers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data: userSchools } = await supabase
    .from('user_schools')
    .select('schools(caterer_id)')
    .eq('user_id', user.id)

  const catererIds = userSchools?.map(us => (us.schools as any)?.caterer_id).filter(Boolean) || []
  if (catererIds.length === 0) return { caterers: [] }

  const { data, error } = await supabase
    .from('caterers')
    .select('id, name')
    .in('id', catererIds)
    .order('name')

  if (error) return { error: error.message }
  return { caterers: data }
}

export async function getAdminMeals(catererId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  if (!catererId) return { meals: [] }

  // Check if admin has access to this caterer via their schools
  const { data: userSchools } = await supabase
    .from('user_schools')
    .select('schools(caterer_id)')
    .eq('user_id', user.id)

  const catererIds = userSchools?.map(us => (us.schools as any)?.caterer_id).filter(Boolean) || []
  if (!catererIds.includes(catererId)) return { error: 'Geen toegang tot deze traiteur.' }

  const { data, error } = await supabase
    .from('meals')
    .select('id, name, category, price, is_active, caterer_id, caterers(name)')
    .eq('caterer_id', catererId)
    .order('category')
    .order('name')

  if (error) return { error: error.message }
  return { meals: data }
}

export async function saveMeal(formData: FormData) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const category = formData.get('category') as string
  const price = parseFloat(formData.get('price') as string)
  const caterer_id = formData.get('caterer_id') as string
  const is_active = formData.get('is_active') === 'true'

  if (!name || !category || isNaN(price) || !caterer_id) {
    return { error: 'Vul alle velden correct in.' }
  }

  if (id) {
    // Update existing
    const { error } = await supabase
      .from('meals')
      .update({ name, category, price, caterer_id, is_active })
      .eq('id', id)
      
    if (error) return { error: error.message }
  } else {
    // Create new
    const { error } = await supabase
      .from('meals')
      .insert({ name, category, price, caterer_id, is_active })
      
    if (error) return { error: error.message }
  }

  revalidatePath('/admin')
  revalidatePath('/')
  return { success: true }
}

export async function deleteMeal(id: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/admin')
  revalidatePath('/')
  return { success: true }
}

export async function getAdminStudentMeals(catererId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  if (!catererId) return { meals: [] }

  const { data, error } = await supabase
    .from('student_meals')
    .select('id, name, price_kleuter, price_lager, is_active, caterer_id, caterers(name)')
    .eq('caterer_id', catererId)
    .order('name')

  if (error) return { error: error.message }
  return { meals: data }
}

export async function saveStudentMeal(formData: FormData) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const price_kleuter = parseFloat(formData.get('price_kleuter') as string)
  const price_lager = parseFloat(formData.get('price_lager') as string)
  const caterer_id = formData.get('caterer_id') as string
  const is_active = formData.get('is_active') === 'true'

  if (!name || isNaN(price_kleuter) || isNaN(price_lager) || !caterer_id) {
    return { error: 'Vul alle velden correct in.' }
  }

  if (id) {
    const { error } = await supabase
      .from('student_meals')
      .update({ name, price_kleuter, price_lager, caterer_id, is_active })
      .eq('id', id)
      
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('student_meals')
      .insert({ name, price_kleuter, price_lager, caterer_id, is_active })
      
    if (error) return { error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function deleteStudentMeal(id: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('student_meals')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/admin')
  return { success: true }
}

export async function exportYearlyData(schoolId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  // Haal teacher orders op
  const { data: teacherOrders } = await supabase
    .from('orders')
    .select(`
      order_date,
      quantity,
      price_at_order,
      note,
      profiles ( first_name, last_name ),
      meals ( name )
    `)
    .eq('school_id', schoolId)
    .order('order_date', { ascending: true })

  // Haal student orders op
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', schoolId)

  const classIds = classes?.map(c => c.id) || []
  let studentOrders: any[] = []

  if (classIds.length > 0) {
    const { data: students } = await supabase
      .from('students')
      .select('id, class_id, first_name')
      .in('class_id', classIds)

    const studentIds = students?.map(s => s.id) || []
    
    if (studentIds.length > 0) {
      const { data } = await supabase
        .from('student_orders')
        .select(`
          order_date,
          quantity,
          price_at_order,
          student_id,
          student_meals ( name )
        `)
        .in('student_id', studentIds)
        .order('order_date', { ascending: true })
        
      if (data) {
        studentOrders = data.map(o => {
          const student = students?.find(s => s.id === o.student_id)
          const cls = classes?.find(c => c.id === student?.class_id)
          return {
            ...o,
            student_name: student?.first_name || 'Onbekend',
            class_name: cls?.name || 'Onbekend'
          }
        })
      }
    }
  }

  // Bouw CSV
  let csv = 'Datum;Besteller;Klas;Maaltijd;Type;Aantal;Totaalprijs;Opmerking\n'

  teacherOrders?.forEach(o => {
    const prof = o.profiles as any
    const meal = o.meals as any
    const naam = `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() || 'Onbekend'
    const maaltijd = meal?.name || 'Onbekend'
    const prijs = (o.quantity * o.price_at_order).toFixed(2)
    const opmerking = o.note ? `"${o.note.replace(/"/g, '""')}"` : '-'
    csv += `${o.order_date};${naam};-;${maaltijd};Leerkracht;${o.quantity};${prijs};${opmerking}\n`
  })

  studentOrders.forEach(o => {
    const smeal = o.student_meals as any
    const maaltijd = smeal?.name || 'Onbekend'
    const prijs = (o.quantity * o.price_at_order).toFixed(2)
    csv += `${o.order_date};${o.student_name};${o.class_name};${maaltijd};Leerling;${o.quantity};${prijs};-\n`
  })

  return { csv }
}

export async function resetSchoolYear(schoolId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  // 1. Verwijder orders (leerkrachten)
  const { error: err1 } = await supabase
    .from('orders')
    .delete()
    .eq('school_id', schoolId)
  if (err1) return { error: 'Fout bij verwijderen orders: ' + err1.message }

  // 2. Verwijder day_locks
  const { error: err2 } = await supabase
    .from('day_locks')
    .delete()
    .eq('school_id', schoolId)
  if (err2) return { error: 'Fout bij verwijderen day_locks: ' + err2.message }

  // 3. Verwijder students (die CASCADE naar student_orders)
  // Eerst classes ophalen
  const { data: classes } = await supabase
    .from('classes')
    .select('id')
    .eq('school_id', schoolId)
    
  if (classes && classes.length > 0) {
    const classIds = classes.map(c => c.id)
    const { error: err3 } = await supabase
      .from('students')
      .delete()
      .in('class_id', classIds)
    if (err3) return { error: 'Fout bij verwijderen leerlingen: ' + err3.message }
  }

  // Let op: we verwijderen classes NIET zodat de koppelingen met leerkrachten blijven bestaan.
  // We verwijderen Enkel de leerlingen en de bestellingen.
  
  revalidatePath('/admin')
  return { success: true }
}

// --- CLASS GROUPS MANAGEMENT ---

export async function getClassGroups(schoolId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data, error } = await supabase
    .from('class_groups')
    .select('*')
    .eq('school_id', schoolId)
    .order('name')

  if (error) return { error: error.message }
  return { groups: data }
}

export async function createClassGroup(schoolId: string, name: string, orderCode: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('class_groups')
    .insert([{ school_id: schoolId, name, order_code: orderCode }])

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateClassGroup(groupId: string, name: string, orderCode: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('class_groups')
    .update({ name, order_code: orderCode })
    .eq('id', groupId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteClassGroup(groupId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('class_groups')
    .delete()
    .eq('id', groupId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function assignClassToGroup(classId: string, groupId: string | null) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('classes')
    .update({ class_group_id: groupId })
    .eq('id', classId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getSchoolTeachers(schoolId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data, error } = await supabase
    .from('user_schools')
    .select(`
      user_id,
      profiles ( first_name, last_name )
    `)
    .eq('school_id', schoolId)

  if (error) return { error: error.message }
  
  const teachers = data.map(us => {
    const p = us.profiles as any
    return {
      id: us.user_id,
      name: `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Onbekend'
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return { teachers }
}

export async function unlinkTeacherFromSchool(userId: string, schoolId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('user_schools')
    .delete()
    .eq('user_id', userId)
    .eq('school_id', schoolId)

  if (error) return { error: error.message }
  
  return { success: true }
}

export async function getPlatformUsers() {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    
  if (error) return { error: error.message }

  const users = data.map(p => ({
    id: p.id,
    name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Onbekend',
    role: p.role
  })).sort((a, b) => a.name.localeCompare(b.name))

  return { users }
}

export async function linkTeacherToSchool(userId: string, schoolId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('user_schools')
    .insert({ user_id: userId, school_id: schoolId })

  if (error) {
    if (error.code === '23505') return { error: 'Deze leerkracht is al gekoppeld aan deze school.' }
    return { error: error.message }
  }
  return { success: true }
}

// Controleer of de gebruiker een superadmin is
async function checkSuperAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'superadmin'
}

export async function checkIsSuperAdmin() {
  const supabase = await createClient()
  return await checkSuperAdmin(supabase)
}

export async function deletePlatformUser(userId: string) {
  const supabase = await createClient()
  if (!(await checkSuperAdmin(supabase))) return { error: 'Geen toegang (enkel superadmin)' }

  try {
    const { createAdminClient } = await import('@/utils/supabase/admin')
    const adminAuthClient = createAdminClient()
    
    // Verwijder de gebruiker via Admin API (verwijdert auth.users en triggert cascade voor profiles)
    const { error } = await adminAuthClient.auth.admin.deleteUser(userId)
    
    if (error) return { error: error.message }
    return { success: true }
  } catch (e: any) {
    return { error: e.message || 'Kon gebruiker niet verwijderen.' }
  }
}

export async function resetUserPassword(userId: string, newPassword?: string) {
  const supabase = await createClient()
  if (!(await checkSuperAdmin(supabase))) return { error: 'Geen toegang (enkel superadmin)' }

  try {
    const { createAdminClient } = await import('@/utils/supabase/admin')
    const adminAuthClient = createAdminClient()
    
    // Als geen paswoord is meegegeven, genereer een random paswoord
    const passwordToSet = newPassword || Math.random().toString(36).slice(-10) + 'A1!'
    
    const { data, error } = await adminAuthClient.auth.admin.updateUserById(userId, {
      password: passwordToSet
    })
    
    if (error) return { error: error.message }
    return { success: true, newPassword: passwordToSet }
  } catch (e: any) {
    return { error: e.message || 'Kon wachtwoord niet resetten.' }
  }
}

// --- TIJDELIJKE OPENSTELLINGEN (DAY UNLOCKS) ---

function getBrusselsNowAdmin() {
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'Europe/Brussels', 
    year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
  })
  const parts = formatter.formatToParts(new Date()).reduce((acc: any, p) => Object.assign(acc, { [p.type]: p.value }), {})
  return {
    todayStr: `${parts.year}-${parts.month}-${parts.day}`,
    currentTimeStr: `${parts.hour}:${parts.minute}:${parts.second}`
  }
}

function getBrusselsISOAdmin(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute, second = 0] = timeStr.split(':').map(Number)
  
  const testUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Brussels',
    timeZoneName: 'longOffset'
  })
  const parts = formatter.formatToParts(testUtc)
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value
  let offsetMinutes = 60
  if (tzPart) {
    const match = tzPart.match(/GMT([+-]\d+)(?::(\d+))?/)
    if (match) {
      const h = parseInt(match[1], 10)
      const m = parseInt(match[2] || '0', 10)
      offsetMinutes = h * 60 + (h >= 0 ? m : -m)
    }
  }
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60 * 1000
  return new Date(utcMillis).toISOString()
}

export async function unlockDayForSchool(schoolId: string, date: string, durationMinutes: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  // Haal de school op voor deadlines
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('id, name, order_deadline, student_order_deadline')
    .eq('id', schoolId)
    .single()

  if (schoolErr || !school) return { error: 'School niet gevonden' }

  const { todayStr } = getBrusselsNowAdmin()
  let openUntilIso = ''

  if (date > todayStr) {
    // Toekomstige datum: sluiting op het standaard sluitingsuur op die dag
    const deadline = school.student_order_deadline || school.order_deadline || '08:15:00'
    openUntilIso = getBrusselsISOAdmin(date, deadline)
  } else {
    // Datum vandaag of in het verleden
    if (durationMinutes === -1) {
      // Tot einde van de huidige dag (23:59:59)
      openUntilIso = getBrusselsISOAdmin(todayStr, '23:59:59')
    } else {
      const mins = durationMinutes > 0 ? durationMinutes : 30
      openUntilIso = new Date(Date.now() + mins * 60 * 1000).toISOString()
    }
  }

  const { error: upsertErr } = await supabase
    .from('day_unlocks')
    .upsert({
      school_id: schoolId,
      unlock_date: date,
      open_until: openUntilIso,
      unlocked_by: user.id
    }, { onConflict: 'school_id,unlock_date' })

  if (upsertErr) {
    if (upsertErr.code === 'PGRST205' || upsertErr.message?.includes('day_unlocks')) {
      return { error: 'Tabel day_unlocks ontbreekt nog in Supabase. Voer het SQL script supabase_phase17_day_unlocks.sql uit in de Supabase SQL Editor.' }
    }
    return { error: 'Fout bij opslaan openstelling: ' + upsertErr.message }
  }

  revalidatePath('/admin')
  revalidatePath('/leerlingen')
  revalidatePath('/mijn-maaltijden')
  return { success: true, openUntil: openUntilIso }
}

export async function getActiveDayUnlocks(schoolId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const nowIso = new Date().toISOString()
  let query = supabase
    .from('day_unlocks')
    .select(`
      id,
      school_id,
      unlock_date,
      open_until,
      created_at,
      schools ( id, name )
    `)
    .gt('open_until', nowIso)
    .order('unlock_date', { ascending: true })

  if (schoolId) {
    query = query.eq('school_id', schoolId)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('day_unlocks')) {
      return { unlocks: [] }
    }
    return { error: error.message }
  }

  return { unlocks: data || [] }
}

export async function removeDayUnlock(unlockId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('day_unlocks')
    .delete()
    .eq('id', unlockId)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/leerlingen')
  revalidatePath('/mijn-maaltijden')
  return { success: true }
}

// --- DAGEN SLUITEN (DAY LOCKS / VAKANTIES) ---

export async function lockDaysRange(schoolId: string, startDate: string, endDate: string, reason?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  if (!startDate || !endDate) {
    return { error: 'Startdatum en einddatum zijn verplicht.' }
  }

  if (startDate > endDate) {
    return { error: 'De startdatum mag niet na de einddatum liggen.' }
  }

  // Genereer alle weekdagen in de geselecteerde periode
  const dates: string[] = []
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay() // 0 = Sun, 6 = Sat
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().split('T')[0])
    }
  }

  if (dates.length === 0) {
    return { error: 'De geselecteerde periode bevat geen weekdagen (ma-vr).' }
  }

  // Bepaal welke scholen gesloten moeten worden
  let targetSchoolIds: string[] = []
  if (schoolId === 'ALL') {
    const { data: allSchools, error: sErr } = await supabase
      .from('schools')
      .select('id')
    if (sErr || !allSchools) {
      return { error: 'Fout bij ophalen scholen: ' + (sErr?.message || 'Onbekende fout') }
    }
    targetSchoolIds = allSchools.map(s => s.id)
  } else {
    targetSchoolIds = [schoolId]
  }

  const recordsToInsert = []
  for (const sId of targetSchoolIds) {
    for (const dateStr of dates) {
      recordsToInsert.push({
        school_id: sId,
        lock_date: dateStr,
        reason: reason?.trim() || null,
        locked_by: user.id
      })
    }
  }

  const { error: upsertErr } = await supabase
    .from('day_locks')
    .upsert(recordsToInsert, { onConflict: 'school_id,lock_date' })

  if (upsertErr) {
    if (upsertErr.code === 'PGRST205' || upsertErr.message?.includes('day_locks')) {
      return { error: 'Tabel day_locks ontbreekt nog in Supabase. Voer het SQL script supabase_phase18_day_locks.sql uit in de Supabase SQL Editor.' }
    }
    return { error: 'Fout bij opslaan sluitingen: ' + upsertErr.message }
  }

  revalidatePath('/admin')
  revalidatePath('/leerlingen')
  revalidatePath('/mijn-maaltijden')
  return { success: true, count: recordsToInsert.length }
}

export async function getActiveDayLocks(schoolId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const recentPast = new Date()
  recentPast.setDate(recentPast.getDate() - 7)
  const recentPastStr = recentPast.toISOString().split('T')[0]

  let query = supabase
    .from('day_locks')
    .select(`
      id,
      school_id,
      lock_date,
      reason,
      locked_at,
      schools ( id, name )
    `)
    .gte('lock_date', recentPastStr)
    .order('lock_date', { ascending: true })

  if (schoolId && schoolId !== 'ALL') {
    query = query.eq('school_id', schoolId)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('day_locks')) {
      return { locks: [] }
    }
    return { error: error.message }
  }

  return { locks: data || [] }
}

export async function removeDayLock(schoolId: string, lockDate: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('day_locks')
    .delete()
    .eq('school_id', schoolId)
    .eq('lock_date', lockDate)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/leerlingen')
  revalidatePath('/mijn-maaltijden')
  return { success: true }
}

