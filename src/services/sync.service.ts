import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { VistoriaDbService } from './vistoria-db.service';
import { Vistoria } from '../components/checklist-inspecao/checklist-inspecao.component';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private supabaseService = inject(SupabaseService);
  private dbService = inject(VistoriaDbService);

  public status = signal<SyncStatus>('idle');
  public errorMessage = signal<string | null>(null);
  public evidenciasComFalha = signal<number>(0);

  async salvarNaNuvem(vistoria: Vistoria): Promise<boolean> {
    this.status.set('syncing');
    this.errorMessage.set(null);
    this.evidenciasComFalha.set(0);

    try {
      const session = await this.supabaseService.getSession();
      if (!session?.user) {
        throw new Error('Você precisa estar autenticado para salvar na nuvem.');
      }

      // 1. Upload das evidências (fotos) associadas a esta vistoria, se houver.
      const { falhas } = await this.uploadEvidenciasDaVistoria(vistoria, session.user.id);
      this.evidenciasComFalha.set(falhas);

      // 2. Upsert do payload completo da vistoria.
      const nowIso = new Date().toISOString();
      const vistoriaAtualizada: Vistoria = { ...vistoria, sincronizadoEm: nowIso };

      const payloadUpsert: any = {
        profissional_id: session.user.id,
        building_name: vistoria.buildingName,
        address: vistoria.address,
        payload: vistoriaAtualizada,
        sincronizado_em: nowIso,
      };

      // Se já existe cloudId (sincronização anterior bem-sucedida), inclui o id
      // real do Postgres no upsert — isso faz UPDATE da mesma linha em vez de
      // criar uma linha nova a cada sincronização.
      if (vistoria.cloudId) {
        payloadUpsert.id = vistoria.cloudId;
      }

      const { data, error } = await this.supabaseService.client
        .from('vistorias')
        .upsert(payloadUpsert, { onConflict: 'id' })
        .select('id')
        .single();

      if (error) throw error;

      // Guarda o UUID retornado pelo Postgres (seja de insert novo ou update)
      // no registro local, para as próximas sincronizações desta mesma vistoria.
      if (data?.id) {
        vistoriaAtualizada.cloudId = data.id;
      }

      // 3. Marca localmente como sincronizada (persistido no próprio IndexedDB).
      const todasVistorias = await this.dbService.getAllVistorias();
      const idx = todasVistorias.findIndex(v => v.id === vistoria.id);
      if (idx !== -1) {
        todasVistorias[idx] = vistoriaAtualizada;
        await this.dbService.saveAllVistorias(todasVistorias);
      } else {
        await this.dbService.saveAllVistorias([...todasVistorias, vistoriaAtualizada]);
      }

      this.status.set('success');
      return true;
    } catch (error: any) {
      const isAuthError = error?.message?.includes('autenticado');
      const msg = isAuthError
        ? 'Você precisa estar autenticado com e-mail para salvar na nuvem. Seus dados continuam salvos localmente neste dispositivo.'
        : 'Não foi possível salvar na nuvem. Verifique sua conexão e tente novamente. Seus dados continuam salvos localmente neste dispositivo.';
      console.warn('Não foi possível sincronizar vistoria na nuvem:', error?.message || error);
      this.errorMessage.set(msg);
      this.status.set('error');
      return false;
    }
  }

  async baixarDaNuvem(): Promise<{ baixadas: number; atualizadas: number; erro?: string }> {
    try {
      const session = await this.supabaseService.getSession();
      if (!session?.user) {
        return { baixadas: 0, atualizadas: 0, erro: 'Você precisa estar autenticado para sincronizar.' };
      }

      const { data: vistoriasNuvem, error } = await this.supabaseService.client
        .from('vistorias')
        .select('id, payload, atualizado_em')
        .eq('profissional_id', session.user.id);

      if (error) throw error;

      const vistoriasLocais = await this.dbService.getAllVistorias();
      const localPorId = new Map(vistoriasLocais.map(v => [v.id, v]));

      let baixadas = 0;
      let atualizadas = 0;
      const listaFinal = [...vistoriasLocais];

      for (const linhaNuvem of (vistoriasNuvem || [])) {
        const vistoriaNuvem = linhaNuvem.payload as Vistoria;
        if (!vistoriaNuvem?.id) continue;

        vistoriaNuvem.cloudId = linhaNuvem.id;

        const local = localPorId.get(vistoriaNuvem.id);

        if (!local) {
          listaFinal.push(vistoriaNuvem);
          baixadas++;
          continue;
        }

        const dataLocal = new Date(local.dateUpdated || 0).getTime();
        const dataNuvem = new Date(vistoriaNuvem.dateUpdated || linhaNuvem.atualizado_em || 0).getTime();

        if (dataNuvem > dataLocal) {
          const idx = listaFinal.findIndex(v => v.id === vistoriaNuvem.id);
          if (idx !== -1) {
            listaFinal[idx] = vistoriaNuvem;
            atualizadas++;
          }
        }
      }

      await this.dbService.saveAllVistorias(listaFinal);
      return { baixadas, atualizadas };
    } catch (e: any) {
      return { baixadas: 0, atualizadas: 0, erro: e?.message || 'Erro ao sincronizar com a nuvem.' };
    }
  }

  private async uploadEvidenciasDaVistoria(vistoria: Vistoria, userId: string): Promise<{ falhas: number }> {
    const evidenciaIds = new Set<string>();

    if (Array.isArray(vistoria.items)) {
      for (const item of vistoria.items) {
        if (Array.isArray(item.ocorrencias)) {
          for (const ficha of item.ocorrencias) {
            if (Array.isArray(ficha.id_evidencias)) {
              for (const idEvid of ficha.id_evidencias) {
                if (idEvid) {
                  evidenciaIds.add(idEvid);
                }
              }
            }
          }
        }
      }
    }

    let falhas = 0;
    for (const idEvid of evidenciaIds) {
      try {
        const ev = await this.dbService.getEvidencia(idEvid);
        if (ev && ev.blob) {
          const path = `${userId}/${vistoria.id}/${idEvid}.jpg`;
          await this.supabaseService.client.storage
            .from('evidencias-vistoria')
            .upload(path, ev.blob, {
              contentType: ev.mimeType || 'image/jpeg',
              upsert: true,
            });
        }
      } catch (err) {
        console.warn(`Falha ao fazer upload da evidência ${idEvid}:`, err);
        falhas++;
      }
    }

    return { falhas };
  }
}
