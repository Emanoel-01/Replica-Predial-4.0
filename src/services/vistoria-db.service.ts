import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Vistoria, LaudoEmitido } from '../components/checklist-inspecao/checklist-inspecao.component';
import { VistoriaCautelar, LaudoCautelarEmitido } from '../components/vistoria-cautelar/vistoria-cautelar.component';

export interface Evidencia {
  id: string;            // uuid gerado na captura
  blob: Blob;            // a imagem em si (rocha imutável)
  mimeType: string;      // ex.: 'image/jpeg'
  tipo: 'contexto' | 'detalhe';  // contexto = anomalia no ambiente; detalhe = macrofoto
  geo?: { lat: number; lng: number; accuracy?: number } | null;
  timestamp: string;     // ISO
  id_item: string;       // a qual ChecklistItem pertence
}

export interface AnexoBlob {
  id: string;        // === Anexo.id
  blob: Blob;        // arquivo bruto (imagem ou documento)
  mimeType: string;  // === Anexo.tipo
}

interface Predial4DB extends DBSchema {
  vistorias: {
    key: string;      // Vistoria.id
    value: Vistoria;
  };
  evidencias: {
    key: string;      // Evidencia.id
    value: Evidencia;
  };
  anexos: {
    key: string;       // AnexoBlob.id
    value: AnexoBlob;
  };
  laudosEmitidos: {
    key: string;       // LaudoEmitido.id
    value: LaudoEmitido;
  };
  vistoriasCautelares: {
    key: string;       // VistoriaCautelar.id
    value: VistoriaCautelar;
  };
  laudosCautelaresEmitidos: {
    key: string;       // LaudoCautelarEmitido.id
    value: LaudoCautelarEmitido;
  };
}

const DB_NAME = 'predial4-db';
const DB_VERSION = 9;

@Injectable({ providedIn: 'root' })
export class VistoriaDbService {
  private dbPromise: Promise<IDBPDatabase<Predial4DB>>;

