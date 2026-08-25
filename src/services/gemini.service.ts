import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

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
  return (reg ?? '').trim().length > 0;
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
  private supabaseService = inject(SupabaseService);
  public loading = signal(false);

  private readonly errorMessage =
    'Não foi possível obter o diagnóstico de IA no momento. Verifique sua conexão ' +
    'e tente novamente. Seus dados de campo já digitados não foram perdidos — você ' +
    'pode preencher o diagnóstico manualmente e continuar o laudo normalmente.';

  private async invocarEdgeFunction<T>(operation: 'texto' | 'estruturado', contents: any, responseSchema?: object): Promise<T> {
    this.loading.set(true);
    const tentarChamada = async (): Promise<T> => {
      const { data, error } = await this.supabaseService.client.functions.invoke('diagnostico-ia', {
        body: { operation, contents, responseSchema },
      });
      if (error) {
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data as T;
    };

    try {
      try {
        return await tentarChamada();
      } catch (primeiroErro) {
        console.warn('Primeira tentativa de IA falhou, tentando novamente em 1.5s:', (primeiroErro as any)?.message || primeiroErro);
        await new Promise(resolve => setTimeout(resolve, 1500));
        return await tentarChamada();
      }
    } catch (error: any) {
      console.warn('Serviço de IA indisponível ou não autenticado (após retry):', error?.message || error);
      throw new Error(this.errorMessage);
    } finally {
      this.loading.set(false);
    }
  }

  async generateText(prompt: string): Promise<string> {
    const result = await this.invocarEdgeFunction<{ text: string }>('texto', prompt);
    return result.text;
  }

  async generateTextWithImages(prompt: string, images: { base64: string; mimeType: string }[]): Promise<string> {
    const textPart = { text: prompt };
    const imageParts = images.map((image) => ({
      inlineData: { data: image.base64, mimeType: image.mimeType },
    }));
    const contents = { parts: [textPart, ...imageParts] };
    const result = await this.invocarEdgeFunction<{ text: string }>('texto', contents);
    return result.text;
  }

  async generateStructured<T>(contents: any, responseSchema: object): Promise<T> {
    return this.invocarEdgeFunction<T>('estruturado', contents, responseSchema);
  }

  sanitizeAiText(raw: string): string {
    return (raw ?? '')
      .replace(/```html\n?/gi, '')
      .replace(/```\n?/gi, '')
      .trim();
  }

  escapeHtml(s: string): string {
    return (s ?? '').replace(/[&<>"']/g, (c: string) =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' } as any)[c]);
  }
}
