'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getMealsForSchool(schoolId: string) {
  const supabase = await createClient()

  // Haal caterer_id op voor de gegeven school
  const { data: school } = await supabase
    .from('schools')
    .select('caterer_id, logo_url, name')
    .eq('id', schoolId)
    .single()

  if (!school?.caterer_id) {
    return { error: 'Geen traiteur gevonden voor deze school.', meals: [], school }
  }

  // Haal actieve maaltijden op voor deze caterer
  const { data: meals } = await supabase
    .from('meals')
    .select('*')
    .eq('caterer_id', school.caterer_id)
    .eq('is_active', true)
    .order('category')
    .order('name')

  return { meals: meals || [], school }
}

export async function placeOrder(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Je moet ingelogd zijn om te bestellen.' }
  }

  const schoolId = formData.get('school_id') as string
  const mealId = formData.get('meal_id') as string
  const quantity = parseInt(formData.get('quantity') as string, 10)
  const orderDate = formData.get('order_date') as string

  if (!schoolId || !mealId || !quantity || !orderDate) {
    return { error: 'Vul alle verplichte velden in.' }
  }

  if (quantity < 1) {
    return { error: 'Aantal moet minimaal 1 zijn.' }
  }

  // Haal maaltijd details op voor de prijs
  const { data: meal } = await supabase
    .from('meals')
    .select('price')
    .eq('id', mealId)
    .single()

  if (!meal) {
    return { error: 'Maaltijd niet gevonden.' }
  }

  // Check 08:15 deadline via onze PostgreSQL functie
  const { data: isAllowed, error: dbError } = await supabase
    .rpc('is_order_allowed', { p_order_date: orderDate })

  if (dbError) {
    console.error('Database error checking deadline:', dbError)
    return { error: 'Fout bij het controleren van de deadline.' }
  }

  if (!isAllowed) {
    return { error: 'De deadline (08:15) voor deze datum is verstreken.' }
  }

  const { error: insertError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      school_id: schoolId,
      meal_id: mealId,
      quantity,
      order_date: orderDate,
      price_at_order: meal.price
    })

  if (insertError) {
    console.error('Insert error:', insertError)
    return { error: 'Er is een fout opgetreden bij het plaatsen van de bestelling.' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteOrder(orderId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Je moet ingelogd zijn.' }
  }

  // Haal de order op om de datum te checken
  const { data: order } = await supabase
    .from('orders')
    .select('order_date')
    .eq('id', orderId)
    .single()

  if (!order) {
    return { error: 'Bestelling niet gevonden.' }
  }

  // Check deadline
  const { data: isAllowed, error: dbError } = await supabase
    .rpc('is_order_allowed', { p_order_date: order.order_date })

  if (dbError || !isAllowed) {
    return { error: 'Je kunt deze bestelling niet meer annuleren (deadline verstreken).' }
  }

  // Delete it
  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)

  if (deleteError) {
    return { error: 'Fout bij verwijderen van bestelling.' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateOrder(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Je moet ingelogd zijn.' }
  }

  const orderId = formData.get('order_id') as string
  const mealId = formData.get('meal_id') as string
  const quantity = parseInt(formData.get('quantity') as string, 10)

  if (!orderId || !mealId || !quantity || quantity < 1) {
    return { error: 'Ongeldige invoer.' }
  }

  // Haal de order op om de datum te checken
  const { data: order } = await supabase
    .from('orders')
    .select('order_date')
    .eq('id', orderId)
    .single()

  if (!order) {
    return { error: 'Bestelling niet gevonden.' }
  }

  // Check deadline
  const { data: isAllowed, error: dbError } = await supabase
    .rpc('is_order_allowed', { p_order_date: order.order_date })

  if (dbError || !isAllowed) {
    return { error: 'Je kunt deze bestelling niet meer wijzigen (deadline verstreken).' }
  }

  // Haal nieuwe prijs op
  const { data: meal } = await supabase
    .from('meals')
    .select('price')
    .eq('id', mealId)
    .single()

  if (!meal) {
    return { error: 'Gekozen maaltijd bestaat niet.' }
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      meal_id: mealId,
      quantity,
      price_at_order: meal.price
    })
    .eq('id', orderId)

  if (updateError) {
    return { error: 'Fout bij het updaten van de bestelling.' }
  }

  revalidatePath('/')
  return { success: true }
}
