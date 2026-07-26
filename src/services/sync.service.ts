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

  async salvarNaNuvem(vistoria: Vistoria): Promise<boolean> {
    this.status.set('syncing');
    this.errorMessage.set(null);

    try {
      const session = await this.supabaseService.getSession();
      if (!session?.user) {
        throw new Error('Você precisa estar autenticado para salvar na nuvem.');
      }

      // 1. Upload das evidências (fotos) associadas a esta vistoria, se houver.
      await this.uploadEvidenciasDaVistoria(vistoria, session.user.id);

      // 2. Upsert do payload completo da vistoria.
      const nowIso = new Date().toISOString();
      const vistoriaAtualizada: Vistoria = { ...vistoria, sincronizadoEm: nowIso };

      const { error } = await this.supabaseService.client
        .from('vistorias')
        .upsert({
          id: vistoria.id,
          profissional_id: session.user.id,
          building_name: vistoria.buildingName,
          address: vistoria.address,
          payload: vistoriaAtualizada,
          sincronizado_em: nowIso,
        });

      if (error) throw error;

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
      console.error('Erro ao sincronizar vistoria:', error);
      this.errorMessage.set(
        'Não foi possível salvar na nuvem. Verifique sua conexão e tente novamente. ' +
        'Seus dados continuam salvos localmente neste dispositivo.'
      );
      this.status.set('error');
      return false;
    }
  }

  private async uploadEvidenciasDaVistoria(vistoria: Vistoria, userId: string): Promise<void> {
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
      }
    }
  }
}
