import { Injectable, signal, computed } from '@angular/core';
import { TourStep } from '../models/tour.model';

@Injectable({ providedIn: 'root' })
export class TourService {
  private todosOsPassos: TourStep[] = [];

  isTourAtivo = signal(false);
  indiceAtual = signal(0);

  passoAtual = computed<TourStep | null>(() => {
    const passos = this.todosOsPassos;
    const idx = this.indiceAtual();
    return passos[idx] ?? null;
  });

  totalPassos = computed(() => this.todosOsPassos.length);

  registrarPassos(passos: TourStep[]): void {
    this.todosOsPassos = passos;
  }

  iniciar(): void {
    if (this.todosOsPassos.length === 0) {
      console.warn('TourService: nenhum passo registrado ainda.');
      return;
    }
    this.indiceAtual.set(0);
    this.isTourAtivo.set(true);
  }

  proximo(): void {
    if (this.indiceAtual() < this.todosOsPassos.length - 1) {
      this.indiceAtual.update(i => i + 1);
    } else {
      this.encerrar();
    }
  }

  anterior(): void {
    if (this.indiceAtual() > 0) {
      this.indiceAtual.update(i => i - 1);
    }
  }

  pularAte(idDoPasso: string): void {
    const indice = this.todosOsPassos.findIndex(p => p.id === idDoPasso);
    if (indice >= 0) {
      this.indiceAtual.set(indice);
    } else {
      this.encerrar();
    }
  }

  encerrar(): void {
    this.isTourAtivo.set(false);
    this.indiceAtual.set(0);
  }
}
