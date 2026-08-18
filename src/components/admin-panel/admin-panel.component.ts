import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { LeadService } from '../../services/lead.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class AdminPanelComponent {
  private notificationService = inject(NotificationService);
  private leadService = inject(LeadService);
  private toastService = inject(ToastService);

  // Tabs structure
  tabs = [
    { id: 'atividade', label: 'Análise de Atividade', icon: '📊' },
    { id: 'leads', label: 'Análise de Leads', icon: '📈' },
    { id: 'notificacoes', label: 'Central de Notificações', icon: '🔔' },
    { id: 'configuracoes', label: 'Configurações', icon: '⚙️' },
    { id: 'simulador', label: 'Simulador de Demonstração', icon: '🖥️' },
  ];

  activeTab = signal('atividade');
  isRefreshing = signal(false);

  // Stats signals
  totalActivities = signal(1000);
  activeUsers = signal(1);

  // Show form state
  showAddLeadForm = signal(false);

  // Leads computed from shared LeadService
  leads = computed(() => this.leadService.leads());

  // Notifications computed from shared NotificationService
  notifications = computed(() => this.notificationService.notifications());

  // Sync parameters
  simulateOffline = signal(true);
  advancedSyncMode = signal(false);

  leadPendenteConfirmacaoExclusao = signal<string | null>(null);
  notificacoesPendenteConfirmacaoLimpeza = signal<boolean>(false);
  checklistPendenteConfirmacaoReset = signal<boolean>(false);

  constructor() {
    // Sync settings from local storage if available
    const offlineSim = localStorage.getItem('simulateOffline');
    if (offlineSim !== null) {
      this.simulateOffline.set(offlineSim === 'true');
    }
    const advancedSync = localStorage.getItem('advancedSyncMode');
    if (advancedSync !== null) {
      this.advancedSyncMode.set(advancedSync === 'true');
    }
  }

  refreshStats(): void {
    if (this.isRefreshing()) return;
    this.isRefreshing.set(true);

    setTimeout(() => {
      this.isRefreshing.set(false);
      // Randomly tweak stats slightly for demonstration of real refreshing
      this.totalActivities.update(t => t + Math.floor(Math.random() * 15) + 5);
      if (Math.random() > 0.6) {
        this.activeUsers.update(u => u + 1);
      }
      this.toastService.show('Dados de atividade atualizados com sucesso!', 'success');
    }, 1000);
  }

  // Lead actions
  addManualLead(name: string, email: string, plan: string): void {
    if (!name.trim() || !email.trim()) {
      this.toastService.show('Preencha o nome e o e-mail do lead.', 'error');
      return;
    }
    this.leadService.addLead(name, email, plan);
    this.toastService.show(`Lead "${name}" registrado com sucesso!`, 'success');
    this.showAddLeadForm.set(false);
  }

  toggleLeadStatus(id: string, currentStatus: string): void {
    const statuses = ['Pendente', 'Ativo', 'Sob Consulta', 'Cancelado'];
    const nextIndex = (statuses.indexOf(currentStatus) + 1) % statuses.length;
    const nextStatus = statuses[nextIndex];
    this.leadService.updateLeadStatus(id, nextStatus);
    this.toastService.show('Status do lead alterado para: ' + nextStatus, 'info');
  }

  deleteLead(id: string): void {
    if (this.leadPendenteConfirmacaoExclusao() === id) {
      this.leadService.deleteLead(id);
      this.toastService.show('Lead removido com sucesso.', 'info');
      this.leadPendenteConfirmacaoExclusao.set(null);
    } else {
      this.leadPendenteConfirmacaoExclusao.set(id);
      setTimeout(() => {
        if (this.leadPendenteConfirmacaoExclusao() === id) {
          this.leadPendenteConfirmacaoExclusao.set(null);
        }
      }, 3000);
    }
  }

  // Notification actions
  sendNotification(title: string, message: string): void {
    if (!title.trim() || !message.trim()) {
      this.toastService.show('Por favor, preencha o título e a mensagem da notificação.', 'error');
      return;
    }
    this.notificationService.addNotification(title, message);
    this.toastService.show('Notificação adicionada à sua lista local. Este app não tem backend — a notificação não é enviada a outros dispositivos.', 'success');
  }

  clearNotifications(): void {
    if (this.notificacoesPendenteConfirmacaoLimpeza()) {
      this.notificationService.clearAll();
      this.toastService.show('Histórico de notificações limpo com sucesso.', 'info');
      this.notificacoesPendenteConfirmacaoLimpeza.set(false);
    } else {
      this.notificacoesPendenteConfirmacaoLimpeza.set(true);
      setTimeout(() => this.notificacoesPendenteConfirmacaoLimpeza.set(false), 3000);
    }
  }

  markAsRead(id: string): void {
    this.notificationService.markAsRead(id);
  }

  deleteNotification(id: string): void {
    this.notificationService.deleteNotification(id);
    this.toastService.show('Notificação removida.', 'info');
  }

  // Config actions
  toggleSimulateOffline(): void {
    const nextState = !this.simulateOffline();
    this.simulateOffline.set(nextState);
    localStorage.setItem('simulateOffline', String(nextState));
    this.toastService.show(
      `Sincronização Local ${nextState ? 'Habilitada' : 'Desabilitada'}.`,
      'info'
    );
  }

  toggleAdvancedSync(): void {
    const nextState = !this.advancedSyncMode();
    this.advancedSyncMode.set(nextState);
    localStorage.setItem('advancedSyncMode', String(nextState));
    this.toastService.show(
      `Sincronização em Nuvem ${nextState ? 'Habilitada' : 'Desabilitada'}.`,
      'info'
    );
  }

  resetLocalChecklist(): void {
    if (this.checklistPendenteConfirmacaoReset()) {
      localStorage.removeItem('inspections_checklist_progress');
      this.toastService.show('Progresso do Checklist de Campo limpo com sucesso!', 'success');
      this.checklistPendenteConfirmacaoReset.set(false);
    } else {
      this.checklistPendenteConfirmacaoReset.set(true);
      setTimeout(() => this.checklistPendenteConfirmacaoReset.set(false), 3000);
    }
  }
}
