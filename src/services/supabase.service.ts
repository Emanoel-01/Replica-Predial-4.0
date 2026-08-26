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

  async signInWithPassword(email: string, password: string): Promise<{ error: Error | null; data?: any }> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return this.client.auth.onAuthStateChange((event, session) => callback(event, session));
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

  async temPermissaoModulo(produto: 'predial4' | 'comunidade', modulo: string): Promise<boolean> {
    try {
      const session = await this.getSession();
      if (!session?.user) return false;
      const { data, error } = await this.client
        .from('permissoes_acesso')
        .select('id, validade')
        .eq('profissional_id', session.user.id)
        .eq('produto', produto)
        .eq('modulo', modulo)
        .eq('liberado', true)
        .limit(1);
      if (error || !data || data.length === 0) return false;
      const validade = data[0].validade;
      if (validade && new Date(validade) < new Date()) return false;
      return true;
    } catch {
      return false;
    }
  }

  async cursoConcluidoParaModulo(nomeModulo: string): Promise<boolean> {
    try {
      const session = await this.getSession();
      if (!session?.user) return false;

      // 1. Encontrar curso(s) ativo(s) vinculado(s) a este módulo
      const { data: cursos, error: erroCursos } = await this.client
        .from('cursos')
        .select('id')
        .eq('modulo_predial_vinculado', nomeModulo)
        .eq('ativo', true);

      if (erroCursos || !cursos || cursos.length === 0) {
        // Não há curso ativo vinculado a este módulo — não bloquear (comportamento permissivo por padrão)
        return true;
      }

      const cursoIds = cursos.map(c => c.id);

      // 2. Checar se o profissional tem matrícula com certificado emitido em algum desses cursos
      const { data: matriculas, error: erroMatriculas } = await this.client
        .from('cursos_matriculas')
        .select('certificado_emitido_em')
        .eq('profissional_id', session.user.id)
        .in('curso_id', cursoIds)
        .not('certificado_emitido_em', 'is', null);

      if (erroMatriculas) return true; // falha de leitura não deve travar o usuário indevidamente

      return Boolean(matriculas && matriculas.length > 0);
    } catch {
      return true; // erro de rede/consulta não deve travar acesso indevidamente
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
