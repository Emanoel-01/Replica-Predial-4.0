import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';

// Component Imports
import { VisaoGeralComponent } from './components/visao-geral/visao-geral.component';
import { UserProfileModalComponent } from './components/user-profile-modal/user-profile-modal.component';
import { UserProfile } from './models/user-profile.model';
import { ToastComponent } from './components/toast/toast.component';
import { LoginComponent } from './components/login/login.component';
import { ToastService } from './services/toast.service';
import { ChecklistInspecaoComponent } from './components/checklist-inspecao/checklist-inspecao.component';
import { AdminPanelComponent } from './components/admin-panel/admin-panel.component';
import { OrcamentoRoadmapComponent } from './components/orcamento-roadmap/orcamento-roadmap.component';
import { VistoriaCautelarComponent } from './components/vistoria-cautelar/vistoria-cautelar.component';
import { NotificationService } from './services/notification.service';
import { VistoriaDbService } from './services/vistoria-db.service';
import { SupabaseService } from './services/supabase.service';
import { Vistoria } from './components/checklist-inspecao/checklist-inspecao.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styles: [
    `
      .assist-button {
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      }
      .assist-button:hover {
        transform: translateY(-3px) scale(1.03);
        box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      }
      .sidebar {
        transition: transform 0.3s ease-in-out;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    VisaoGeralComponent,
    UserProfileModalComponent,
    ToastComponent,
    LoginComponent,
    ChecklistInspecaoComponent,
    VistoriaCautelarComponent,
    AdminPanelComponent,
    OrcamentoRoadmapComponent,
  ],
})
export class AppComponent implements OnInit {
  private dbService = inject(VistoriaDbService);
  todasVistorias = signal<Vistoria[]>([]);

  admAcessoLiberado = signal<boolean>(false);

  activeView = signal('visao-geral');
  isMenuOpen = signal(false);
  isProfileModalOpen = signal(false);
  isNotificationDropdownOpen = signal(false);
  userName = signal('');
  userProfile = signal<UserProfile | null>(null);

  // New signals for Interactive Tour and Admin Panel
  isTourActive = signal(false);
  tourStep = signal(1);
  isAdminModalOpen = signal(false);
  simulateOffline = signal(true);
  advancedSyncMode = signal(false);

  showLogin = signal(true);
  isLoggedIn = signal(false);
  private toastService = inject(ToastService);
  public notificationService = inject(NotificationService);
  private supabaseService = inject(SupabaseService);

  navItems = [
    { id: 'visao-geral', label: 'Visão Geral', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10' },
    { id: 'checklist', label: 'Check-up', pageTitle: 'Laudo Técnico de Inspeção Predial', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z' },
    { id: 'cautelar', label: 'Cautelar', pageTitle: 'Vistoria Cautelar de Vizinhança', icon: 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z' },
    { id: 'orcamento', label: 'Orçamento', pageTitle: 'Módulo de Orçamento e Planejamento', icon: 'M9 14l6-6m-5.5.5h.01M15 15v-3.5a1.5 1.5 0 00-3 0V15M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9M3 9l9-6 9 6' },
    { id: 'admin', label: 'Ferramentas Admin', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z' },
  ];

  navItemsVisiveis = computed(() => {
    return this.navItems.filter(item => item.id !== 'admin' || this.admAcessoLiberado());
  });

  activeViewLabel = computed(() => {
    const currentView = this.activeView();
    const navItem = this.navItems.find(item => item.id === currentView);
    return navItem ? (navItem.pageTitle ?? navItem.label) : 'Visão Geral';
  });
  
  constructor() {
    // Perfil agora é carregado do Supabase (tabela `profissionais`) no ngOnInit,
    // vinculado ao usuário autenticado. Não há mais leitura de localStorage
    // nem perfil de exemplo hardcoded aqui.
  }

  startTour(): void {
    if (!this.isLoggedIn()) {
      this.showLoginRequiredToast();
      return;
    }
    this.activeView.set('visao-geral');
    this.tourStep.set(1);
    this.isTourActive.set(true);
    this.isMenuOpen.set(false);
    this.toastService.show('Tour do Ecossistema iniciado!', 'success');
  }

  nextTourStep(): void {
    if (this.tourStep() < 4) {
      this.tourStep.update(s => s + 1);
    } else {
      this.isTourActive.set(false);
      this.toastService.show('Tour concluído! Explore livremente.', 'success');
    }
  }

  prevTourStep(): void {
    if (this.tourStep() > 1) {
      this.tourStep.update(s => s - 1);
    }
  }

  openAdminModal(): void {
    if (!this.isLoggedIn()) {
      this.showLoginRequiredToast();
      return;
    }
    this.isAdminModalOpen.set(true);
    this.isMenuOpen.set(false);
  }

  resetLocalState(): void {
    localStorage.removeItem('inspections_checklist_progress');
    this.toastService.show('Progresso do Checklist de Campo limpo com sucesso!', 'success');
    this.isAdminModalOpen.set(false);
  }

  setActiveView(view: string): void {
    if (!this.isLoggedIn() && view !== 'visao-geral') {
      this.showLoginRequiredToast();
      return;
    }
    this.activeView.set(view);
    this.isMenuOpen.set(false);
  }

  private async carregarPerfilDoSupabase(userId: string): Promise<void> {
    const row = await this.supabaseService.getProfissional(userId);

    if (!row) {
      // Não deveria acontecer (a trigger de banco cria a linha no primeiro login),
      // mas por segurança: sem linha, abre o modal para o usuário preencher do zero.
      this.userProfile.set(null);
      this.isProfileModalOpen.set(true);
      return;
    }

    const profile: UserProfile = {
      fullName: row.full_name || '',
      professionalTitle: row.professional_title || '',
      professionalId: row.professional_id || '',
      categoriaProfissional: row.categoria_profissional || undefined,
      companyName: row.company_name || '',
      companyCnpj: row.company_cnpj || '',
      companyAddress: row.company_address || '',
      companyPhone: row.company_phone || '',
      companyEmail: row.company_email || '',
      companySite: row.company_site || '',
    };

    this.userProfile.set(profile);

    // Liberação REAL do Admin — decidida pelo banco (coluna `role` em
    // `profissionais`), nunca por comparação de credencial no navegador.
    if (row.role === 'admin') {
      this.admAcessoLiberado.set(true);
    }

    // Perfil incompleto = falta o registro profissional (CAU/CREA/CFT), o dado
    // mínimo necessário para emitir laudos. Abre o modal automaticamente para
    // o usuário completar assim que loga.
    if (!profile.professionalId || profile.professionalId.trim() === '') {
      this.isProfileModalOpen.set(true);
    }
  }

  async onProfileUpdate(profile: UserProfile): Promise<void> {
    this.userProfile.set(profile);
    localStorage.setItem('user_profile', JSON.stringify(profile));

    if (this.isLoggedIn() && profile && profile.fullName) {
      this.userName.set(profile.fullName.split(' ')[0]);
    } else {
      this.userName.set('');
    }

    const session = await this.supabaseService.getSession();
    if (session?.user) {
      const { error } = await this.supabaseService.upsertProfissional(session.user.id, {
        full_name: profile.fullName,
        professional_title: profile.professionalTitle,
        professional_id: profile.professionalId,
        categoria_profissional: profile.categoriaProfissional,
        company_name: profile.companyName,
        company_cnpj: profile.companyCnpj,
        company_address: profile.companyAddress,
        company_phone: profile.companyPhone,
        company_email: profile.companyEmail,
        company_site: profile.companySite,
      });
      if (error) {
        console.error('Erro ao salvar perfil no Supabase:', error);
        this.toastService.show('Perfil salvo localmente, mas houve falha ao sincronizar com a nuvem.', 'error');
      }
    }

    this.notificationService.gerarLembretesLocais(this.todasVistorias(), profile);
  }

  handleGuestAccess(): void {
    this.userName.set('');
    this.isLoggedIn.set(false);
    this.showLogin.set(false);
    this.activeView.set('visao-geral');
    this.admAcessoLiberado.set(false);
  }

  showLoginRequiredToast(): void {
    this.toastService.show('Faça login para acessar esta funcionalidade.', 'info');
  }

  openProfile(): void {
    if (this.isLoggedIn()) {
      this.isProfileModalOpen.set(true);
    } else {
      this.showLoginRequiredToast();
    }
  }

  async handleLogout(): Promise<void> {
    this.isProfileModalOpen.set(false);
    await this.supabaseService.signOut();
    this.isLoggedIn.set(false);
    this.showLogin.set(true);
    this.userName.set('');
    this.activeView.set('visao-geral');
    this.admAcessoLiberado.set(false);
    this.toastService.show('Você saiu com sucesso.', 'info');
  }

  async ngOnInit(): Promise<void> {
    // Verificar sessão existente no Supabase Auth
    try {
      const session = await this.supabaseService.getSession();
      if (session && session.user) {
        this.isLoggedIn.set(true);
        this.showLogin.set(false);
        const email = session.user.email || '';
        const name = email.includes('@') ? email.split('@')[0] : email;
        this.userName.set(name || 'Usuário');
        await this.carregarPerfilDoSupabase(session.user.id);
      }
    } catch (e) {
      console.error('Erro ao verificar sessão do Supabase:', e);
    }

    // Listener para mudanças no estado de autenticação (ex: callback do Magic Link)
    this.supabaseService.onAuthStateChange((session) => {
      if (session && session.user) {
        this.isLoggedIn.set(true);
        this.showLogin.set(false);
        const email = session.user.email || '';
        const name = email.includes('@') ? email.split('@')[0] : email;
        this.userName.set(name || 'Usuário');
        this.toastService.show(`Autenticado como: ${email}`, 'success');
        void this.carregarPerfilDoSupabase(session.user.id);
      }
    });

    try {
      await this.dbService.migrarDoLocalStorageSeNecessario();
      const list = await this.dbService.getAllVistorias();
      this.todasVistorias.set(list);
    } catch (e) {
      console.error('Erro ao inicializar vistorias no app:', e);
    }

    this.notificationService.gerarLembretesLocais(this.todasVistorias(), this.userProfile());
    void this.notificationService.checarAvisosExternos();
  }
}