  constructor() {
    this.dbPromise = openDB<Predial4DB>(DB_NAME, DB_VERSION, {
      upgrade(db: any, oldVersion) {
        // Estrutura preparada para versões futuras (ex.: store 'evidencias' p/ fotos na v2)
        if (oldVersion < 1) {
          db.createObjectStore('vistorias', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('evidencias', { keyPath: 'id' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('ocorrencias', { keyPath: 'id' });
        }
        if (oldVersion < 4) {
          db.createObjectStore('reformas', { keyPath: 'id' });
          db.createObjectStore('anexos_reforma', { keyPath: 'id' });
        }
        if (oldVersion < 5) {
          if (db.objectStoreNames.contains('ocorrencias')) {
            db.deleteObjectStore('ocorrencias');
          }
          if (db.objectStoreNames.contains('reformas')) {
            db.deleteObjectStore('reformas');
          }
          if (db.objectStoreNames.contains('anexos_reforma')) {
            db.deleteObjectStore('anexos_reforma');
          }
        }
        if (oldVersion < 6) {
          db.createObjectStore('anexos', { keyPath: 'id' });
        }
        if (oldVersion < 7) {
          db.createObjectStore('laudosEmitidos', { keyPath: 'id' });
        }
        if (oldVersion < 8) {
          // v8: adiciona suporte a vistoria.cloudId (UUID do Supabase). Campo opcional,
          // não requer alteração de índices ou keyPath — apenas bump de versão por disciplina.
        }
        if (oldVersion < 9) {
          // v9: cria os stores do módulo Vistoria Cautelar de Vizinhança.
          // Reaproveita os stores 'evidencias' e 'anexos' já existentes para fotos/blobs —
          // só os registros que guardam a estrutura do laudo em si são novos.
          db.createObjectStore('vistoriasCautelares', { keyPath: 'id' });
          db.createObjectStore('laudosCautelaresEmitidos', { keyPath: 'id' });
        }
      },
    });
  }

  async salvarLaudoEmitido(laudo: LaudoEmitido): Promise<void> {
    const db = await this.dbPromise;
    await db.put('laudosEmitidos', laudo);
  }

  async getAllLaudosEmitidos(): Promise<LaudoEmitido[]> {
    const db = await this.dbPromise;
    return db.getAll('laudosEmitidos');
  }

  async countLaudosEmitidos(): Promise<number> {
    const db = await this.dbPromise;
    return db.count('laudosEmitidos');
  }

  async countLaudosEmitidosNoAno(ano: number): Promise<number> {
    const db = await this.dbPromise;
    const todos = await db.getAll('laudosEmitidos');
    return todos.filter(l => new Date(l.dataEmissao).getFullYear() === ano).length;
  }

  async getAllVistorias(): Promise<Vistoria[]> {
    const db = await this.dbPromise;
    return db.getAll('vistorias');
  }

  async saveAllVistorias(lista: Vistoria[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('vistorias', 'readwrite');
    await Promise.all([...lista.map((v) => tx.store.put(v)), tx.done]);
  }

  async deleteVistoria(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('vistorias', id);
  }

  async saveEvidencia(ev: Evidencia): Promise<void> {
    const db = await this.dbPromise;
    await db.put('evidencias', ev);
  }

  async getEvidencia(id: string): Promise<Evidencia | undefined> {
    const db = await this.dbPromise;
    return db.get('evidencias', id);
  }

  async deleteEvidencia(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('evidencias', id);
  }

  async saveAnexoBlob(a: AnexoBlob): Promise<void> {
    const db = await this.dbPromise;
    await db.put('anexos', a);
  }

  async getAnexoBlob(id: string): Promise<AnexoBlob | undefined> {
    const db = await this.dbPromise;
    return db.get('anexos', id);
  }

  async deleteAnexoBlob(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('anexos', id);
  }

  async count(): Promise<number> {
    const db = await this.dbPromise;
    return db.count('vistorias');
  }

  /** Migração única: copia o que existir no localStorage para o IndexedDB, uma vez. */
  async migrarDoLocalStorageSeNecessario(): Promise<void> {
    const jaTem = await this.count();
    if (jaTem > 0) return;                       // IndexedDB já tem dados: nada a migrar
    const saved = localStorage.getItem('predial_vistorias');
    if (!saved) return;                          // não há dado antigo
    try {
      const parsed = JSON.parse(saved) as Vistoria[];
      if (Array.isArray(parsed) && parsed.length) {
        await this.saveAllVistorias(parsed);
        const conferido = await this.count();
        if (conferido >= parsed.length) {
          localStorage.removeItem('predial_vistorias'); // só remove APÓS confirmar a gravação
        }
      }
    } catch (e) {
      console.error('Falha ao migrar vistorias do localStorage para IndexedDB', e);
      // Em caso de erro, mantém o localStorage intacto (sem perda de dado).
    }
  }

  async salvarVistoriaCautelar(vistoria: VistoriaCautelar): Promise<void> {
    const db = await this.dbPromise;
    await db.put('vistoriasCautelares', vistoria);
  }

  async salvarTodasVistoriasCautelares(lista: VistoriaCautelar[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('vistoriasCautelares', 'readwrite');
    await Promise.all([...lista.map((v) => tx.store.put(v)), tx.done]);
  }

  async getAllVistoriasCautelares(): Promise<VistoriaCautelar[]> {
    const db = await this.dbPromise;
    return db.getAll('vistoriasCautelares');
  }

  async getVistoriaCautelar(id: string): Promise<VistoriaCautelar | undefined> {
    const db = await this.dbPromise;
    return db.get('vistoriasCautelares', id);
  }

  async deleteVistoriaCautelar(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('vistoriasCautelares', id);
  }

  async salvarLaudoCautelarEmitido(laudo: LaudoCautelarEmitido): Promise<void> {
    const db = await this.dbPromise;
    await db.put('laudosCautelaresEmitidos', laudo);
  }

  async getAllLaudosCautelaresEmitidos(): Promise<LaudoCautelarEmitido[]> {
    const db = await this.dbPromise;
    return db.getAll('laudosCautelaresEmitidos');
  }

  async countLaudosCautelaresEmitidos(): Promise<number> {
    const db = await this.dbPromise;
    return db.count('laudosCautelaresEmitidos');
  }

  async countLaudosCautelaresEmitidosNoAno(ano: number): Promise<number> {
    const db = await this.dbPromise;
    const todos = await db.getAll('laudosCautelaresEmitidos');
    return todos.filter(l => new Date(l.dataEmissao).getFullYear() === ano).length;
  }
}
