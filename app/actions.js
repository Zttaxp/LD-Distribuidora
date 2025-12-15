'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// --- CONFIGURAÇÕES GERAIS (Taxas) ---
export async function updateSettings(settings) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('app_settings')
    .update({
      tax_rate: settings.tax_rate,
      comm_rate: settings.comm_rate,
      bad_debt_rate: settings.bad_debt_rate,
      updated_at: new Date()
    })
    .eq('id', settings.id || 1); // Assume ID 1 como padrão

  if (error) throw new Error('Erro ao atualizar configurações: ' + error.message);
  
  revalidatePath('/'); // Atualiza o cache da página principal
  return { success: true };
}

// --- DESPESAS ---
export async function addExpense(expense) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      name: expense.name,
      value: expense.value,
      type: expense.type,
      month_key: expense.month_key
    }])
    .select()
    .single();

  if (error) throw new Error('Erro ao adicionar despesa: ' + error.message);
  
  revalidatePath('/');
  return { success: true, data };
}

export async function deleteExpense(id) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) throw new Error('Erro ao apagar despesa');
  
  revalidatePath('/');
  return { success: true };
}

// --- CENÁRIOS MANUAIS (SIMULADOR) ---
export async function saveManualScenario(data) {
  const supabase = await createClient();
  
  // Upsert: Atualiza se existir, Cria se não existir (baseado no month_key)
  const { error } = await supabase
    .from('manual_scenarios')
    .upsert(data, { onConflict: 'month_key' });

  if (error) throw new Error('Erro ao salvar cenário: ' + error.message);
  
  revalidatePath('/');
  return { success: true };
}

export async function getManualScenario(monthKey) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('manual_scenarios')
    .select('*')
    .eq('month_key', monthKey)
    .single();
    
  return data || null;
}