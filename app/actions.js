'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// --- CONFIGURAÇÕES GERAIS ---
export async function updateSettings(settings) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('app_settings')
    .update({
      tax_rate: Number(settings.tax_rate),
      comm_rate: Number(settings.comm_rate),
      bad_debt_rate: Number(settings.bad_debt_rate),
      updated_at: new Date()
    })
    .eq('id', settings.id || 1);

  if (error) throw new Error('Erro ao atualizar configurações: ' + error.message);
  
  revalidatePath('/');
  return { success: true };
}

// --- DESPESAS (CORREÇÃO DE ERRO DE INSERT) ---
export async function addExpense(expense) {
  const supabase = await createClient();
  
  // Limpeza robusta do valor (previne erro de texto/vírgula)
  let cleanValue = 0;
  if (typeof expense.value === 'string') {
    cleanValue = parseFloat(expense.value.replace(',', '.'));
  } else {
    cleanValue = Number(expense.value);
  }

  if (isNaN(cleanValue)) cleanValue = 0;

  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      name: expense.name,
      value: cleanValue, // Envia número limpo
      type: expense.type,
      month_key: expense.type === 'VARIABLE' ? expense.month_key : null
    }])
    .select()
    .single();

  if (error) throw new Error('Erro ao adicionar despesa: ' + error.message);
  
  revalidatePath('/');
  return { success: true, data };
}

export async function deleteExpense(id) {
  const supabase = await createClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error('Erro ao apagar despesa');
  revalidatePath('/');
  return { success: true };
}

// --- CENÁRIOS MANUAIS ---
export async function saveManualScenario(data) {
  const supabase = await createClient();
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

// --- VENDEDORES & METAS ---
export async function saveSellerGoal(sellerName, monthKey, value) {
  const supabase = await createClient();
  const cleanValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;

  const { error } = await supabase
    .from('seller_goals')
    .upsert({ 
      seller_name: sellerName, 
      month_key: monthKey, 
      goal_value: cleanValue 
    }, { onConflict: 'seller_name, month_key' });

  if (error) throw new Error('Erro ao salvar meta: ' + error.message);
  revalidatePath('/');
  return { success: true };
}

export async function getSellerDetails(seller, month, year) {
  const supabase = await createClient();
  const monthKey = `${year}-${month}`;

  // 1. Busca vendas
  const { data: sales, error } = await supabase
    .from('sales')
    .select('*')
    .eq('seller', seller)
    .eq('year', year)
    .eq('month', month);

  if (error) throw new Error('Erro ao buscar vendas: ' + error.message);

  // 2. Busca meta
  const { data: goalData } = await supabase
    .from('seller_goals')
    .select('goal_value')
    .eq('seller_name', seller)
    .eq('month_key', monthKey)
    .single();

  return {
    sales: sales || [],
    goal: goalData?.goal_value || 0
  };
}