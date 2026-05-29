import { supabase, supabaseAdmin } from '../supabase';
import type { Company, CreateCompanyInput } from '../../types/database';

export async function getCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function getCompanyByName(name: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('name', name)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function createCompany(input: CreateCompanyInput): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: input.name,
      email: input.email || null,
      additional_emails: input.additional_emails || [],
      phone: input.phone || null,
      address: input.address || null,
      contact_person: input.contact_person || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCompany(id: string, updates: Partial<CreateCompanyInput & { status: string; user_id: string }>): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getOrCreateCompanyByName(name: string): Promise<Company> {
  const existing = await getCompanyByName(name);
  if (existing) return existing;
  return createCompany({ name });
}

export async function bulkGetOrCreateCompanies(names: string[]): Promise<Map<string, Company>> {
  const uniqueNames = [...new Set(names.filter(n => n && n !== 'Unknown'))];
  const companyMap = new Map<string, Company>();

  // Fetch existing companies
  const { data: existing, error } = await supabase
    .from('companies')
    .select('*')
    .in('name', uniqueNames);

  if (error) throw error;

  for (const company of existing || []) {
    companyMap.set(company.name, company);
  }

  // Create missing companies
  const missingNames = uniqueNames.filter(name => !companyMap.has(name));
  if (missingNames.length > 0) {
    const { data: created, error: createError } = await supabase
      .from('companies')
      .insert(missingNames.map(name => ({ name })))
      .select();

    if (createError) throw createError;
    for (const company of created || []) {
      companyMap.set(company.name, company);
    }
  }

  return companyMap;
}
