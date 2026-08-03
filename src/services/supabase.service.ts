import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  public readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    return data.session;
  }

  async signInWithOtp(email: string): Promise<{ error: Error | null }> {
    const { error } = await this.client.auth.signInWithOtp({ email });
    return { error };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  onAuthStateChange(callback: (session: Session | null) => void) {
    return this.client.auth.onAuthStateChange((_event, session) => callback(session));
  }

  async getProfissional(userId: string): Promise<any | null> {
    try {
      const { data, error } = await this.client
        .from('profissionais')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Aviso ao buscar profissional no Supabase:', error.message || error);
        return null;
      }
      return data;
    } catch (e: any) {
      console.warn('Exceção ao buscar profissional no Supabase:', e?.message || e);
      return null;
    }
  }

  async upsertProfissional(userId: string, payload: Record<string, any>): Promise<{ error: Error | null }> {
    try {
      const { error } = await this.client
        .from('profissionais')
        .upsert({ id: userId, ...payload }, { onConflict: 'id' });

      return { error };
    } catch (e: any) {
      return { error: e };
    }
  }

  async getAllProfissionais(): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('profissionais')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        console.warn('Aviso ao buscar profissionais no Supabase (verifique RLS/autenticação):', error.message || error);
        return [];
      }
      return data ?? [];
    } catch (e: any) {
      console.warn('Exceção ao buscar profissionais no Supabase:', e?.message || e);
      return [];
    }
  }

  async updateAtivoProfissional(userId: string, ativo: boolean): Promise<{ error: Error | null }> {
    const { error } = await this.client
      .from('profissionais')
      .update({ ativo })
      .eq('id', userId);

    return { error };
  }
}
