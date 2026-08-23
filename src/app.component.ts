import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, effect } from '@angular/core';

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
import { ModulosFuturosComponent } from './components/modulos-futuros/modulos-futuros.component';
import { VistoriaCautelarComponent } from './components/vistoria-cautelar/vistoria-cautelar.component';
import { TourOverlayComponent } from './components/tour-overlay/tour-overlay.component';
import { NotificationService } from './services/notification.service';
import { VistoriaDbService } from './services/vistoria-db.service';
import { SupabaseService } from './services/supabase.service';
import { SyncService } from './services/sync.service';
import { TourService } from './services/tour.service';
import { TourStep } from './models/tour.model';
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
    ModulosFuturosComponent,
    TourOverlayComponent,
  ],
})
export class AppComponent implements OnInit {
  private dbService = inject(VistoriaDbService);
  todasVistorias = signal<Vistoria[]>([]);

  admAcessoLiberado = signal<boolean>(false);

  // Controla se a sessão inicial desta execução da página já foi processada —
  // usado para diferenciar "a página acabou de carregar e restaurou a sessão" de
  // "o usuário realmente clicou em Entrar agora". NÃO confiar no nome do evento do
  // Supabase para isso (SIGNED_IN pode disparar também na restauração de sessão).
  private sessaoInicialProcessada = false;

  activeView = signal('visao-geral');
  isMenuOpen = signal(false);
  isProfileModalOpen = signal(false);
  isNotificationDropdownOpen = signal(false);
  userName = signal('');
  userProfile = signal<UserProfile | null>(null);

  // Signals for Admin Panel
  isAdminModalOpen = signal(false);
  simulateOffline = signal(true);
  advancedSyncMode = signal(false);

  showLogin = signal(true);
  isLoggedIn = signal(false);
  private toastService = inject(ToastService);
  public notificationService = inject(NotificationService);
  public tourService = inject(TourService);
  private supabaseService = inject(SupabaseService);
  private syncService = inject(SyncService);

