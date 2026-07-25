// TODO(backend): este serviço deve chamar exclusivamente endpoints do nosso
// backend. A chave da API do Gemini deve existir SOMENTE no servidor.
// O endpoint server-side deve autenticar o usuário via JWT e aplicar rate
// limit por licença antes de repassar a chamada ao Gemini.

import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

export interface UserProfile {
  fullName: string;
  professionalTitle: string;
  professionalId?: string;
  companyName?: string;
  position?: string;
  companyCnpj?: string;
  companyAddress?: string;
}

export const RE_CAU = /^A\d{6}-\d$/i;
export const RE_CREA = /^CREA-[A-Z]{2}\s?\d{4,7}(\/[A-Z])?$/i;

export function registroValido(reg: string): boolean {
  const r = (reg ?? '').trim();
  return RE_CAU.test(r) || RE_CREA.test(r);
}

export function generateStandardFooter(profile: UserProfile | null): string {
  if (!profile) return '';
  const parts = [
    `Emitido por: ${profile.fullName || 'Não informado'}`,
    profile.professionalTitle || 'Profissional',
    profile.professionalId ? `Reg: ${profile.professionalId}` : 'Reg: Não informado',
    profile.companyName ? profile.companyName : '',
    profile.companyAddress ? profile.companyAddress : ''
  ].filter(Boolean);
  
  return `
    <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #cbd5e1; font-size: 0.8em; color: #475569; text-align: center; line-height: 1.4;">
      <p style="font-weight: bold; margin-bottom: 4px;">Documento provisório. Adquire validade técnica mediante assinatura do responsável técnico.</p>
      <p>${parts.join(' — ')}</p>
    </div>
  `;
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private http = inject(HttpClient);
  public loading = signal(false);

  private readonly errorMessage =
    'Integração de IA temporariamente indisponível. Esta função depende do ' +
    'servidor central, ainda não conectado nesta versão. Seus dados de campo ' +
    'já digitados não foram perdidos — você pode preencher o diagnóstico ' +
    'manualmente e continuar o laudo normalmente.';

  async generateText(prompt: string): Promise<string> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<{ text: string }>('/api/ia/texto', { prompt })
      );
      return res.text;
    } catch (error) {
      console.error('Erro ao chamar serviço de IA:', error);
      throw new Error(this.errorMessage);
    } finally {
      this.loading.set(false);
    }
  }

  async generateTextWithImages(prompt: string, images: { base64: string; mimeType: string }[]): Promise<string> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<{ text: string }>('/api/ia/texto-com-imagens', { prompt, images })
      );
      return res.text;
    } catch (error) {
      console.error('Erro ao chamar serviço de IA:', error);
      throw new Error(this.errorMessage);
    } finally {
      this.loading.set(false);
    }
  }

  async generateStructured<T>(contents: any, responseSchema: object): Promise<T> {
    this.loading.set(true);
    try {
      return await firstValueFrom(
        this.http.post<T>('/api/ia/diagnostico-estruturado', { contents, responseSchema })
      );
    } catch (error) {
      console.error('Erro ao chamar serviço de IA:', error);
      throw new Error(this.errorMessage);
    } finally {
      this.loading.set(false);
    }
  }

  sanitizeAiText(raw: string): string {
    return (raw ?? '')
      .replace(/```html\n?/gi, '')   // remove cerca de abertura
      .replace(/```\n?/gi, '')        // remove cerca de fechamento
      .trim();
  }

  escapeHtml(s: string): string {
    return (s ?? '').replace(/[&<>"']/g, (c: string) =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' } as any)[c]);
  }
}
