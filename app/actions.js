'use server'

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// --- CONFIGURAÇÕES GERAIS ---
export async function updateSettings(settings) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase
      .from('app_settings')
      .update({
        tax_rate: Number(settings.tax_rate),
        comm_rate: Number(settings.comm_rate),
        bad_debt_rate: Number(settings.bad_debt_rate),
        updated_at: new Date()
      })
      .eq('id', settings.id || 1);

    if (error) throw new Error(error.message);
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, message: `Erro ao salvar configurações: ${err.message}` };
  }
}

// --- DESPESAS (BLINDADO CONTRA ERRO DE RENDER) ---
export async function addExpense(expense) {
  try {
    const supabase = await createClient();
    
    // 1. Limpeza robusta do valor (previne erro de texto/vírgula)
    let cleanValue = 0;
    const rawValue = expense.value;

    if (typeof rawValue === 'number') {
      cleanValue = rawValue;
    } else if (typeof rawValue === 'string') {
      // Troca vírgula por ponto e remove espaços
      cleanValue = parseFloat(rawValue.replace(/\./g, '').replace(',', '.'));
    }

    // Se a conversão falhou (ex: digitou texto), retorna erro controlado
    if (isNaN(cleanValue)) {
      return { success: false, message: "O valor informado não é um número válido." };
    }

    // 2. Tenta inserir no banco
    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        name: expense.name,
        value: cleanValue,
        type: expense.type,
        month_key: expense.type === 'VARIABLE' ? expense.month_key : null
      }])
      .select()
      .single();

    if (error) {
      console.error("Erro Supabase:", error);
      return { success: false, message: "Erro no banco de dados: " + error.message };
    }
    
    // 3. Atualiza a tela
    revalidatePath('/');
    return { success: true, data };

  } catch (err) {
    console.error("Erro Fatal (Server Action):", err);
    // Retorna um erro amigável em vez de quebrar a tela preta
    return { success: false, message: "Erro interno ao processar a despesa." };
  }
}

export async function deleteExpense(id) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, message: "Erro ao apagar despesa." };
  }
}

// --- CENÁRIOS MANUAIS ---
export async function saveManualScenario(data) {
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from('manual_scenarios')
      .upsert(data, { onConflict: 'month_key' });

    if (error) throw error;
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, message: "Erro ao salvar cenário." };
  }
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
  try {
    let cleanValue = value;
    if (typeof value === 'string') cleanValue = parseFloat(value.replace(',', '.'));
    
    const { error } = await supabase
      .from('seller_goals')
      .upsert({ 
        seller_name: sellerName, 
        month_key: monthKey, 
        goal_value: cleanValue 
      }, { onConflict: 'seller_name, month_key' });

    if (error) throw error;
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return { success: false, message: "Erro ao salvar meta." };
  }
}

export async function getSellerDetails(seller, month, year) {
  const supabase = await createClient();
  const monthKey = `${year}-${month}`;

  const { data: sales, error } = await supabase
    .from('sales')
    .select('*')
    .eq('seller', seller)
    .eq('year', year)
    .eq('month', month);

  if (error) throw new Error('Erro ao buscar vendas: ' + error.message);

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