  navItems = [
    { id: 'visao-geral', label: 'Visão Geral', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10' },
    { id: 'checklist', label: 'Check-up', pageTitle: 'Laudo Técnico de Inspeção Predial', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z' },
    { id: 'cautelar', label: 'Cautelar', pageTitle: 'Vistoria Cautelar de Vizinhança', icon: 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z' },
    { id: 'orcamento', label: 'Eng. Condominial', pageTitle: 'Engenharia Condominial · Do Laudo à Obra Concluída', icon: 'M9 14l6-6m-5.5.5h.01M15 15v-3.5a1.5 1.5 0 00-3 0V15M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9M3 9l9-6 9 6' },
    { id: 'modulos-futuros', label: 'Módulos Futuros', pageTitle: 'Módulos Futuros · Engenharia Legal', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z' },
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
    // Sincroniza a visualização ativa conforme o passo atual do tour
    effect(() => {
      const isAtivo = this.tourService.isTourAtivo();
      const passo = this.tourService.passoAtual();
      if (isAtivo && passo && passo.view) {
        if (['visao-geral', 'checklist', 'cautelar', 'orcamento', 'admin'].includes(passo.view)) {
          if (this.activeView() !== passo.view) {
            this.activeView.set(passo.view);
          }
        }
        if (passo.acaoAoEntrar === 'requer-login' && !this.isLoggedIn()) {
          this.tourService.proximo();
        }
        if (passo.acaoAoEntrar === 'abrir-modal-perfil' && this.isLoggedIn()) {
          this.isProfileModalOpen.set(true);
        }
      }
    });
  }

  startTour(): void {
    this.tourService.iniciar();
    this.activeView.set('visao-geral');
    this.isMenuOpen.set(false);
    this.toastService.show('Tour do Ecossistema iniciado!', 'info');
  }

  onTourEnded(): void {
    this.activeView.set('visao-geral');
    this.isProfileModalOpen.set(false);
    this.toastService.show('Tour concluído! Explore livremente o ecossistema.', 'success');
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
    const tourAtivo = this.tourService.isTourAtivo();
    if (!this.isLoggedIn() && !tourAtivo && view !== 'visao-geral') {
      this.showLoginRequiredToast();
      return;
    }
    this.activeView.set(view);
    this.isMenuOpen.set(false);
  }

  private montarPassosVisaoGeralESidebar(): TourStep[] {
    return [
      {
        id: 'boas-vindas',
        view: 'visao-geral',
        targetSelector: null,
        titulo: '👋 Bem-vindo ao Predial 4.0',
        descricao: 'Este é o ecossistema completo de engenharia diagnóstica da AmorimTech. Vamos te mostrar as principais ferramentas — você pode pular a qualquer momento.',
        posicaoBalao: 'center',
      },
      {
        id: 'sidebar-visao-geral',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="nav-visao-geral"]',
        titulo: 'Visão Geral',
        descricao: 'Sua página inicial. Aqui você acompanha suas vistorias recentes e conhece as funcionalidades do ecossistema.',
      },
      {
        id: 'sidebar-checkup',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="nav-checklist"]',
        titulo: 'Check-up',
        descricao: 'Aqui você realiza a Inspeção Predial completa — o Laudo Técnico de Inspeção Predial (LTIP), conforme a ABNT NBR 16747:2020.',
      },
      {
        id: 'sidebar-cautelar',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="nav-cautelar"]',
        titulo: 'Cautelar',
        descricao: 'A Vistoria Cautelar de Vizinhança, para registrar o estado de imóveis vizinhos antes do início de uma obra.',
      },
      {
        id: 'sidebar-orcamento',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="nav-orcamento"]',
        titulo: 'Orçamento',
        descricao: 'Módulo de Orçamento e Planejamento — em desenvolvimento, com o roadmap do que está por vir.',
      },
      {
        id: 'sidebar-perfil',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="btn-perfil"]',
        titulo: 'Seu Perfil',
        descricao: 'Complete seus dados profissionais (nome, CAU/CREA, empresa) aqui — eles aparecem automaticamente em todos os laudos que você emitir.',
      },
      {
        id: 'visao-geral-vistorias-recentes',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="secao-vistorias-recentes"]',
        titulo: 'Suas Vistorias',
        descricao: 'Acompanhe aqui as vistorias que você já iniciou, continue de onde parou ou acesse os laudos já emitidos.',
      },
      {
        id: 'visao-geral-funcionalidades',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="secao-funcionalidades"]',
        titulo: 'O que o Predial 4.0 entrega',
        descricao: 'Conheça as funcionalidades reais do ecossistema: laudos completos, vistoria cautelar, inteligência artificial e sincronização em nuvem.',
      },
      {
        id: 'visao-geral-comunidade',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="card-comunidade"]',
        titulo: 'Comunidade Business 4.0',
        descricao: 'Conecte-se com outros engenheiros, gestores prediais e peritos na nossa comunidade exclusiva.',
      },
    ];
  }

  private montarPassosCheckup(): TourStep[] {
    return [
      {
        id: 'checkup-intro',
        view: 'checklist',
        targetSelector: null,
        titulo: '📋 Check-up: Laudo Técnico de Inspeção Predial',
        descricao: 'Este é o coração do Predial 4.0. Aqui você realiza vistorias completas seguindo a ABNT NBR 16747:2020, com diagnóstico por IA e geração de laudos técnicos.',
        posicaoBalao: 'center',
      },
      {
        id: 'checkup-sincronizar',
        view: 'checklist',
        targetSelector: '[data-tour-id="checkup-btn-sincronizar"]',
        titulo: 'Sincronização em Nuvem',
        descricao: 'O app funciona 100% offline em campo. Quando tiver internet, sincronize com a nuvem para salvar ou baixar suas vistorias e fotos no Supabase.',
      },
      {
        id: 'checkup-lista-vistorias',
        view: 'checklist',
        targetSelector: '[data-tour-id="checkup-lista-vistorias"]',
        titulo: 'Vistorias em Andamento',
        descricao: 'Aqui ficam salvas as suas vistorias de campo. Você pode retomar a inspeção a qualquer momento, editar dados ou sincronizar individualmente.',
      },
      {
        id: 'checkup-nova-vistoria',
        view: 'checklist',
        targetSelector: '[data-tour-id="checkup-btn-nova-vistoria"]',
        titulo: 'Criar Nova Vistoria',
        descricao: 'Clique aqui para iniciar uma nova inspeção predial. Vamos abrir o formulário para você ver como é fácil configurar.',
        acaoAoEntrar: 'abrir-criacao-vistoria',
      },
      {
        id: 'checkup-dados-basicos',
        view: 'checklist',
        targetSelector: '[data-tour-id="checkup-dados-basicos"]',
        titulo: 'Dados Básicos e Localização',
        descricao: 'Identifique o edifício, endereço e dados do contratante. O GPS é capturado automaticamente para garantir a veracidade do laudo.',
      },
      {
        id: 'checkup-gerador-caracterizacao',
        view: 'checklist',
        targetSelector: '[data-tour-id="checkup-gerador-caracterizacao"]',
        titulo: 'Caracterização do Imóvel & IA',
        descricao: 'Economize tempo gerando o memorial descritivo com IA, croqui e mapa interativo de localização da edificação.',
      },
      {
        id: 'checkup-fotos-gerais',
        view: 'checklist',
        targetSelector: '[data-tour-id="checkup-fotos-gerais"]',
        titulo: 'Fotos Gerais da Edificação',
        descricao: 'Adicione fotos da fachada, cobertura e entorno. Elas são comprimidas automaticamente e compõem a Seção 4 do seu laudo.',
      },
      {
        id: 'checkup-selecao-sistemas',
        view: 'checklist',
        targetSelector: '[data-tour-id="checkup-selecao-sistemas"]',
        titulo: 'Sistemas e Tipologias',
        descricao: 'Selecione quais sistemas construtivos serão inspecionados: estrutura, vedações, impermeabilização, instalações elétricas, hidrossanitárias e mais.',
      },
      {
        id: 'checkup-gerar-prancheta',
        view: 'checklist',
        targetSelector: '[data-tour-id="checkup-btn-gerar-prancheta"]',
        titulo: 'Prancheta Digital de Campo',
        descricao: 'Ao clicar aqui, o sistema gera a prancheta de campo personalizada com todas as patologias catalogadas para sua vistoria no local.',
      },
    ];
  }

  private montarPassosExecucao(): TourStep[] {
    return [
      {
        id: 'execucao-intro',
        view: 'checklist',
        targetSelector: null,
        titulo: '🔍 Executando a Vistoria',
        descricao: 'Depois de gerar a prancheta, você chega aqui: a tela de execução da inspeção em campo. Vamos ver como funciona o preenchimento.',
        posicaoBalao: 'center',
        acaoAoEntrar: 'ir-para-execucao-demo',
      },
      {
        id: 'execucao-cabecalho',
        view: 'checklist',
        targetSelector: '[data-tour-id="execucao-cabecalho"]',
        titulo: 'Painel da Inspeção',
        descricao: 'Aqui você acompanha o nome do edifício, o status de sincronização com a nuvem, e um indicador de "Salvo" toda vez que você atualiza um item.',
      },
      {
        id: 'execucao-filtros-status',
        view: 'checklist',
        targetSelector: '[data-tour-id="execucao-filtros-status"]',
        titulo: 'Filtrar por Status',
        descricao: 'Filtre os itens do checklist por Conforme, Não Conforme ou pendentes de avaliação — útil para revisar rapidamente o que ainda falta.',
      },
      {
        id: 'execucao-item-checklist',
        view: 'checklist',
        targetSelector: '[data-tour-id="execucao-item-checklist"]',
        titulo: 'Avaliação de Campo',
        descricao: 'Para cada item do checklist, classifique como Pass (Conforme), Fail (Não Conforme) ou N/A. Ao marcar uma falha, você pode anexar fotos — nossa IA analisa a imagem e sugere o diagnóstico e o grau de criticidade automaticamente.',
      },
      {
        id: 'execucao-mais-acoes',
        view: 'checklist',
        targetSelector: '[data-tour-id="execucao-btn-mais-acoes"]',
        titulo: 'Mais Ações',
        descricao: 'Este menu reúne as demais etapas do laudo: Documentos Norteadores, Anamnese, Avaliação de Manutenção, Avaliação de Criticidade, Conclusões e Anexo de ART/RRT — além da opção de pausar e retomar depois.',
      },
      ...this.montarPassosSubTelasCheckup(),
      {
        id: 'execucao-salvar-nuvem',
        view: 'checklist',
        targetSelector: '[data-tour-id="execucao-btn-salvar-nuvem"]',
        titulo: 'Salvar na Nuvem',
        descricao: 'Salve seu progresso na nuvem a qualquer momento — mesmo no meio da vistoria. Assim você pode continuar de outro aparelho depois.',
      },
    ];
  }

  private montarPassosSubTelasCheckup(): TourStep[] {
    return [
      {
        id: 'norteadores-intro',
        view: 'checklist',
        targetSelector: '[data-tour-id="norteadores-cabecalho"]',
        titulo: 'Documentos Norteadores',
        descricao: 'Registre quais documentos de referência (projetos, manuais, laudos anteriores) foram disponibilizados pelo responsável legal — parte do Anexo I do laudo.',
        acaoAoEntrar: 'ir-para-norteadores-demo',
      },
      {
        id: 'anamnese-intro',
        view: 'checklist',
        targetSelector: '[data-tour-id="anamnese-cabecalho"]',
        titulo: 'Anamnese',
        descricao: 'Registre o histórico da edificação e relatos colhidos durante a vistoria — informações que complementam o diagnóstico técnico.',
        acaoAoEntrar: 'ir-para-anamnese-demo',
      },
      {
        id: 'avaliacao-manutencao-intro',
        view: 'checklist',
        targetSelector: '[data-tour-id="avaliacao-manutencao-cabecalho"]',
        titulo: 'Avaliação da Manutenção e Uso',
        descricao: 'Seção 11.0 do laudo, conforme a ABNT NBR 16747 — avalie como a edificação está sendo mantida e utilizada.',
        acaoAoEntrar: 'ir-para-avaliacao-manutencao-demo',
      },
      {
        id: 'avaliacao-criticidade-intro',
        view: 'checklist',
        targetSelector: '[data-tour-id="avaliacao-criticidade-cabecalho"]',
        titulo: 'Avaliação do Grau de Criticidade',
        descricao: 'Seção 12.0 do laudo — consolide o grau de criticidade das não conformidades encontradas durante a inspeção.',
        acaoAoEntrar: 'ir-para-avaliacao-criticidade-demo',
      },
      {
        id: 'conclusoes-intro',
        view: 'checklist',
        targetSelector: '[data-tour-id="conclusoes-cabecalho"]',
        titulo: 'Conclusões e Considerações Finais',
        descricao: 'Seção 13.0 do laudo — o fechamento técnico da inspeção, com o parecer final do responsável técnico.',
        acaoAoEntrar: 'ir-para-conclusoes-demo',
      },
      {
        id: 'anexo-art-intro',
        view: 'checklist',
        targetSelector: '[data-tour-id="anexo-art-cabecalho"]',
        titulo: 'Anexo IV — ART/RRT',
        descricao: 'Anexe o comprovante da Anotação ou Registro de Responsabilidade Técnica — o documento que confere validade legal ao laudo.',
        acaoAoEntrar: 'ir-para-anexo-art-demo',
      },
    ];
  }

  private montarPassosCautelar(): TourStep[] {
    return [
      {
        id: 'cautelar-intro',
        view: 'cautelar',
        targetSelector: null,
        titulo: '🏘️ Vistoria Cautelar de Vizinhança',
        descricao: 'Módulo completo para caracterização da obra geradora e constatação de anomalias nos imóveis vizinhos na área de influência, conforme a Norma IBAPE/SP 2025 e NBR 13752.',
        posicaoBalao: 'center',
      },
      {
        id: 'cautelar-sincronizar',
        view: 'cautelar',
        targetSelector: '[data-tour-id="cautelar-btn-sincronizar"]',
        titulo: 'Sincronização em Nuvem',
        descricao: 'Sincronize todas as obras geradoras e os laudos dos imóveis vizinhos com a nuvem do Supabase, garantindo backup e acesso entre dispositivos.',
      },
      {
        id: 'cautelar-nova-vistoria',
        view: 'cautelar',
        targetSelector: '[data-tour-id="cautelar-btn-nova-vistoria"]',
        titulo: 'Cadastrar Obra Geradora',
        descricao: 'Inicie uma nova vistoria cadastrando a obra causadora do impacto e os dados do solicitante.',
        acaoAoEntrar: 'abrir-criacao-cautelar',
      },
      {
        id: 'cautelar-solicitante',
        view: 'cautelar',
        targetSelector: '[data-tour-id="cautelar-solicitante"]',
        titulo: 'Dados do Solicitante',
        descricao: 'Identifique a construtora, incorporadora ou contratante responsável pela obra e pela contratação da vistoria cautelar.',
      },
      {
        id: 'cautelar-obra-geradora',
        view: 'cautelar',
        targetSelector: '[data-tour-id="cautelar-obra-geradora"]',
        titulo: 'Caracterização da Obra Geradora',
        descricao: 'Cadastre os dados técnicos da obra (sistema estrutural, fundação, logística e impactos previstos) e anexe fotos e plantas do canteiro.',
      },
      {
        id: 'cautelar-painel-status',
        view: 'cautelar',
        targetSelector: '[data-tour-id="cautelar-painel-status"]',
        titulo: 'Painel de Status dos Imóveis',
        descricao: 'Acompanhe em tempo real o progresso da vistoria na vizinhança: total de imóveis, laudos concluídos, acessos negados e vistorias pendentes.',
        acaoAoEntrar: 'abrir-detalhe-cautelar-demo',
      },
      {
        id: 'cautelar-adicionar-imovel',
        view: 'cautelar',
        targetSelector: '[data-tour-id="cautelar-btn-adicionar-imovel"]',
        titulo: 'Adicionar Imóveis Vizinhos',
        descricao: 'Adicione cada um dos imóveis localizados na área de influência da obra para realizar a vistoria individual.',
      },
      {
        id: 'cautelar-lista-imoveis',
        view: 'cautelar',
        targetSelector: '[data-tour-id="cautelar-lista-imoveis"]',
        titulo: 'Gestão dos Imóveis',
        descricao: 'Acesse o laudo de cada imóvel para registrar ambientes, elementos construtivos, ocorrências fotográficas com IA e termos de autorização de acesso.',
      },
      {
        id: 'cautelar-consolidar',
        view: 'cautelar',
        targetSelector: '[data-tour-id="cautelar-btn-consolidar"]',
        titulo: 'Consolidação do Laudo-Mestre',
        descricao: 'Gere o Laudo Completo consolidado reunindo a caracterização da obra geradora e todas as vistorias individuais dos imóveis vizinhos em um único PDF técnico.',
      },
    ];
  }

  private montarPassosImovelCautelar(): TourStep[] {
    return [
      {
        id: 'imovel-intro',
        view: 'cautelar',
        targetSelector: null,
        titulo: '🏠 Ficha do Imóvel Vizinho',
        descricao: 'Ao clicar em um imóvel da lista, você abre esta ficha completa — vamos ver as principais seções.',
        posicaoBalao: 'center',
        acaoAoEntrar: 'abrir-detalhe-imovel-demo',
      },
      {
        id: 'imovel-autorizacao-acesso',
        view: 'cautelar',
        targetSelector: '[data-tour-id="imovel-autorizacao-acesso"]',
        titulo: 'Autorização de Acesso',
        descricao: 'Registre se o morador autorizou a vistoria total, parcial (com restrições) ou negou o acesso — essencial para a validade do laudo.',
      },
      {
        id: 'imovel-dados',
        view: 'cautelar',
        targetSelector: '[data-tour-id="imovel-dados"]',
        titulo: 'Dados do Imóvel',
        descricao: 'Endereço e posição relativa à obra geradora — confrontante lateral, de fundos, de frente ou transversal.',
      },
      {
        id: 'imovel-caracteristicas',
        view: 'cautelar',
        targetSelector: '[data-tour-id="imovel-caracteristicas"]',
        titulo: 'Características Construtivas',
        descricao: 'Detalhe o sistema construtivo do imóvel vizinho — item 6.4.1-b da norma, importante para a análise técnica futura em caso de reclamação.',
      },
      {
        id: 'imovel-estado-conservacao',
        view: 'cautelar',
        targetSelector: '[data-tour-id="imovel-estado-conservacao"]',
        titulo: 'Estado de Conservação',
        descricao: 'Classifique o estado geral do imóvel no momento da vistoria — a base factual que protege todas as partes envolvidas.',
      },
      {
        id: 'imovel-checklist-ambientes',
        view: 'cautelar',
        targetSelector: '[data-tour-id="imovel-checklist-ambientes"]',
        titulo: 'Checklist de Ambientes',
        descricao: 'Percorra cada ambiente do imóvel, registrando fotos e observações — a evidência fotográfica é obrigatória antes de poder consolidar o laudo.',
      },
      {
        id: 'imovel-assinaturas',
        view: 'cautelar',
        targetSelector: '[data-tour-id="imovel-assinaturas"]',
        titulo: 'Assinaturas',
        descricao: 'O vistoriador é sempre você, o usuário logado — os dados vêm automaticamente do seu perfil. Você pode ainda registrar um corresponsável técnico, se aplicável.',
      },
    ];
  }

  private montarPassosOrcamentoENotificacoes(): TourStep[] {
    return [
      {
        id: 'orcamento-intro',
        view: 'orcamento',
        targetSelector: '[data-tour-id="orcamento-cabecalho"]',
        titulo: '💰 Módulo de Orçamento',
        descricao: 'Este módulo está em desenvolvimento — vai reunir Plano de Ação, Orçamento de Referência e Caderno de Encargos, aproveitando os dados já coletados nas suas vistorias.',
      },
      {
        id: 'orcamento-escopo',
        view: 'orcamento',
        targetSelector: '[data-tour-id="orcamento-escopo"]',
        titulo: 'O que vem por aí',
        descricao: 'Confira o escopo planejado: cronograma de intervenções, estimativa de custos e o caderno de encargos técnico, tudo conectado ao que você já registrou no Check-up.',
      },
      {
        id: 'notificacoes-intro',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="btn-notificacoes"]',
        titulo: '🔔 Central de Notificações',
        descricao: 'Aqui você recebe alertas sobre suas vistorias, avisos do sistema e comunicados importantes. O número vermelho mostra quantos ainda não foram lidos.',
        acaoAoEntrar: 'requer-login',
      },
    ];
  }

  private montarPassosPerfil(): TourStep[] {
    return [
      {
        id: 'perfil-intro',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="btn-perfil"]',
        titulo: '👤 Seu Perfil Profissional',
        descricao: 'Este é o último passo do nosso tour. Vamos ver onde você completa seus dados profissionais.',
        posicaoBalao: 'bottom',
        acaoAoEntrar: 'requer-login',
      },
      {
        id: 'perfil-cabecalho',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="perfil-cabecalho"]',
        titulo: 'Perfil Profissional',
        descricao: 'Preencha seus dados uma vez — eles aparecem automaticamente em todos os laudos que você emitir, no cabeçalho, na capa e no selo de responsabilidade técnica.',
        acaoAoEntrar: 'abrir-modal-perfil',
      },
      {
        id: 'perfil-dados-profissionais',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="perfil-dados-profissionais"]',
        titulo: 'Dados Profissionais',
        descricao: 'Nome completo, título profissional e o registro no CAU ou CREA — essencial para que seus laudos tenham validade técnica.',
      },
      {
        id: 'perfil-dados-empresa',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="perfil-dados-empresa"]',
        titulo: 'Dados da Empresa',
        descricao: 'Se você trabalha através de uma empresa, complete aqui o CNPJ, endereço e contatos — tudo aparece no cabeçalho institucional dos documentos.',
      },
      {
        id: 'perfil-salvar',
        view: 'visao-geral',
        targetSelector: '[data-tour-id="perfil-btn-salvar"]',
        titulo: 'Pronto para começar!',
        descricao: 'Salve seus dados e comece a usar o Predial 4.0 de verdade. Você pode revisitar este tour a qualquer momento pelo menu lateral.',
      },
    ];
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

    // Liberação REAL do Admin — decidida via permissoes_acesso (mesmo
    // modelo centralizado usado pela Comunidade Nova), não mais pela
    // coluna `role`, que fica obsoleta a partir deste bloco.
    const ehAdmin = await this.supabaseService.temPermissaoModulo('predial4', 'admin');
    if (ehAdmin) {
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

  private async sincronizarSilenciosamente(): Promise<void> {
    try {
      const [resPredial, resCautelar] = await Promise.all([
        this.syncService.baixarDaNuvem(),
        this.syncService.baixarVistoriasCautelaresDaNuvem()
      ]);
      const totalPredial = resPredial.baixadas + resPredial.atualizadas;
      const totalCautelar = resCautelar.baixadas + resCautelar.atualizadas;
      const total = totalPredial + totalCautelar;

      if (totalPredial > 0) {
        const list = await this.dbService.getAllVistorias();
        this.todasVistorias.set(list);
        this.notificationService.gerarLembretesLocais(this.todasVistorias(), this.userProfile());
      }

      if (total > 0) {
        const partes: string[] = [];
        if (totalPredial > 0) {
          partes.push(`${totalPredial} inspeção(ões) predial(ais)`);
        }
        if (totalCautelar > 0) {
          partes.push(`${totalCautelar} vistoria(s) cautelar(es)`);
        }
        this.toastService.show(
          `${partes.join(' e ')} sincronizada(s) da nuvem.`,
          'info'
        );
      }
    } catch (e) {
      console.warn('Erro ao sincronizar em segundo plano:', e);
    }
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
        void this.sincronizarSilenciosamente();
      }
    } catch (e) {
      console.error('Erro ao verificar sessão do Supabase:', e);
    } finally {
      // Marca que a checagem inicial desta execução da página já rodou —
      // a partir daqui, qualquer evento do listener abaixo já é considerado
      // "depois do carregamento", não mais "a própria abertura da página".
      this.sessaoInicialProcessada = true;
    }

    // Listener para mudanças no estado de autenticação
    this.supabaseService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.isLoggedIn.set(false);
        this.showLogin.set(true);
        this.userName.set('');
        this.admAcessoLiberado.set(false);
        return;
      }

      if (!session?.user) {
        return;
      }

      this.isLoggedIn.set(true);
      this.showLogin.set(false);
      const email = session.user.email || '';
      const name = email.includes('@') ? email.split('@')[0] : email;
      this.userName.set(name || 'Usuário');

      // Só reage (toast + recarregar tudo) se a sessão inicial desta
      // execução da página JÁ tiver sido processada — ou seja, este evento
      // aconteceu DEPOIS da checagem inicial, o que só acontece em um login
      // manual de verdade feito pelo usuário durante esta sessão do navegador.
      // Isso evita depender do nome do evento (SIGNED_IN vs INITIAL_SESSION),
      // que o próprio Supabase não usa de forma 100% consistente entre
      // carregamentos de página.
      if (this.sessaoInicialProcessada) {
        this.toastService.show(`Autenticado como: ${email}`, 'success');
        void this.carregarPerfilDoSupabase(session.user.id);
        void this.sincronizarSilenciosamente();
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

    // Inicializar passos do Tour Guiado
    this.tourService.registrarPassos([
      ...this.montarPassosVisaoGeralESidebar(),
      ...this.montarPassosCheckup(),
      ...this.montarPassosExecucao(),
      ...this.montarPassosCautelar(),
      ...this.montarPassosImovelCautelar(),
      ...this.montarPassosOrcamentoENotificacoes(),
      ...this.montarPassosPerfil()
    ]);
  }
}