import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { VistoriaDbService } from '../../services/vistoria-db.service';
import { SyncService } from '../../services/sync.service';
import { Vistoria } from '../checklist-inspecao/checklist-inspecao.component';

@Component({
  selector: 'app-visao-geral',
  templateUrl: './visao-geral.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class VisaoGeralComponent implements OnInit {
  private toastService = inject(ToastService);
  private dbService = inject(VistoriaDbService);
  public syncService = inject(SyncService);

  vistorias = signal<Vistoria[]>([]);
  vistoriaEmSincronizacaoId = signal<string | null>(null);
  isSincronizandoGeral = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.carregarVistorias();
  }

  async carregarVistorias(): Promise<void> {
    try {
      const lista = await this.dbService.getAllVistorias();
      lista.sort((a, b) => new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime());
      this.vistorias.set(lista);
    } catch (e) {
      console.error('Erro ao carregar vistorias em VisaoGeral', e);
    }
  }

  async sincronizarTudo(): Promise<void> {
    this.isSincronizandoGeral.set(true);
    try {
      const res = await this.syncService.baixarDaNuvem();
      await this.carregarVistorias();
      if (res.erro) {
        this.toastService.show(res.erro, 'error');
      } else {
        const total = res.baixadas + res.atualizadas;
        if (total > 0) {
          this.toastService.show(`${total} vistoria(s) sincronizada(s) da nuvem com sucesso.`, 'success');
        } else {
          this.toastService.show('Todas as suas vistorias já estão sincronizadas com a nuvem.', 'info');
        }
      }
    } catch {
      this.toastService.show('Erro ao sincronizar com a nuvem.', 'error');
    } finally {
      this.isSincronizandoGeral.set(false);
    }
  }

  async sincronizarNuvem(event: Event, vistoria: Vistoria): Promise<void> {
    event.stopPropagation();
    this.vistoriaEmSincronizacaoId.set(vistoria.id);
    const sucesso = await this.syncService.salvarNaNuvem(vistoria);
    this.vistoriaEmSincronizacaoId.set(null);

    await this.carregarVistorias();

    if (sucesso) {
      const falhasFotos = this.syncService.evidenciasComFalha();
      if (falhasFotos > 0) {
        this.toastService.show(
          `Vistoria salva, mas ${falhasFotos} foto(s) não foram enviadas. Tente sincronizar novamente.`,
          'info',
          6000
        );
      } else {
        this.toastService.show('Vistoria salva na nuvem com sucesso.', 'success');
      }
    } else {
      const msg = this.syncService.errorMessage() || 'Não foi possível salvar na nuvem.';
      this.toastService.show(msg, 'error', 6000);
    }
  }

  // States for interactive community subscription
  isSubscribing = signal(false);
  subscribedEmail = signal('');
  showSubscribedSuccess = signal(false);

  // License activation states
  selectedLicense = signal<string | null>(null);
  showLicenseModal = signal(false);
  licenseEmail = signal('');
  licenseName = signal('');
  activatedLicense = signal<string | null>(null);

  scrollToFeatures(): void {
    const element = document.getElementById('funcionalidades');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      this.toastService.show('Rolar para ferramentas centralizadas', 'info');
    }
  }

  handleCommunitySubscribe(event: Event): void {
    event.preventDefault();
    if (!this.subscribedEmail().trim()) return;

    this.isSubscribing.set(true);
    setTimeout(() => {
      this.isSubscribing.set(false);
      this.showSubscribedSuccess.set(true);
      this.toastService.show('Inscrição realizada com sucesso!', 'success');
    }, 1200);
  }

  openLicenseForm(plan: string): void {
    this.selectedLicense.set(plan);
    this.showLicenseModal.set(true);
  }

  submitLicenseRequest(): void {
    if (!this.licenseName().trim() || !this.licenseEmail().trim()) {
      this.toastService.show('Por favor, preencha todos os campos.', 'error');
      return;
    }

    this.toastService.show('Processando ativação de plano...', 'info');
    setTimeout(() => {
      this.activatedLicense.set(this.selectedLicense());
      this.showLicenseModal.set(false);
      this.toastService.show(`Plano ${this.selectedLicense()} ativado para testes!`, 'success');
    }, 1500);
  }
}
