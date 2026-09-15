import { Component, ChangeDetectionStrategy, signal, computed, inject, effect, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, NormaRef, normaAplicavelATipologia } from '../../services/data.service';
import { ToastService } from '../../services/toast.service';
import { TourService } from '../../services/tour.service';
import { UserProfile } from '../../models/user-profile.model';
import { registroValido, generateStandardFooter, GeminiService } from '../../services/gemini.service';
import { VistoriaDbService, Evidencia } from '../../services/vistoria-db.service';
import { CameraService } from '../../services/camera.service';
import { OrcamentoService, Composicao } from '../../services/orcamento.service';
import { SyncService } from '../../services/sync.service';
import { GeradorCaracterizacaoComponent } from '../gerador-caracterizacao/gerador-caracterizacao.component';
import { DadosCaracterizacao } from '../../models/caracterizacao.model';
import { LAUDO_LTIP_CSS } from './laudo-ltip.styles';
import {
  gerarQualificacaoHtml, gerarGlossarioHtml, gerarRessalvasHtml, gerarMetodologiaHtml,
  gerarDiagnosticoHtml, gerarAnexoIVHtml, gerarEncerramentoHtml, gerarSecao4Html,
  gerarSecao9Html, markdownParaHtmlPdf, gerarSecao8DocumentosNorteadoresHtml,
  gerarAnexoINorteadoresHtml, gerarAnamneseHtml, gerarSumarioHtml, gerarSecao7Html,
} from './laudo-ltip-html';

export interface FichaDano {
  id: string;
  numeroFicha: number;                    // sequencial GLOBAL na Vistoria
  pavimento?: string;
  ambiente?: string;
  id_evidencias?: string[];               // chaves das fotos no store 'evidencias'
  diagnostico_ia?: string;
  sugestaoIaPendente?: {
    classificacaoTipo?: string;
    classificacaoSubtipo?: string;
    manifestacao?: string;
    causaProvavel?: string;
    recomendacaoTecnica?: string;
    severitySugerida?: 'Mínimo' | 'Regular' | 'Crítico';
  } | null;
  historicoSugestoesIa?: Array<{
    classificacaoTipo?: string;
    classificacaoSubtipo?: string;
    manifestacao?: string;
    causaProvavel?: string;
    recomendacaoTecnica?: string;
    severitySugerida?: 'Mínimo' | 'Regular' | 'Crítico';
    decisao: 'aceita' | 'descartada';
    decididaEm: string;
  }>;
  quantitativo?: string;
  memorialDescritivo?: string;
  correlacaoFotoPatologia?: 'CONFIRMADA' | 'DIVERGENTE' | 'INCONCLUSIVA';
  observacaoDivergencia?: string;
  falhaAnaliseIa?: boolean;
  composicoesAplicadas?: string[];
  severity?: 'Mínimo' | 'Regular' | 'Crítico';
  notes: string;
  classificacao?: { tipo: 'ANOMALIA' | 'FALHA' | 'INDETERMINADO'; subtipo?: string };
  manifestacao?: string;
  causaProvavel?: string;
  recomendacaoTecnica?: string;
  normasAplicaveis?: NormaRef[];
  criticidade?: 'P1' | 'P2' | 'P3';
  gut?: { g: number; u: number; t: number };
  dateCreated: string;
  dateUpdated: string;
}

export interface ChecklistItem {
  id: string;
  systemTitle: string;
  typologyTitle: string;
  title: string;
  description: string;
  status: 'PENDENTE' | 'PASS' | 'FAIL' | 'NA' | 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL';
  ocorrencias: FichaDano[];
}

export interface FotoGeral {
  dataUrl: string;
  timestamp: string;
  legenda?: string;
}

export interface Anexo {
  id: string;          // crypto.randomUUID()
  nome: string;        // file.name
  tipo: string;        // MIME real — file.type (ex.: 'image/png', 'application/pdf')
  tamanho: number;     // file.size (bytes)
  dataUpload: string;  // new Date().toISOString()
  legenda?: string;          // NOVO — do que se trata o anexo (caption/legenda)
  constatacaoId?: string;    // NOVO — vínculo opcional a uma Constatacao da mesma anamnese
}

export type DisponibilidadeNorteador = 'A_AVALIAR' | 'DD' | 'DND' | 'NA';
export type ConformidadeNorteador   = 'EC' | 'NC';

export interface DocumentoNorteador {
  id: string;
  grupo: string;                              // ex.: 'Administrativos e técnicos'
  descricao: string;                          // vem do seed; read-only na UI (editável só em item extra)
  seed: boolean;                              // true = item canônico do LIP; false = item extra do RT
  disponibilidade: DisponibilidadeNorteador;  // default 'A_AVALIAR'
  conformidade?: ConformidadeNorteador;       // SÓ quando disponibilidade === 'DD'
  observacao?: string;
  anexos: Anexo[];                            // metadados; blobs no store
}

export type TipoConstatacao = 'RELATO_OCUPANTE' | 'HISTORICO' | 'INTERVENCAO' | 'PATOLOGIA_RECORRENTE' | 'OUTROS';

export interface Constatacao {
  id: string;
  tipo: TipoConstatacao;
  descricao: string;          // texto principal (rótulo adapta por tipo)
  nomeOcupante?: string;      // RELATO_OCUPANTE (obrig.)
  identificacao?: string;     // RELATO_OCUPANTE (obrig.) — vínculo/unidade
  data?: string;              // HISTORICO (obrig.), INTERVENCAO (obrig.)
  fonteRelato?: string;       // PATOLOGIA_RECORRENTE (obrig.) — quem relatou / como foi verificada
  dateCreated: string;
}

export interface Anamnese {
  constatacoes: Constatacao[];
  anexos: Anexo[];
}

export interface Vistoria {
  id: string;
  buildingName: string;
  address: string;
  areaConstruida?: string;
  idadeEdificacao?: string;
  lat?: number;
  lng?: number;
  gpsAccuracy?: number;
  objetoNatureza?: string;          // mantido para compatibilidade com registros antigos
  memoriaDescritivo?: string;       // Memorial Descritivo da Edificação — aparece na Seção 4
  artRrtNumero?: string;
  mapaImagemBase64?: string;
  fotosGerais?: FotoGeral[];        // fotos situacionais da edificação (max 4, JPEG comprimidas)
  tipoUso?: string;                 // tipologia/uso da edificação (Residencial, Comercial, etc.)
  contratanteCnpj?: string;         // CNPJ do contratante
  contratanteRazaoSocial?: string;  // razão social do contratante
  solicitanteEndereco?: string;
  responsavelLegalNome?: string;
  responsavelLegalDocumento?: string;
  padraoAcabamento?: 'Alto' | 'Normal' | 'Baixo';
  numeroPavimentos?: string;
  sistemaEstruturalPredominante?: string;
  sistemaFundacao?: string;
  horarioFuncionamento?: string;
  nivelInspecao?: '1' | '2' | '3';
  nivelInspecaoMetodologia?: string;
  nivelInspecaoJustificativa?: string;
  contadorFichas: number;           // default 0
  dateCreated: string;
  dateUpdated: string;
  progress: number;
  items: ChecklistItem[];
  documentosNorteadores?: DocumentoNorteador[];
  anamnese?: Anamnese;
  exibirGlossario?: boolean;   // NOVO — Seção 3.0 do laudo; on por padrão (undefined = true)
  avaliacaoManutencaoTexto?: string;   // NOVO — Seção 11.0; texto sugerido automaticamente, sempre editável pelo RT
  avaliacaoCriticidadeTexto?: string;   // NOVO — Seção 12.0; texto sugerido automaticamente, sempre editável pelo RT
  conclusaoSinteseTexto?: string;         // NOVO — 13.1
  conclusaoRiscosTexto?: string;          // NOVO — 13.2
  conclusaoRecomendacoesTexto?: string;   // NOVO — 13.3
  conclusaoConsideracoesTexto?: string;   // NOVO — 13.4
  anexoArtRrt?: Anexo;   // NOVO — metadados do ART/RRT anexado; blob no store 'anexos' (mesmo mecanismo do Bloco 3)
  sincronizadoEm?: string; // NOVO — ISO timestamp da última sincronização bem-sucedida. undefined = nunca sincronizado.
  cloudId?: string; // UUID gerado pelo Supabase na primeira sincronização. Nunca gerado localmente, nunca editado manualmente.
}

export interface LaudoEmitido {
  id: string;                  // crypto.randomUUID()
  numeroEmissao: number;       // sequencial global (contagem do store no momento da emissão + 1)
  vistoriaId: string;          // referência informativa à vistoria de origem — NÃO usar para editar
  buildingName: string;
  address: string;
  dataEmissao: string;         // ISO — timestamp exato da emissão
  snapshotVistoria: Vistoria;  // cópia profunda e congelada da vistoria completa no momento da emissão
  snapshotProfile: UserProfile;// cópia profunda e congelada do perfil do RT no momento da emissão
}

const SchemaType = {
  OBJECT: 'object',
  STRING: 'string',
  ARRAY: 'array',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
} as const;

const SCHEMA_ANALISE_EVIDENCIA = {
  type: SchemaType.OBJECT,
  properties: {
    texto: { type: SchemaType.STRING },
    severitySugerida: { type: SchemaType.STRING, enum: ['Mínimo', 'Regular', 'Crítico'] },
    correlacaoFotoPatologia: { type: SchemaType.STRING, enum: ['CONFIRMADA', 'DIVERGENTE', 'INCONCLUSIVA'] },
    observacaoDivergencia: { type: SchemaType.STRING },
    classificacaoTipo: { type: SchemaType.STRING, enum: ['ANOMALIA', 'FALHA', 'INDETERMINADO'] },
    classificacaoSubtipo: { type: SchemaType.STRING, enum: ['endogena','exogena','natural','funcional','planejamento','execucao','operacional','gerencial'] },
    manifestacao: { type: SchemaType.STRING },
    causaProvavel: { type: SchemaType.STRING },
    recomendacaoTecnica: { type: SchemaType.STRING },
  },
  required: ['texto', 'severitySugerida', 'correlacaoFotoPatologia'],
};

function derivarPatamarPrioridade(
  grauRisco: 'Mínimo' | 'Regular' | 'Crítico' | undefined | null
): 'P1' | 'P2' | 'P3' | '' {
  if (grauRisco === 'Crítico') return 'P1';
  if (grauRisco === 'Regular') return 'P2';
  if (grauRisco === 'Mínimo') return 'P3';
  return '';
}

const CONSTATACAO_META: Record<TipoConstatacao, { rotulo: string; labelPrincipal: string; placeholderPrincipal: string }> = {
  RELATO_OCUPANTE:      { rotulo: 'Relato de ocupante',              labelPrincipal: 'Relato',                    placeholderPrincipal: 'O que foi relatado…' },
  HISTORICO:            { rotulo: 'Histórico da edificação',         labelPrincipal: 'Histórico',                 placeholderPrincipal: 'Ex.: edificação construída em meados de 2008…' },
  INTERVENCAO:          { rotulo: 'Intervenção / reforma anterior',  labelPrincipal: 'Detalhes da intervenção',   placeholderPrincipal: 'O que foi feito, em qual sistema…' },
  PATOLOGIA_RECORRENTE: { rotulo: 'Patologia recorrente observada',  labelPrincipal: 'Patologia observada',       placeholderPrincipal: 'Manifestação recorrente relatada…' },
  OUTROS:               { rotulo: 'Outros',                          labelPrincipal: 'Constatação',               placeholderPrincipal: 'Descreva a constatação…' },
};

const METODOLOGIA_NIVEL: Record<'1' | '2' | '3', string> = {
  '1': 'A metodologia adotada para o Nível 1 baseia-se em inspeção predominantemente sensorial (visual), de caráter expedito, realizada a partir do solo ou de pontos de observação acessíveis, sem auxílio de equipamentos de ensaio avançados ou procedimentos destrutivos. Objetiva identificar anomalias e falhas aparentes para subsidiar as diretrizes de manutenção periódica.',
  '2': 'A metodologia adotada para o Nível 2 engloba a verificação visual detalhada e sistemática de todos os elementos acessíveis da edificação, complementada pela análise minuciosa da documentação técnica disponível (como projetos, manuais de uso e relatórios de manutenção anteriores). Utiliza-se de medições locais de campo e classificação estruturada de prioridades.',
  '3': 'A metodologia adotada para o Nível 3 consiste em auditoria técnica e diagnóstica de alta complexidade. Envolve a realização de ensaios tecnológicos in situ ou em laboratório (provas de carga, esclerometria, ultrassom, ensaio de carbonatação, termografia, etc.), análise aprofundada de projetos e acompanhamento da evolução de manifestações patológicas específicas.'
};

const JUSTIFICATIVA_NIVEL: Record<'1' | '2' | '3', string> = {
  '1': 'Justifica-se a adoção do Nível 1 pela inexistência de documentação técnica histórica do imóvel, associada a uma demanda de vistoria preliminar para identificação rápida de manifestações patológicas aparentes, sem indícios iniciais de risco estrutural generalizado ou iminente que exijam ensaios específicos.',
  '2': 'Justifica-se a adoção do Nível 2 devido à existência de acervo documental parcial ou completo da edificação, necessitando-se de uma avaliação sistemática e detalhada para organizar o planejamento de manutenção preventiva/corretiva a médio prazo.',
  '3': 'Justifica-se a adoção do Nível 3 pela constatação prévia de graves anomalias com potencial comprometimento estrutural ou de segurança, demandando-se ensaios específicos e investigação profunda para determinar causas, mechanisms de degradação e diretrizes precisas de reabilitação.'
};

const SEED_NORTEADORES_RAW: { grupo: string; descricao: string }[] = [
  { grupo: 'Administrativos e técnicos', descricao: 'Manual de uso, operação e manutenção da edificação' },
  { grupo: 'Administrativos e técnicos', descricao: 'Manuais técnicos de equipamentos instalados' },
  { grupo: 'Administrativos e técnicos', descricao: 'Auto de conclusão (Habite-se)' },
  { grupo: 'Administrativos e técnicos', descricao: 'Alvará de funcionamento' },
  { grupo: 'Administrativos e técnicos', descricao: 'Alvará de instalação de elevadores' },
  { grupo: 'Administrativos e técnicos', descricao: 'Alvará de funcionamento de elevadores' },
  { grupo: 'Administrativos e técnicos', descricao: 'AVCB — Auto de Vistoria do Corpo de Bombeiros' },
  { grupo: 'Administrativos e técnicos', descricao: 'Projetos legais aprovados (poder público, SCI, concessionárias)' },
  { grupo: 'Administrativos e técnicos', descricao: 'Projetos executivos' },
  { grupo: 'Administrativos e técnicos', descricao: 'Regimento interno' },
  { grupo: 'Administrativos e técnicos', descricao: 'Licenças ambientais' },
  { grupo: 'Administrativos e técnicos', descricao: 'TAC ambiental' },
  { grupo: 'Administrativos e técnicos', descricao: 'Outorga de poço profundo' },
  { grupo: 'Administrativos e técnicos', descricao: 'Outorga de ETE' },
  { grupo: 'Administrativos e técnicos', descricao: 'Cadastro de máquinas e equipamentos' },
  { grupo: 'Administrativos e técnicos', descricao: 'Atestado de brigada de incêndio' },
  { grupo: 'Administrativos e técnicos', descricao: 'RIA — Relatório de Inspeção Anual de elevadores' },
  { grupo: 'Administrativos e técnicos', descricao: 'Contrato de manutenção — elevadores' },
  { grupo: 'Administrativos e técnicos', descricao: 'Contrato de manutenção — geradores' },
  { grupo: 'Administrativos e técnicos', descricao: 'Contrato de manutenção — SCI (combate a incêndio)' },
  { grupo: 'Manutenção e operação', descricao: 'PMOC — Plano de Manutenção, Operação e Controle' },
  { grupo: 'Manutenção e operação', descricao: 'Atestado de desratização / desinsetização' },
  { grupo: 'Manutenção e operação', descricao: 'Atestado SPDA + medição ôhmica' }
];

@Component({
  selector: 'app-checklist-inspecao',
  templateUrl: './checklist-inspecao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, GeradorCaracterizacaoComponent],
})
export class ChecklistInspecaoComponent implements OnInit, OnDestroy {
  private dataService = inject(DataService);
  private toastService = inject(ToastService);
  private dbService = inject(VistoriaDbService);
  public camera = inject(CameraService);
  private geminiService = inject(GeminiService);
  orcamentoService = inject(OrcamentoService);
  public syncService = inject(SyncService);
  public tourService = inject(TourService);

  constructor() {
    effect(() => {
      const isAtivo = this.tourService.isTourAtivo();
      const passo = this.tourService.passoAtual();
      if (!isAtivo || !passo) return;

      if (passo.view === 'checklist') {
        const passosCriacao = [
          'checkup-dados-basicos',
          'checkup-gerador-caracterizacao',
          'checkup-fotos-gerais',
          'checkup-selecao-sistemas',
          'checkup-gerar-prancheta'
        ];
        const passosExecucao = [
          'execucao-intro',
          'execucao-cabecalho',
          'execucao-filtros-status',
          'execucao-item-checklist',
          'execucao-mais-acoes',
          'execucao-salvar-nuvem'
        ];

        const passosSubTelas = [
          'norteadores-intro',
          'anamnese-intro',
          'avaliacao-manutencao-intro',
          'avaliacao-criticidade-intro',
          'conclusoes-intro',
          'anexo-art-intro'
        ];

        const mapaAcoesSubTelas: Record<string, () => void> = {
          'ir-para-norteadores-demo': () => this.navegarParaNorteadores(),
          'ir-para-anamnese-demo': () => this.navegarParaAnamnese(),
          'ir-para-avaliacao-manutencao-demo': () => this.navegarParaAvaliacaoManutencao(),
          'ir-para-avaliacao-criticidade-demo': () => this.navegarParaAvaliacaoCriticidade(),
          'ir-para-conclusoes-demo': () => this.navegarParaConclusoes(),
          'ir-para-anexo-art-demo': () => this.navegarParaAnexoArt(),
        };

        const mapaModoEsperado: Record<string, string> = {
          'ir-para-norteadores-demo': 'NORTEADORES',
          'ir-para-anamnese-demo': 'ANAMNESE',
          'ir-para-avaliacao-manutencao-demo': 'AVALIACAO_MANUTENCAO',
          'ir-para-avaliacao-criticidade-demo': 'AVALIACAO_CRITICIDADE',
          'ir-para-conclusoes-demo': 'CONCLUSOES',
          'ir-para-anexo-art-demo': 'ANEXO_ART',
        };

        if (passo.acaoAoEntrar && mapaAcoesSubTelas[passo.acaoAoEntrar]) {
          const lista = this.vistorias();
          if (lista.length > 0) {
            if (!this.vistoriaAtiva()) {
              this.abrirVistoria(lista[0]);
            }
            if (this.modoExibicao() !== mapaModoEsperado[passo.acaoAoEntrar]) {
              mapaAcoesSubTelas[passo.acaoAoEntrar]();
            }
          } else {
            this.tourService.pularAte('cautelar-intro');
          }
        } else if (passosExecucao.includes(passo.id) || passo.acaoAoEntrar === 'ir-para-execucao-demo') {
          const lista = this.vistorias();
          if (lista.length > 0) {
            if (!this.vistoriaAtiva()) {
              this.abrirVistoria(lista[0]);
            } else if (this.modoExibicao() !== 'EXECUCAO') {
              this.modoExibicao.set('EXECUCAO');
            }
          } else {
            // Sem vistoria salva: pula diretamente o bloco de execução
            this.tourService.pularAte('cautelar-intro');
          }
        } else if (passo.acaoAoEntrar === 'abrir-criacao-vistoria' || passosCriacao.includes(passo.id)) {
          if (this.modoExibicao() !== 'CRIACAO') {
            this.abrirCriacao();
          }
        } else if ([
          'checkup-intro',
          'checkup-sincronizar',
          'checkup-lista-vistorias',
          'checkup-nova-vistoria'
        ].includes(passo.id)) {
          if (this.modoExibicao() !== 'LISTA') {
            this.modoExibicao.set('LISTA');
          }
        }
      }
    });
  }

  vistoriaEmSincronizacaoId = signal<string | null>(null);
  isSincronizandoGeral = signal<boolean>(false);

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
          this.toastService.show('Suas vistorias estão atualizadas com a nuvem.', 'info');
        }
      }
    } catch {
      this.toastService.show('Erro ao sincronizar com a nuvem.', 'error');
    } finally {
      this.isSincronizandoGeral.set(false);
    }
  }

  async sincronizarNuvem(event?: Event, vistoriaAlvo?: Vistoria): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    const target = vistoriaAlvo || this.vistoriaAtiva();
    if (!target) {
      this.toastService.show('Nenhuma vistoria selecionada para salvar na nuvem.', 'error');
      return;
    }

    this.vistoriaEmSincronizacaoId.set(target.id);
    const sucesso = await this.syncService.salvarNaNuvem(target);
    this.vistoriaEmSincronizacaoId.set(null);

    // Recarregar vistorias salvas localmente
    await this.carregarVistorias();

    // Se a vistoria ativa é a que foi sincronizada, atualizar a referência
    if (this.vistoriaAtiva()?.id === target.id) {
      const atual = this.vistorias().find(v => v.id === target.id);
      if (atual) {
        this.vistoriaAtiva.set(atual);
      }
    }

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

  // Controle de carregamento das vistorias
  carregandoVistorias = signal(true);

  @Input('isLoggedIn') isUserLoggedIn = false;
  @Input() set profile(val: UserProfile | null) {
    if (val) {
      this.userProfile.set(val);
    }
  }

  isLoggedIn(): boolean {
    return this.isUserLoggedIn;
  }

  // Perfil do profissional (pode vir local ou via input, vamos carregar do localStorage ou usar padrão)
  userProfile = signal<UserProfile | null>(null);

  // Vistorias salvas
  vistorias = signal<Vistoria[]>([]);
  laudosEmitidos = signal<LaudoEmitido[]>([]);
  carregandoLaudos = signal(true);
  vistoriaAtiva = signal<Vistoria | null>(null);
  vistoriaParaExcluir = signal<Vistoria | null>(null);

  // Estado para captura de evidência e IA
  itemCapturandoEvidencia = signal<ChecklistItem | null>(null);
  streamCamera = signal<MediaStream | null>(null);
  tipoEvidencia = signal<'contexto' | 'detalhe'>('contexto');
  capturando = signal(false);
  analisandoIa = signal(false);
  cameraIndisponivel = signal(false);
  dragOver = signal(false);
  itemSalvoFeedback = signal<string | null>(null);
  menuMaisAcoesAberto = signal<boolean>(false);

  toggleMenuMaisAcoes(): void {
    this.menuMaisAcoesAberto.update(v => !v);
  }

  fecharMenuMaisAcoes(): void {
    this.menuMaisAcoesAberto.set(false);
  }
  itemGaleriaAberta = signal<string | null>(null);
  evidenciasGaleria = signal<{ url: string; ev: Evidencia }[]>([]);
  fichaEmEdicaoId = signal<string | null>(null);
  itemDaFichaEmEdicaoId = signal<string | null>(null);
  fichaPendenteConfirmacaoExclusao = signal<string | null>(null);

  anexoUrls = signal<Record<string, string>>({});
  anexoPendenteConfirmacaoExclusao = signal<string | null>(null);
  norteadorPendenteConfirmacaoExclusao = signal<string | null>(null);

  norteadoresAgrupados = computed(() => {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return [];

    const docs = ativa.documentosNorteadores ?? [];
    
    const gruposMap = new Map<string, DocumentoNorteador[]>();
    for (const doc of docs) {
      const g = doc.grupo || 'Outros';
      if (!gruposMap.has(g)) {
        gruposMap.set(g, []);
      }
      gruposMap.get(g)!.push(doc);
    }

    const ordemSugerida = ['Administrativos e técnicos', 'Manutenção e operação', 'Itens adicionais'];
    const resultado: { nome: string; documentos: DocumentoNorteador[] }[] = [];
    
    for (const g of ordemSugerida) {
      if (gruposMap.has(g)) {
        resultado.push({ nome: g, documentos: gruposMap.get(g)! });
        gruposMap.delete(g);
      }
    }

    for (const [nome, documentos] of gruposMap.entries()) {
      resultado.push({ nome, documentos });
    }

    return resultado;
  });

  private sinalizarSalvo(itemId: string): void {
    this.itemSalvoFeedback.set(itemId);
    setTimeout(() => {
      if (this.itemSalvoFeedback() === itemId) {
        this.itemSalvoFeedback.set(null);
      }
    }, 2000);
  }

  async abrirGaleria(item: ChecklistItem): Promise<void> {
    // Toggle: se já está aberta para este item, fecha e sai.
    if (this.itemGaleriaAberta() === item.id) {
      this.fecharGaleria();
      return;
    }
    // Fecha qualquer galeria anterior (libera memória) antes de abrir a nova.
    this.fecharGaleria();

    const ids = this.obterOcorrenciaAtiva(item).id_evidencias ?? [];
    const carregadas: { url: string; ev: Evidencia }[] = [];
    for (const id of ids) {
      const ev = await this.dbService.getEvidencia(id);
      if (ev) {
        const url = URL.createObjectURL(ev.blob);
        carregadas.push({ url, ev });
      }
    }
    this.evidenciasGaleria.set(carregadas);
    this.itemGaleriaAberta.set(item.id);
  }

  fecharGaleria(): void {
    for (const e of this.evidenciasGaleria()) {
      URL.revokeObjectURL(e.url);
    }
    this.evidenciasGaleria.set([]);
    this.itemGaleriaAberta.set(null);
  }

  // Estado do formulário de criação
  novoBuildingName = signal('');
  novoAddress = signal('');
  novaAreaConstruida = signal('');
  novaIdadeEdificacao = signal('');
  novoMemoriaDescritivo = signal('');
  novoArtRrt = signal('');
  novaMapaImagemBase64 = signal<string | null>(null);
  novoFotosGerais = signal<FotoGeral[]>([]);
  novoTipoUso = signal('');
  novoContratanteCnpj = signal('');
  novoContratanteRazaoSocial = signal('');
  novoLat = signal<number | null>(null);
  novoLng = signal<number | null>(null);
  novoGpsAccuracy = signal<number | null>(null);
  selecaoSistemas = signal<{ [key: string]: boolean }>({}); // chave: "systemKey-typologyTitle"

  // Novos campos do Bloco 2a
  novoSolicitanteEndereco = signal('');
  novoResponsavelLegalNome = signal('');
  novoResponsavelLegalDocumento = signal('');
  novoPadraoAcabamento = signal<'Alto' | 'Normal' | 'Baixo'>('Normal');
  novoNumeroPavimentos = signal('');
  novoSistemaEstruturalPredominante = signal('');
  novoSistemaFundacao = signal('');
  novoHorarioFuncionamento = signal('');
  novoNivelInspecao = signal<'1' | '2' | '3'>('1');
  novoNivelInspecaoMetodologia = signal('');
  novoNivelInspecaoJustificativa = signal('');
  novoExibirGlossario = signal<boolean>(true);

  isGeradorCaracterizacaoOpen = signal(false);

  abrirGeradorCaracterizacao(): void {
    this.isGeradorCaracterizacaoOpen.set(true);
  }

  dadosIniciaisParaGerador(): Partial<DadosCaracterizacao> {
    return {
      denominacao: this.novoBuildingName(),
      endereco: this.novoAddress(),
      tipoUso: this.novoTipoUso(),
      areaConstruida: this.novaAreaConstruida(),
      numeroPavimentos: this.novoNumeroPavimentos(),
      anoConstrucao: this.novaIdadeEdificacao(),
      sistemaEstrutural: this.novoSistemaEstruturalPredominante(),
      sistemaFundacao: this.novoSistemaFundacao(),
      memorialDescritivo: this.novoMemoriaDescritivo(),
      mapaBase64: this.novaMapaImagemBase64() ?? undefined,
      fotos: this.novoFotosGerais(),
      lat: this.novoLat() ?? undefined,
      lng: this.novoLng() ?? undefined
    };
  }

  aplicarDadosDoGerador(dados: DadosCaracterizacao): void {
    if (dados.denominacao) this.novoBuildingName.set(dados.denominacao);
    if (dados.endereco) this.novoAddress.set(dados.endereco);
    if (dados.tipoUso) this.novoTipoUso.set(dados.tipoUso);
    if (dados.areaConstruida) this.novaAreaConstruida.set(dados.areaConstruida);
    if (dados.numeroPavimentos) this.novoNumeroPavimentos.set(dados.numeroPavimentos);
    if (dados.anoConstrucao) this.novaIdadeEdificacao.set(dados.anoConstrucao);
    if (dados.sistemaEstrutural) this.novoSistemaEstruturalPredominante.set(dados.sistemaEstrutural);
    if (dados.sistemaFundacao) this.novoSistemaFundacao.set(dados.sistemaFundacao);
    if (dados.memorialDescritivo) this.novoMemoriaDescritivo.set(dados.memorialDescritivo);
    if (dados.mapaBase64) this.novaMapaImagemBase64.set(dados.mapaBase64);
    if (dados.lat !== undefined && dados.lat !== null) this.novoLat.set(dados.lat);
    if (dados.lng !== undefined && dados.lng !== null) this.novoLng.set(dados.lng);
    if (dados.fotos && dados.fotos.length > 0) {
      this.novoFotosGerais.set([...dados.fotos]);
    }
    this.isGeradorCaracterizacaoOpen.set(false);
    this.toastService.show('Dados e mapa da caracterização aplicados com sucesso!', 'success');
  }

  private resolverOcorrenciaEmEdicao(item: ChecklistItem): FichaDano | null {
    if (this.itemDaFichaEmEdicaoId() === item.id && this.fichaEmEdicaoId()) {
      return item.ocorrencias?.find(f => f.id === this.fichaEmEdicaoId()) ?? null;
    }
    return null;
  }

  obterOuCriarOcorrenciaAtiva(item: ChecklistItem): FichaDano {
    if (!item.ocorrencias) {
      item.ocorrencias = [];
    }
    const emEdicao = this.resolverOcorrenciaEmEdicao(item);
    if (emEdicao) return emEdicao;

    if (item.ocorrencias.length === 0) {
      const ativa = this.vistoriaAtiva();
      const proximoNumero = (ativa?.contadorFichas ?? 0) + 1;
      if (ativa) {
        ativa.contadorFichas = proximoNumero;
      }
      const nova: FichaDano = {
        id: 'ficha-' + crypto.randomUUID(),
        numeroFicha: proximoNumero,
        notes: '',
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString()
      };
      item.ocorrencias.push(nova);
    }
    return item.ocorrencias[0];
  }

  obterOcorrenciaAtiva(item: ChecklistItem): FichaDano {
    const emEdicao = this.resolverOcorrenciaEmEdicao(item);
    if (emEdicao) return emEdicao;
    return item.ocorrencias?.[0] ?? {
      id: '',
      numeroFicha: 0,
      notes: '',
      dateCreated: '',
      dateUpdated: ''
    } as FichaDano;
  }

  criarNovaOcorrencia(itemId: string): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const novosItens = ativa.items.map(item => {
      if (item.id !== itemId) return item;
      const itemAtualizado = { ...item, ocorrencias: [...(item.ocorrencias ?? [])] };
      ativa.contadorFichas = (ativa.contadorFichas ?? 0) + 1;
      const nova: FichaDano = {
        id: 'ficha-' + crypto.randomUUID(),
        numeroFicha: ativa.contadorFichas,
        notes: '',
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
      };
      itemAtualizado.ocorrencias.push(nova);
      itemAtualizado.status = 'NAO_CONFORME';  // regra: 1+ ocorrência força NAO_CONFORME sempre
      this.fichaEmEdicaoId.set(nova.id);
      this.itemDaFichaEmEdicaoId.set(itemId);
      return itemAtualizado;
    });

    this.atualizarItensVistoriaAtiva(novosItens);
  }

  excluirOcorrencia(itemId: string, fichaId: string): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const novosItens = ativa.items.map(item => {
      if (item.id !== itemId) return item;
      const ocorrenciasRestantes = (item.ocorrencias ?? []).filter(f => f.id !== fichaId);
      const itemAtualizado = { ...item, ocorrencias: ocorrenciasRestantes };
      // Se não sobrou nenhuma ocorrência, o status volta a ser decidido manualmente pelo RT (PENDENTE)
      if (ocorrenciasRestantes.length === 0) {
        itemAtualizado.status = 'PENDENTE';
      }
      return itemAtualizado;
    });

    this.atualizarItensVistoriaAtiva(novosItens);
    if (this.fichaEmEdicaoId() === fichaId) {
      this.fichaEmEdicaoId.set(null);
      this.itemDaFichaEmEdicaoId.set(null);
    }
  }

  solicitarExclusaoOcorrencia(itemId: string, fichaId: string): void {
    if (this.fichaPendenteConfirmacaoExclusao() === fichaId) {
      this.excluirOcorrencia(itemId, fichaId);
      this.fichaPendenteConfirmacaoExclusao.set(null);
    } else {
      this.fichaPendenteConfirmacaoExclusao.set(fichaId);
      setTimeout(() => {
        if (this.fichaPendenteConfirmacaoExclusao() === fichaId) {
          this.fichaPendenteConfirmacaoExclusao.set(null);
        }
      }, 3000);
    }
  }

  salvarCamposBasicosFicha(itemId: string, fichaId: string, pavimento: string, ambiente: string): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const novosItens = ativa.items.map(item => {
      if (item.id !== itemId) return item;
      const ocorrenciasAtualizadas = (item.ocorrencias ?? []).map(f =>
        f.id === fichaId ? { ...f, pavimento, ambiente, dateUpdated: new Date().toISOString() } : f
      );
      return { ...item, ocorrencias: ocorrenciasAtualizadas };
    });

    this.atualizarItensVistoriaAtiva(novosItens);
  }

  salvarCamposDiagnosticoFicha(
    itemId: string,
    fichaId: string,
    campos: Partial<{
      classificacaoTipo: 'ANOMALIA' | 'FALHA' | 'INDETERMINADO';
      classificacaoSubtipo: string;
      manifestacao: string;
      causaProvavel: string;
      recomendacaoTecnica: string;
      criticidade: 'P1' | 'P2' | 'P3' | '';
    }>
  ): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const novosItens = ativa.items.map(item => {
      if (item.id !== itemId) return item;
      const ocorrenciasAtualizadas = (item.ocorrencias ?? []).map(f => {
        if (f.id === fichaId) {
          const novoTipo = 'classificacaoTipo' in campos ? campos.classificacaoTipo : (f.classificacao?.tipo ?? 'INDETERMINADO');
          const novoSubtipo = 'classificacaoSubtipo' in campos ? campos.classificacaoSubtipo : f.classificacao?.subtipo;
          
          return {
            ...f,
            classificacao: { tipo: novoTipo as any, subtipo: novoSubtipo },
            manifestacao: 'manifestacao' in campos ? campos.manifestacao : f.manifestacao,
            causaProvavel: 'causaProvavel' in campos ? campos.causaProvavel : f.causaProvavel,
            recomendacaoTecnica: 'recomendacaoTecnica' in campos ? campos.recomendacaoTecnica : f.recomendacaoTecnica,
            criticidade: 'criticidade' in campos ? (campos.criticidade || undefined) as any : f.criticidade,
            dateUpdated: new Date().toISOString()
          };
        }
        return f;
      });
      return { ...item, ocorrencias: ocorrenciasAtualizadas };
    });

    this.atualizarItensVistoriaAtiva(novosItens);
  }

  onNivelInspecaoChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as '1' | '2' | '3';
    this.novoNivelInspecao.set(val);
    this.novoNivelInspecaoMetodologia.set(METODOLOGIA_NIVEL[val] || '');
    this.novoNivelInspecaoJustificativa.set(JUSTIFICATIVA_NIVEL[val] || '');
  }

  // Filtros de visualização
  filtroStatus = signal<'TODOS' | 'PENDENTE' | 'PASS' | 'FAIL' | 'NA'>('TODOS');
  filtroSistema = signal<string>('TODOS');

  // Anamnese guided form signals & computed
  novaConstatacaoTipo = signal<TipoConstatacao>('RELATO_OCUPANTE');
  novaConstatacaoDescricao = signal('');
  novaConstatacaoNome = signal('');
  novaConstatacaoIdentificacao = signal('');
  novaConstatacaoData = signal('');
  novaConstatacaoFonte = signal('');
  constatacaoPendenteConfirmacaoExclusao = signal<string | null>(null);

  metaConstatacao(t: TipoConstatacao) {
    return CONSTATACAO_META[t];
  }

  constatacoesLista = computed<Constatacao[]>(() => {
    const c = this.vistoriaAtiva()?.anamnese?.constatacoes;
    return Array.isArray(c) ? c : [];
  });

  fichasAtivas = computed<{ item: ChecklistItem; f: FichaDano }[]>(() => {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return [];
    const res: { item: ChecklistItem; f: FichaDano }[] = [];
    (ativa.items ?? []).forEach(item => {
      (item.ocorrencias ?? []).forEach(f => res.push({ item, f }));
    });
    return res;
  });

  contagemCriticidadeP1 = computed(() => this.fichasAtivas().filter(x => x.f.criticidade === 'P1').length);
  contagemCriticidadeP2 = computed(() => this.fichasAtivas().filter(x => x.f.criticidade === 'P2').length);
  contagemCriticidadeP3 = computed(() => this.fichasAtivas().filter(x => x.f.criticidade === 'P3').length);
  contagemCriticidadeTotal = computed(() => this.fichasAtivas().length);

  // Modo de visualização: 'LISTA' (gerenciar vistorias) ou 'EXECUCAO' (inspecionando no local) ou 'CRIACAO' (configurando nova)
  modoExibicao = signal<'LISTA' | 'CRIACAO' | 'EXECUCAO' | 'EDICAO' | 'NORTEADORES' | 'ANAMNESE' | 'DETALHE_LAUDO' | 'AVALIACAO_MANUTENCAO' | 'AVALIACAO_CRITICIDADE' | 'CONCLUSOES' | 'ANEXO_ART'>('LISTA');
  vistoriaEmEdicao = signal<Vistoria | null>(null);
  laudoSelecionado = signal<LaudoEmitido | null>(null);
  exibirModalPreEmissao = signal<boolean>(false);
  exibirModalImpedimentos = signal<boolean>(false);
  impedimentosEmissao = signal<string[]>([]);
  novoAvaliacaoManutencaoTexto = signal<string>('');
  novoAvaliacaoCriticidadeTexto = signal<string>('');
  novoConclusaoSinteseTexto = signal<string>('');
  novoConclusaoRiscosTexto = signal<string>('');
  novoConclusaoRecomendacoesTexto = signal<string>('');
  novoConclusaoConsideracoesTexto = signal<string>('');

  // Carregar os sistemas organizados da base de dados estática
  sistemasDisponiveis = computed(() => {
    const data = this.dataService.getData();
    return Object.entries(data).map(([catKey, catVal]: [string, any]) => ({
      key: catKey,
      title: catVal.title,
      subSystems: Object.entries(catVal.systems).map(([sysKey, sysVal]: [string, any]) => ({
        key: sysKey,
        title: sysVal.title,
        icon: sysVal.icon || '📋',
        typologies: sysVal.tipologias.map((t: any) => {
          // Achar patologias relacionadas a essa tipologia
          const patologiasRelacionadas = (sysVal.patologias || []).filter(
            (p: any) => p.typology_link === t.title
          );
          return {
            title: t.title,
            definicao: t.definicao,
            patologiasCount: patologiasRelacionadas.length,
            patologias: patologiasRelacionadas,
          };
        }),
      })),
    }));
  });

  // Filtro de sistemas na execução do checklist
  sistemasNoChecklistAtivo = computed(() => {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return [];
    const nomes = new Set<string>();
    ativa.items.forEach(item => nomes.add(item.systemTitle));
    return Array.from(nomes);
  });

  // Itens filtrados para exibição
  itemsExibidos = computed(() => {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return [];

    const fStatus = this.filtroStatus();
    const fSistema = this.filtroSistema();

    return ativa.items.filter(item => {
      const matchSistema = fSistema === 'TODOS' || item.systemTitle === fSistema;
      
      let matchStatus = true;
      const currentStatus = item.status === 'CONFORME' ? 'PASS' : 
                            item.status === 'NAO_CONFORME' ? 'FAIL' : 
                            item.status === 'NAO_APLICAVEL' ? 'NA' : item.status;

      if (fStatus === 'PENDENTE') matchStatus = currentStatus === 'PENDENTE';
      else if (fStatus === 'PASS') matchStatus = currentStatus === 'PASS';
      else if (fStatus === 'FAIL') matchStatus = currentStatus === 'FAIL';
      else if (fStatus === 'NA') matchStatus = currentStatus === 'NA';

      return matchSistema && matchStatus;
    });
  });

  calcularEstatisticas(vistoria: Vistoria | null) {
    if (!vistoria) return { total: 0, avaliados: 0, conformes: 0, naoConformes: 0, naoAplicaveis: 0, pendentes: 0, percentualConclusao: 0, taxaConformidade: 0 };

    const total = vistoria.items.length;
    const conformes = vistoria.items.filter(i => i.status === 'PASS' || i.status === 'CONFORME').length;
    const naoConformes = vistoria.items.filter(i => i.status === 'FAIL' || i.status === 'NAO_CONFORME').length;
    const naoAplicaveis = vistoria.items.filter(i => i.status === 'NA' || i.status === 'NAO_APLICAVEL').length;
    const pendentes = vistoria.items.filter(i => i.status === 'PENDENTE').length;
    const avaliados = total - pendentes;

    const percentualConclusao = total > 0 ? Math.round((avaliados / total) * 100) : 0;
    const avaliadosComStatusReal = conformes + naoConformes;
    const taxaConformidade = avaliadosComStatusReal > 0 ? Math.round((conformes / avaliadosComStatusReal) * 100) : 0;

    return { total, avaliados, conformes, naoConformes, naoAplicaveis, pendentes, percentualConclusao, taxaConformidade };
  }

  // Estatísticas de conformidade da vistoria ativa
  estatisticasAtivas = computed(() => this.calcularEstatisticas(this.vistoriaAtiva()));

  ngOnInit(): void {
    void this.carregarVistorias();
    this.carregarPerfilDoLocalStorage();
    void this.carregarLaudosEmitidos();
  }

  ngOnDestroy(): void {
    this.limparUrlsAnexos();
  }

  carregarPerfilDoLocalStorage(): void {
    try {
      const saved = localStorage.getItem('user_profile');
      if (saved) {
        this.userProfile.set(JSON.parse(saved));
      } else {
        // Usar padrão caso não ache
        this.userProfile.set({
          fullName: 'Emanoel Amorim',
          professionalTitle: 'Arquiteto e Urbanista',
          professionalId: 'CAU-PE 123456',
          companyName: 'AmorimTech',
          position: 'Diretor de Engenharia',
          companyCnpj: '12.345.678/0001-90',
          companyAddress: 'Recife - PE, Brasil',
        });
      }
    } catch (e) {
      console.error('Erro ao carregar perfil do localStorage', e);
    }
  }

  async carregarVistorias(): Promise<void> {
    this.carregandoVistorias.set(true);
    try {
      await this.dbService.migrarDoLocalStorageSeNecessario();
      const lista = await this.dbService.getAllVistorias();
      
      let mudouQualquerCoisa = false;
      // Mapear dados antigos e severidades ao formato canônico do Bloco 2a (ocorrencias / FichaDano)
      lista.forEach(v => {
        if (v.items) {
          v.items.forEach(item => {
            // Se o item não possui ocorrencias, inicializa e migra campos legados
            if (!item.ocorrencias) {
              item.ocorrencias = [];
              mudouQualquerCoisa = true;
            }
            const legacyItem = item as any;
            if (item.ocorrencias.length === 0) {
              if (
                legacyItem.notes !== undefined ||
                legacyItem.severity !== undefined ||
                legacyItem.id_evidencias !== undefined ||
                legacyItem.diagnostico_ia !== undefined ||
                legacyItem.quantitativo !== undefined ||
                legacyItem.memorialDescritivo !== undefined ||
                legacyItem.correlacaoFotoPatologia !== undefined ||
                legacyItem.observacaoDivergencia !== undefined ||
                legacyItem.composicoesAplicadas !== undefined
              ) {
                item.ocorrencias.push({
                  id: 'ficha-' + crypto.randomUUID(),
                  numeroFicha: 1,
                  notes: legacyItem.notes ?? '',
                  severity: legacyItem.severity,
                  id_evidencias: legacyItem.id_evidencias,
                  diagnostico_ia: legacyItem.diagnostico_ia,
                  quantitativo: legacyItem.quantitativo,
                  memorialDescritivo: legacyItem.memorialDescritivo,
                  correlacaoFotoPatologia: legacyItem.correlacaoFotoPatologia,
                  observacaoDivergencia: legacyItem.observacaoDivergencia,
                  composicoesAplicadas: legacyItem.composicoesAplicadas,
                  dateCreated: v.dateCreated,
                  dateUpdated: v.dateUpdated
                });
                
                mudouQualquerCoisa = true;

                // Limpa campos antigos
                delete legacyItem.notes;
                delete legacyItem.severity;
                delete legacyItem.id_evidencias;
                delete legacyItem.diagnostico_ia;
                delete legacyItem.quantitativo;
                delete legacyItem.memorialDescritivo;
                delete legacyItem.correlacaoFotoPatologia;
                delete legacyItem.observacaoDivergencia;
                delete legacyItem.composicoesAplicadas;
              }
            }
            
            // Normalizar severidades dentro da ficha ativa
            if (item.ocorrencias.length > 0) {
              const oc = item.ocorrencias[0];
              if (oc.severity) {
                const s = String(oc.severity).toUpperCase();
                let novaSev = oc.severity;
                if (s === 'MÍNIMA' || s === 'MINIMA') novaSev = 'Mínimo';
                else if (s === 'MÉDIA' || s === 'MEDIA') novaSev = 'Regular';
                else if (s === 'GRAVE') novaSev = 'Crítico';

                if (novaSev !== oc.severity) {
                  oc.severity = novaSev;
                  mudouQualquerCoisa = true;
                }
              }
            }
          });
        }
      });

      if (mudouQualquerCoisa) {
        await this.dbService.saveAllVistorias(lista);
      }

      // Ordenar por última atualização
      lista.sort((a, b) => new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime());
      this.vistorias.set(lista);
    } catch (e) {
      console.error('Erro ao carregar vistorias do IndexedDB', e);
      this.toastService.show('Não foi possível carregar as vistorias salvas.', 'error');
    } finally {
      this.carregandoVistorias.set(false);
    }
  }

  async salvarVistorias(lista: Vistoria[]): Promise<void> {
    try {
      await this.dbService.saveAllVistorias(lista);
      this.vistorias.set(lista);
    } catch (e) {
      console.error('Erro ao salvar vistorias no IndexedDB', e);
      this.toastService.show('Erro ao salvar o progresso no IndexedDB.', 'error');
    }
  }

  private notesSaveTimer: any = null;
  private persistirComDebounce(lista: Vistoria[]): void {
    if (this.notesSaveTimer) clearTimeout(this.notesSaveTimer);
    this.notesSaveTimer = setTimeout(() => { void this.salvarVistorias(lista); }, 500);
  }

  abrirCriacao(): void {
    this.novoBuildingName.set('');
    this.novoAddress.set('');
    this.novaAreaConstruida.set('');
    this.novaIdadeEdificacao.set('');
    this.novoMemoriaDescritivo.set('');
    this.novoArtRrt.set('');
    this.novaMapaImagemBase64.set(null);
    this.novoFotosGerais.set([]);
    this.novoTipoUso.set('');
    this.novoContratanteCnpj.set('');
    this.novoContratanteRazaoSocial.set('');
    this.novoLat.set(null);
    this.novoLng.set(null);
    this.novoGpsAccuracy.set(null);
    this.selecaoSistemas.set({});
    
    // Novos campos do Bloco 2a
    this.novoSolicitanteEndereco.set('');
    this.novoResponsavelLegalNome.set('');
    this.novoResponsavelLegalDocumento.set('');
    this.novoPadraoAcabamento.set('Normal');
    this.novoNumeroPavimentos.set('');
    this.novoSistemaEstruturalPredominante.set('');
    this.novoSistemaFundacao.set('');
    this.novoHorarioFuncionamento.set('');
    this.novoNivelInspecao.set('1');
    this.novoNivelInspecaoMetodologia.set(METODOLOGIA_NIVEL['1']);
    this.novoNivelInspecaoJustificativa.set(JUSTIFICATIVA_NIVEL['1']);
    this.novoExibirGlossario.set(true);

    this.modoExibicao.set('CRIACAO');
    // Captura GPS em background — pronto antes de o RT terminar de preencher o formulário
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.novoLat.set(pos.coords.latitude);
          this.novoLng.set(pos.coords.longitude);
          this.novoGpsAccuracy.set(pos.coords.accuracy ?? null);
        },
        () => { /* GPS indisponível — campos ficam null */ },
        { timeout: 10000, maximumAge: 30000 }
      );
    }
  }

  cancelarCriacao(): void {
    this.modoExibicao.set('LISTA');
  }

  editarVistoria(event: Event, vistoria: Vistoria): void {
    event.stopPropagation();
    this.vistoriaEmEdicao.set(vistoria);
    this.novoMemoriaDescritivo.set(vistoria.memoriaDescritivo ?? vistoria.objetoNatureza ?? '');
    this.novaAreaConstruida.set(vistoria.areaConstruida ?? '');
    this.novaIdadeEdificacao.set(vistoria.idadeEdificacao ?? '');
    this.novoArtRrt.set(vistoria.artRrtNumero ?? '');
    this.novaMapaImagemBase64.set(vistoria.mapaImagemBase64 ?? null);
    this.novoFotosGerais.set(vistoria.fotosGerais ? [...vistoria.fotosGerais] : []);
    this.novoTipoUso.set(vistoria.tipoUso ?? '');
    this.novoContratanteCnpj.set(vistoria.contratanteCnpj ?? '');
    this.novoContratanteRazaoSocial.set(vistoria.contratanteRazaoSocial ?? '');

    // Novos campos do Bloco 2a
    this.novoSolicitanteEndereco.set(vistoria.solicitanteEndereco ?? '');
    this.novoResponsavelLegalNome.set(vistoria.responsavelLegalNome ?? '');
    this.novoResponsavelLegalDocumento.set(vistoria.responsavelLegalDocumento ?? '');
    this.novoPadraoAcabamento.set(vistoria.padraoAcabamento ?? 'Normal');
    this.novoNumeroPavimentos.set(vistoria.numeroPavimentos ?? '');
    this.novoSistemaEstruturalPredominante.set(vistoria.sistemaEstruturalPredominante ?? '');
    this.novoSistemaFundacao.set(vistoria.sistemaFundacao ?? '');
    this.novoHorarioFuncionamento.set(vistoria.horarioFuncionamento ?? '');
    this.novoNivelInspecao.set(vistoria.nivelInspecao ?? '1');
    this.novoNivelInspecaoMetodologia.set(vistoria.nivelInspecaoMetodologia ?? (vistoria.nivelInspecao ? METODOLOGIA_NIVEL[vistoria.nivelInspecao] : ''));
    this.novoNivelInspecaoJustificativa.set(vistoria.nivelInspecaoJustificativa ?? (vistoria.nivelInspecao ? JUSTIFICATIVA_NIVEL[vistoria.nivelInspecao] : ''));
    this.novoExibirGlossario.set(vistoria.exibirGlossario ?? true);

    this.modoExibicao.set('EDICAO');
  }

  async salvarEdicaoVistoria(): Promise<void> {
    const vistoria = this.vistoriaEmEdicao();
    if (!vistoria) return;
    const atualizada: Vistoria = {
      ...vistoria,
      memoriaDescritivo: this.novoMemoriaDescritivo().trim() || undefined,
      areaConstruida: this.novaAreaConstruida().trim() || undefined,
      idadeEdificacao: this.novaIdadeEdificacao().trim() || undefined,
      artRrtNumero: this.novoArtRrt().trim() || undefined,
      mapaImagemBase64: this.novaMapaImagemBase64() ?? undefined,
      fotosGerais: this.novoFotosGerais().length > 0 ? [...this.novoFotosGerais()] : undefined,
      tipoUso: this.novoTipoUso() || undefined,
      contratanteCnpj: this.novoContratanteCnpj().trim() || undefined,
      contratanteRazaoSocial: this.novoContratanteRazaoSocial().trim() || undefined,

      // Novos campos do Bloco 2a
      solicitanteEndereco: this.novoSolicitanteEndereco().trim() || undefined,
      responsavelLegalNome: this.novoResponsavelLegalNome().trim() || undefined,
      responsavelLegalDocumento: this.novoResponsavelLegalDocumento().trim() || undefined,
      padraoAcabamento: this.novoPadraoAcabamento(),
      numeroPavimentos: this.novoNumeroPavimentos().trim() || undefined,
      sistemaEstruturalPredominante: this.novoSistemaEstruturalPredominante().trim() || undefined,
      sistemaFundacao: this.novoSistemaFundacao().trim() || undefined,
      horarioFuncionamento: this.novoHorarioFuncionamento().trim() || undefined,
      nivelInspecao: this.novoNivelInspecao(),
      nivelInspecaoMetodologia: this.novoNivelInspecaoMetodologia().trim() || undefined,
      nivelInspecaoJustificativa: this.novoNivelInspecaoJustificativa().trim() || undefined,
      exibirGlossario: this.novoExibirGlossario(),

      dateUpdated: new Date().toISOString(),
    };
    const lista = this.vistorias().map(v => v.id === atualizada.id ? atualizada : v);
    await this.salvarVistorias(lista);
    this.vistorias.set(lista);
    this.vistoriaEmEdicao.set(null);
    this.modoExibicao.set('LISTA');
    this.toastService.show('Dados do imóvel updated com sucesso.', 'success');
  }

  cancelarEdicao(): void {
    this.vistoriaEmEdicao.set(null);
    this.modoExibicao.set('LISTA');
  }

  toggleTypologySelecao(systemKey: string, typologyTitle: string): void {
    const key = `${systemKey}-${typologyTitle}`;
    this.selecaoSistemas.update(current => {
      const next = { ...current };
      next[key] = !next[key];
      return next;
    });
  }

  selecionarTodosSistemas(): void {
    const data = this.dataService.getData();
    const nextSelection: { [key: string]: boolean } = {};
    
    Object.entries(data).forEach(([catKey, catVal]: [string, any]) => {
      Object.entries(catVal.systems).forEach(([sysKey, sysVal]: [string, any]) => {
        sysVal.tipologias.forEach((t: any) => {
          nextSelection[`${sysKey}-${t.title}`] = true;
        });
      });
    });

    this.selecaoSistemas.set(nextSelection);
    this.toastService.show('Todas as tipologias de sistemas foram selecionadas!', 'success');
  }

  limparSelecaoSistemas(): void {
    this.selecaoSistemas.set({});
    this.toastService.show('Seleção limpa com sucesso.', 'info');
  }

  criarVistoria(): void {
    if (!this.isLoggedIn()) {
      this.toastService.show('Faça login para criar e salvar uma vistoria. Você pode continuar explorando o tour guiado sem login.', 'info');
      return;
    }

    const name = this.novoBuildingName().trim();
    const address = this.novoAddress().trim();

    if (!name || !address) {
      this.toastService.show('Por favor, preencha o Nome do Edifício e o Endereço.', 'error');
      return;
    }

    // Coletar tipologias selecionadas
    const selecionados = Object.entries(this.selecaoSistemas()).filter(([_, val]) => val).map(([key, _]) => key);
    if (selecionados.length === 0) {
      this.toastService.show('Por favor, selecione ao menos uma tipologia para inspecionar.', 'error');
      return;
    }

    const items: ChecklistItem[] = [];
    const data = this.dataService.getData();

    // Mapear os dados para gerar os itens técnicos estruturados
    Object.entries(data).forEach(([catKey, catVal]: [string, any]) => {
      Object.entries(catVal.systems).forEach(([sysKey, sysVal]: [string, any]) => {
        sysVal.tipologias.forEach((t: any) => {
          const selectionKey = `${sysKey}-${t.title}`;
          if (this.selecaoSistemas()[selectionKey]) {
            // 1. Criar item básico de integridade geral para essa tipologia
            items.push({
              id: `${sysKey}-${t.title.replace(/\s+/g, '_')}-geral`,
              systemTitle: sysVal.title,
              typologyTitle: t.title,
              title: `Inspeção Geral de Integridade`,
              description: `Realizar varredura visual em busca de deformações, anomalias de acabamento ou fissuras superficiais na tecnologia: ${t.title}.`,
              status: 'PENDENTE',
              ocorrencias: []
            });

            // 2. Criar itens específicos para cada patologia cadastrada nesta tipologia
            const patologiasRelacionadas = (sysVal.patologias || []).filter(
              (p: any) => p.typology_link === t.title
            );

            patologiasRelacionadas.forEach((p: any, idx: number) => {
              items.push({
                id: `${sysKey}-${t.title.replace(/\s+/g, '_')}-pat-${idx}`,
                systemTitle: sysVal.title,
                typologyTitle: t.title,
                title: `Investigar: ${p.title}`,
                description: `Avaliar se há ocorrência de ${p.title}. Sintomas de alerta: ${p.sintomas}. Causas prováveis na vistoria: ${p.causas}.`,
                status: 'PENDENTE',
                ocorrencias: []
              });
            });
          }
        });
      });
    });

    const novaVistoria: Vistoria = {
      id: 'vistoria-' + Date.now(),
      buildingName: name,
      address: address,
      areaConstruida: this.novaAreaConstruida().trim() || undefined,
      idadeEdificacao: this.novaIdadeEdificacao().trim() || undefined,
      lat: this.novoLat() ?? undefined,
      lng: this.novoLng() ?? undefined,
      gpsAccuracy: this.novoGpsAccuracy() ?? undefined,
      memoriaDescritivo: this.novoMemoriaDescritivo().trim() || undefined,
      artRrtNumero: this.novoArtRrt().trim() || undefined,
      mapaImagemBase64: this.novaMapaImagemBase64() ?? undefined,
      fotosGerais: this.novoFotosGerais().length > 0 ? this.novoFotosGerais() : undefined,
      tipoUso: this.novoTipoUso() || undefined,
      contratanteCnpj: this.novoContratanteCnpj().trim() || undefined,
      contratanteRazaoSocial: this.novoContratanteRazaoSocial().trim() || undefined,

      // Novos campos do Bloco 2a
      solicitanteEndereco: this.novoSolicitanteEndereco().trim() || undefined,
      responsavelLegalNome: this.novoResponsavelLegalNome().trim() || undefined,
      responsavelLegalDocumento: this.novoResponsavelLegalDocumento().trim() || undefined,
      padraoAcabamento: this.novoPadraoAcabamento(),
      numeroPavimentos: this.novoNumeroPavimentos().trim() || undefined,
      sistemaEstruturalPredominante: this.novoSistemaEstruturalPredominante().trim() || undefined,
      sistemaFundacao: this.novoSistemaFundacao().trim() || undefined,
      horarioFuncionamento: this.novoHorarioFuncionamento().trim() || undefined,
      nivelInspecao: this.novoNivelInspecao(),
      nivelInspecaoMetodologia: this.novoNivelInspecaoMetodologia().trim() || undefined,
      nivelInspecaoJustificativa: this.novoNivelInspecaoJustificativa().trim() || undefined,
      exibirGlossario: this.novoExibirGlossario(),

      contadorFichas: 0,
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      progress: 0,
      items: items
    };

    const atualizadas = [novaVistoria, ...this.vistorias()];
    void this.salvarVistorias(atualizadas);
    this.vistoriaAtiva.set(novaVistoria);
    this.modoExibicao.set('EXECUCAO');
    this.filtroStatus.set('TODOS');
    this.filtroSistema.set('TODOS');
    this.toastService.show('Vistoria iniciada! Prancheta de campo gerada com sucesso.', 'success');
  }

  abrirVistoria(vistoria: Vistoria): void {
    // Carregar do array para garantir dados frescos
    const encontrada = this.vistorias().find(v => v.id === vistoria.id);
    if (encontrada) {
      this.vistoriaAtiva.set(encontrada);
      this.modoExibicao.set('EXECUCAO');
      this.filtroStatus.set('TODOS');
      this.filtroSistema.set('TODOS');
      this.toastService.show(`Retomando vistoria do ${encontrada.buildingName}`, 'info');
    }
  }

  excluirVistoria(event: Event, id: string): void {
    event.stopPropagation();
    const vistoria = this.vistorias().find(v => v.id === id);
    if (vistoria) {
      this.vistoriaParaExcluir.set(vistoria);
    }
  }

  cancelarExclusao(): void {
    this.vistoriaParaExcluir.set(null);
  }

  async confirmarExclusao(): Promise<void> {
    const alvo = this.vistoriaParaExcluir();
    if (!alvo) return;
    try {
      await this.dbService.deleteVistoria(alvo.id);            // 1) DB primeiro
    } catch (e) {
      console.error('Erro ao excluir vistoria do IndexedDB', e);
      this.toastService.show('Erro ao excluir vistoria do banco de dados.', 'error');
      return;                                                   // aborta sem mexer na lista
    }
    // 2) só após o sucesso, sincroniza memória/UI
    this.vistorias.set(this.vistorias().filter(v => v.id !== alvo.id));
    if (this.vistoriaAtiva()?.id === alvo.id) {
      this.vistoriaAtiva.set(null);
      this.modoExibicao.set('LISTA');
    }
    this.vistoriaParaExcluir.set(null);
    this.toastService.show('Vistoria excluída com sucesso.', 'success');
  }

  alterarStatusItem(itemId: string, novoStatus: 'PASS' | 'NA'): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    let temOcorrencias = false;

    const novosItens = ativa.items.map(item => {
      if (item.id === itemId) {
        if (item.ocorrencias && item.ocorrencias.length > 0) {
          temOcorrencias = true;
          return item;
        }
        const itemAtualizado = { ...item, status: novoStatus };
        const oc = this.obterOuCriarOcorrenciaAtiva(itemAtualizado);
        delete oc.severity;
        return itemAtualizado;
      }
      return item;
    });

    if (temOcorrencias) {
      this.toastService.show('Remova as ocorrências registradas para reclassificar este item.', 'info');
      return;
    }

    this.atualizarItensVistoriaAtiva(novosItens);
    this.sinalizarSalvo(itemId);
  }

  alterarGravidadeItem(itemId: string, novaGravidade: 'Mínimo' | 'Regular' | 'Crítico'): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const novosItens = ativa.items.map(item => {
      if (item.id === itemId && (item.status === 'FAIL' || item.status === 'NAO_CONFORME')) {
        const itemAtualizado = { ...item };
        const oc = this.obterOuCriarOcorrenciaAtiva(itemAtualizado);
        oc.severity = novaGravidade;
        return itemAtualizado;
      }
      return item;
    });

    this.atualizarItensVistoriaAtiva(novosItens);
    this.sinalizarSalvo(itemId);
  }

  async abrirCaptura(item: ChecklistItem, tipo: 'contexto'|'detalhe'): Promise<void> {
    this.tipoEvidencia.set(tipo);
    this.itemCapturandoEvidencia.set(item);
    this.cameraIndisponivel.set(false);
    try {
      const stream = await this.camera.iniciar(true);
      this.streamCamera.set(stream);
    } catch (e) {
      console.error('Erro ao abrir câmera', e);
      this.cameraIndisponivel.set(true);
      this.toastService.show('Câmera indisponível. Utilize a seleção de arquivos para anexar a evidência.', 'info');
    }
  }

  fecharCaptura(): void {
    this.camera.parar();
    this.streamCamera.set(null);
    this.itemCapturandoEvidencia.set(null);
    this.capturando.set(false);
    this.analisandoIa.set(false);
    this.cameraIndisponivel.set(false);
    this.dragOver.set(false);
  }

  async processarArquivoSelecionado(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      this.toastService.show('Por favor, selecione um arquivo de imagem válido.', 'error');
      return;
    }

    const item = this.itemCapturandoEvidencia();
    if (!item) return;

    this.capturando.set(true);

    try {
      const blob = new Blob([file], { type: file.type });
      const geo = await this.camera.obterLocalizacao();
      const idEvidencia = crypto.randomUUID();

      const ev: Evidencia = {
        id: idEvidencia,
        blob,
        mimeType: file.type,
        tipo: this.tipoEvidencia(),
        geo,
        timestamp: new Date().toISOString(),
        id_item: item.id
      };

      await this.dbService.saveEvidencia(ev);

      this.aplicarMudancaNoItem(item.id, it => {
        const oc = this.obterOuCriarOcorrenciaAtiva(it);
        oc.id_evidencias = [...(oc.id_evidencias ?? []), idEvidencia];
        return it;
      });

      this.capturando.set(false);
      this.analisandoIa.set(true);

      const imagens = await this.obterImagensParaAnalise(item, blob, file.type);
      const diag = await this.analisarComGemini(item, imagens);

      if (diag?.texto) {
        this.aplicarMudancaNoItem(item.id, it => {
          const oc = this.obterOuCriarOcorrenciaAtiva(it);
          oc.falhaAnaliseIa = false;
          oc.diagnostico_ia = diag.texto;
          oc.correlacaoFotoPatologia = diag.correlacaoFotoPatologia;
          oc.observacaoDivergencia = diag.observacaoDivergencia;

          if (diag.correlacaoFotoPatologia === 'CONFIRMADA') {
            oc.sugestaoIaPendente = {
              classificacaoTipo: diag.classificacaoTipo,
              classificacaoSubtipo: diag.classificacaoSubtipo,
              manifestacao: diag.manifestacao,
              causaProvavel: diag.causaProvavel,
              recomendacaoTecnica: diag.recomendacaoTecnica,
              severitySugerida: diag.severitySugerida,
            };
          }
          return it;
        });
      } else {
        this.aplicarMudancaNoItem(item.id, it => {
          const oc = this.obterOuCriarOcorrenciaAtiva(it);
          oc.falhaAnaliseIa = true;
          return it;
        });
      }
    } catch (e) {
      console.error('Falha no processamento do arquivo/análise', e);
      this.toastService.show('Falha ao processar arquivo ou analisar evidência.', 'error');
      this.aplicarMudancaNoItem(item.id, it => {
        const oc = this.obterOuCriarOcorrenciaAtiva(it);
        oc.falhaAnaliseIa = true;
        return it;
      });
    } finally {
      this.analisandoIa.set(false);
      this.fecharCaptura();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.processarArquivoSelecionado(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      void this.processarArquivoSelecionado(event.dataTransfer.files[0]);
    }
  }

  private comprimirImagem(dataUrl: string, maxWidth = 900, quality = 0.78): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async onFotoGeralChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const atuais = this.novoFotosGerais();
    const max = 4;
    const restante = max - atuais.length;
    if (restante <= 0) {
      this.toastService.show('Máximo de 4 fotos gerais atingido.', 'info');
      return;
    }
    for (const file of files.slice(0, restante)) {
      if (!file.type.startsWith('image/')) continue;
      await new Promise<void>(res => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          const compressed = await this.comprimirImagem(dataUrl, 900, 0.78);
          this.novoFotosGerais.update(arr => [
            ...arr,
            { dataUrl: compressed, timestamp: new Date().toISOString() }
          ]);
          res();
        };
        reader.readAsDataURL(file);
      });
    }
    input.value = '';
  }

  removerFotoGeral(index: number): void {
    this.novoFotosGerais.update(arr => arr.filter((_, i) => i !== index));
  }

  onMapaImagemChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.novaMapaImagemBase64.set(result); // guarda data URL completo (inclui prefixo data:image/...)
    };
    reader.readAsDataURL(file);
  }

  private aplicarMudancaNoItem(itemId: string, updater: (item: ChecklistItem) => ChecklistItem): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const novosItens = ativa.items.map(item => {
      if (item.id === itemId) {
        return updater(item);
      }
      return item;
    });

    this.atualizarItensVistoriaAtiva(novosItens, false);
    this.sinalizarSalvo(itemId);
  }

  private async blobParaBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async obterImagensParaAnalise(
    item: ChecklistItem,
    blobNovo?: Blob,
    mimeTypeNovo = 'image/jpeg'
  ): Promise<{ base64: string; mimeType: string }[]> {
    const itemAtual = this.vistoriaAtiva()?.items.find(it => it.id === item.id);
    const oc = itemAtual ? this.obterOcorrenciaAtiva(itemAtual) : null;
    const ids = oc?.id_evidencias ?? [];
    const imagens: { base64: string; mimeType: string }[] = [];

    for (const id of ids) {
      const ev = await this.dbService.getEvidencia(id);
      if (ev) {
        const base64 = await this.blobParaBase64(ev.blob);
        imagens.push({ base64, mimeType: ev.mimeType || 'image/jpeg' });
      }
    }

    if (imagens.length === 0 && blobNovo) {
      const base64 = await this.blobParaBase64(blobNovo);
      imagens.push({ base64, mimeType: mimeTypeNovo });
    }

    return imagens;
  }

  private async analisarComGemini(
    item: ChecklistItem,
    imagens: { base64: string; mimeType: string }[]
  ): Promise<{ texto: string; severitySugerida?: 'Mínimo' | 'Regular' | 'Crítico';
            correlacaoFotoPatologia?: 'CONFIRMADA' | 'DIVERGENTE' | 'INCONCLUSIVA';
            observacaoDivergencia?: string;
            classificacaoTipo?: string;
            classificacaoSubtipo?: string;
            manifestacao?: string;
            causaProvavel?: string;
            recomendacaoTecnica?: string; } | null> {
    try {
      const prompt = `Você é um engenheiro civil perito especializado em inspeção predial de acordo com a NBR 16747.
  ${imagens.length > 1 ? 'Anexamos ' + imagens.length + ' fotos de evidência (contexto e/ou detalhe)' : 'Uma foto de evidência foi anexada'} ao seguinte item de checklist marcado como não conforme:
  - Sistema: ${item.systemTitle}
  - Tipologia: ${item.typologyTitle}
  - Item: ${item.title}
  - Descrição detalhada: ${item.description}

  PRIMEIRO, avalie se a(s) imagem(ns) de fato retrata(m) a patologia descrita no item acima:
  - Se retrata: correlacaoFotoPatologia = 'CONFIRMADA'. Forneça o diagnóstico técnico da anomalia visível.
  - Se retrata OUTRA patologia ou outro objeto: correlacaoFotoPatologia = 'DIVERGENTE'. Em observacaoDivergencia,
    descreva objetivamente o que a(s) imagem(ns) mostra(m) e por que não corresponde(m) ao item. No campo texto, NÃO invente
    diagnóstico da patologia do item — apenas registre a divergência e recomende novo registro fotográfico.
  - Se a(s) imagem(ns) não permite(m) conclusão (desfocada, escura, enquadramento insuficiente):
    correlacaoFotoPatologia = 'INCONCLUSIVA'.

  Forneça também o grau de risco sugerido conforme a NBR 16747 (estritamente 'Mínimo', 'Regular' ou 'Crítico'),
  baseado APENAS no que é visível e correlacionado — em caso DIVERGENTE ou INCONCLUSIVO, sugira o grau com base
  na descrição do item, sinalizando a limitação no texto.

  Se correlacaoFotoPatologia for 'CONFIRMADA', forneça também, com base estritamente no que é visível na(s) imagem(ns) e no contexto do item:
  - classificacaoTipo: 'ANOMALIA' (perda de desempenho por projeto/execução/vida útil/fatores externos) ou 'FALHA' (perda de desempenho por uso/operação/manutenção) — use 'INDETERMINADO' se não for possível classificar com segurança.
  - classificacaoSubtipo: se ANOMALIA, um de endogena/exogena/natural/funcional; se FALHA, um de planejamento/execucao/operacional/gerencial.
  - manifestacao: descrição objetiva do que se observa na(s) imagem(ns).
  - causaProvavel: hipótese técnica da origem, com base no que é visível.
  - recomendacaoTecnica: ação corretiva recomendada, em linguagem técnica objetiva.
  Se correlacaoFotoPatologia for 'DIVERGENTE' ou 'INCONCLUSIVA', deixe esses 5 campos como string vazia — não invente classificação para foto(s) que não corresponde(m) ao item ou que não permite(m) conclusão.`;

      const textPart = { text: prompt };
      const imageParts = imagens.map(img => ({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType || 'image/jpeg',
        },
      }));
      const contents = { parts: [textPart, ...imageParts] };

      const result = await this.geminiService.generateStructured<{
        texto: string;
        severitySugerida: 'Mínimo' | 'Regular' | 'Crítico';
        correlacaoFotoPatologia: 'CONFIRMADA' | 'DIVERGENTE' | 'INCONCLUSIVA';
        observacaoDivergencia?: string;
        classificacaoTipo?: string;
        classificacaoSubtipo?: string;
        manifestacao?: string;
        causaProvavel?: string;
        recomendacaoTecnica?: string;
      }>(contents, SCHEMA_ANALISE_EVIDENCIA);

      return {
        texto: result.texto,
        severitySugerida: result.severitySugerida,
        correlacaoFotoPatologia: result.correlacaoFotoPatologia,
        observacaoDivergencia: result.observacaoDivergencia,
        classificacaoTipo: result.classificacaoTipo,
        classificacaoSubtipo: result.classificacaoSubtipo,
        manifestacao: result.manifestacao,
        causaProvavel: result.causaProvavel,
        recomendacaoTecnica: result.recomendacaoTecnica,
      };
    } catch (e: any) {
      console.warn('Diagnóstico de IA indisponível:', e?.message || e);
      this.toastService.show(
        'Diagnóstico por IA indisponível no momento. Você pode preencher os dados de campo manualmente.',
        'info',
        6000
      );
      return null;
    }
  }

  async capturarEAnalisar(): Promise<void> {
    const item = this.itemCapturandoEvidencia();
    if (!item) return;
    this.capturando.set(true);

    try {
      const blob = await this.camera.capturarBlob();
      const geo = await this.camera.obterLocalizacao();
      const idEvidencia = crypto.randomUUID();

      const ev: Evidencia = {
        id: idEvidencia,
        blob,
        mimeType: 'image/jpeg',
        tipo: this.tipoEvidencia(),
        geo,
        timestamp: new Date().toISOString(),
        id_item: item.id
      };

      await this.dbService.saveEvidencia(ev);

      this.aplicarMudancaNoItem(item.id, it => {
        const oc = this.obterOuCriarOcorrenciaAtiva(it);
        oc.id_evidencias = [...(oc.id_evidencias ?? []), idEvidencia];
        return it;
      });

      this.capturando.set(false);
      this.analisandoIa.set(true);

      const imagens = await this.obterImagensParaAnalise(item, blob, 'image/jpeg');
      const diag = await this.analisarComGemini(item, imagens);

      if (diag?.texto) {
        this.aplicarMudancaNoItem(item.id, it => {
          const oc = this.obterOuCriarOcorrenciaAtiva(it);
          oc.falhaAnaliseIa = false;
          oc.diagnostico_ia = diag.texto;
          oc.correlacaoFotoPatologia = diag.correlacaoFotoPatologia;
          oc.observacaoDivergencia = diag.observacaoDivergencia;

          if (diag.correlacaoFotoPatologia === 'CONFIRMADA') {
            oc.sugestaoIaPendente = {
              classificacaoTipo: diag.classificacaoTipo,
              classificacaoSubtipo: diag.classificacaoSubtipo,
              manifestacao: diag.manifestacao,
              causaProvavel: diag.causaProvavel,
              recomendacaoTecnica: diag.recomendacaoTecnica,
              severitySugerida: diag.severitySugerida,
            };
          }
          return it;
        });
      } else {
        this.aplicarMudancaNoItem(item.id, it => {
          const oc = this.obterOuCriarOcorrenciaAtiva(it);
          oc.falhaAnaliseIa = true;
          return it;
        });
      }
    } catch (e) {
      console.error('Falha na captura/análise de evidência', e);
      this.toastService.show('Falha ao capturar ou analisar a evidência.', 'error');
      this.aplicarMudancaNoItem(item.id, it => {
        const oc = this.obterOuCriarOcorrenciaAtiva(it);
        oc.falhaAnaliseIa = true;
        return it;
      });
    } finally {
      this.analisandoIa.set(false);
      this.fecharCaptura();
    }
  }

  aceitarSugestaoIa(itemId: string, fichaId: string): void {
    let grauRiscoAceito: 'Mínimo' | 'Regular' | 'Crítico' | undefined;

    this.aplicarMudancaNoItem(itemId, it => {
      const oc = it.ocorrencias?.find(f => f.id === fichaId);
      if (!oc || !oc.sugestaoIaPendente) return it;

      const s = oc.sugestaoIaPendente;
      grauRiscoAceito = s.severitySugerida;

      if (s.classificacaoTipo) {
        oc.classificacao = { tipo: s.classificacaoTipo as any, subtipo: s.classificacaoSubtipo as any };
      }
      oc.manifestacao = s.manifestacao || oc.manifestacao;
      oc.causaProvavel = s.causaProvavel || oc.causaProvavel;
      oc.recomendacaoTecnica = s.recomendacaoTecnica || oc.recomendacaoTecnica;
      oc.criticidade = (derivarPatamarPrioridade(s.severitySugerida) as any) || oc.criticidade;
      oc.normasAplicaveis = this.dataService
        .getNormasTipologia(it.systemTitle, it.typologyTitle)
        .filter(n => normaAplicavelATipologia(n.codigo, this.vistoriaAtiva()?.tipoUso));

      const historico = oc.historicoSugestoesIa ?? [];
      historico.push({
        classificacaoTipo: s.classificacaoTipo,
        classificacaoSubtipo: s.classificacaoSubtipo,
        manifestacao: s.manifestacao,
        causaProvavel: s.causaProvavel,
        recomendacaoTecnica: s.recomendacaoTecnica,
        severitySugerida: s.severitySugerida,
        decisao: 'aceita',
        decididaEm: new Date().toISOString(),
      });
      oc.historicoSugestoesIa = historico;

      oc.sugestaoIaPendente = null;
      return it;
    });

    if (grauRiscoAceito) {
      const itemAtualizado = this.vistoriaAtiva()?.items.find(it => it.id === itemId);
      if (itemAtualizado) {
        const ocAtivo = this.obterOcorrenciaAtiva(itemAtualizado);
        if (!ocAtivo.severity) {
          this.alterarGravidadeItem(itemId, grauRiscoAceito);
        }
      }
    }
  }

  descartarSugestaoIa(itemId: string, fichaId: string): void {
    this.aplicarMudancaNoItem(itemId, it => {
      const oc = it.ocorrencias?.find(f => f.id === fichaId);
      if (!oc) return it;

      if (oc.sugestaoIaPendente) {
        const s = oc.sugestaoIaPendente;
        const historico = oc.historicoSugestoesIa ?? [];
        historico.push({
          classificacaoTipo: s.classificacaoTipo,
          classificacaoSubtipo: s.classificacaoSubtipo,
          manifestacao: s.manifestacao,
          causaProvavel: s.causaProvavel,
          recomendacaoTecnica: s.recomendacaoTecnica,
          severitySugerida: s.severitySugerida,
          decisao: 'descartada',
          decididaEm: new Date().toISOString(),
        });
        oc.historicoSugestoesIa = historico;
      }

      oc.sugestaoIaPendente = null;
      return it;
    });
  }

  atualizarNotasItem(itemId: string, event: Event): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const valor = ((event.target as HTMLInputElement).value || '').trim();

    const novosItens = ativa.items.map(item => {
      if (item.id === itemId) {
        const itemAtualizado = { ...item };
        const oc = this.obterOuCriarOcorrenciaAtiva(itemAtualizado);
        oc.notes = valor;
        return itemAtualizado;
      }
      return item;
    });

    this.atualizarItensVistoriaAtiva(novosItens, true);
  }

  atualizarQuantitativoItem(itemId: string, event: Event): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const valor = ((event.target as HTMLInputElement).value || '').trim();

    const novosItens = ativa.items.map(item => {
      if (item.id === itemId) {
        const itemAtualizado = { ...item };
        const oc = this.obterOuCriarOcorrenciaAtiva(itemAtualizado);
        oc.quantitativo = valor;
        return itemAtualizado;
      }
      return item;
    });

    this.atualizarItensVistoriaAtiva(novosItens, true);
  }

  private atualizarItensVistoriaAtiva(itens: ChecklistItem[], isNotes: boolean = false): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const total = itens.length;
    const avaliados = itens.filter(i => i.status !== 'PENDENTE').length;
    const progress = total > 0 ? Math.round((avaliados / total) * 100) : 0;

    const vistoriaAtualizada: Vistoria = {
      ...ativa,
      items: itens,
      progress: progress,
      dateUpdated: new Date().toISOString()
    };

    this.vistoriaAtiva.set(vistoriaAtualizada);

    // Salvar na lista completa
    const listaAtualizada = this.vistorias().map(v => {
      if (v.id === ativa.id) {
        return vistoriaAtualizada;
      }
      return v;
    });

    if (isNotes) {
      this.vistorias.set(listaAtualizada);
      this.persistirComDebounce(listaAtualizada);
    } else {
      void this.salvarVistorias(listaAtualizada);
    }
  }

  private atualizarVistoriaAtiva(patch: Partial<Vistoria>): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;
    const atualizada: Vistoria = { ...ativa, ...patch, dateUpdated: new Date().toISOString() };
    const lista = this.vistorias().map(v => v.id === atualizada.id ? atualizada : v);
    this.vistorias.set(lista);
    this.vistoriaAtiva.set(atualizada);
    void this.salvarVistorias(lista);
  }

  sugerirAvaliacaoManutencao(vistoria: Vistoria): string {
    const docs = vistoria.documentosNorteadores ?? [];
    const constatacoes = Array.isArray(vistoria.anamnese?.constatacoes) ? vistoria.anamnese!.constatacoes : [];

    if (docs.length === 0 && constatacoes.length === 0) {
      return 'Não há documentos norteadores ou constatações de anamnese suficientes nesta vistoria para uma ' +
        'avaliação cruzada da gestão de manutenção e uso. Recomenda-se complementar o levantamento documental ' +
        'e histórico em vistorias futuras. Este texto pode ser editado livremente pelo Responsável Técnico.';
    }

    const disponibilizados = docs.filter(d => d.disponibilidade === 'DD').length;
    const naoDisponibilizados = docs.filter(d => d.disponibilidade === 'DND').length;
    const naoConformes = docs.filter(d => d.disponibilidade === 'DD' && d.conformidade === 'NC').length;
    const intervencoes = constatacoes.filter(c => c.tipo === 'INTERVENCAO').length;
    const relatosOcupante = constatacoes.filter(c => c.tipo === 'RELATO_OCUPANTE').length;

    const partes: string[] = [];
    partes.push('A avaliação da gestão de manutenção e uso combina os resultados da análise documental (Anexo I) ' +
      'com os relatos obtidos na anamnese.');

    if (docs.length > 0) {
      partes.push(`Do total de documentos norteadores levantados, ${disponibilizados} ${disponibilizados === 1 ? 'foi disponibilizado' : 'foram disponibilizados'}` +
        `${naoDisponibilizados > 0 ? ` e ${naoDisponibilizados} formalmente ${naoDisponibilizados === 1 ? 'não disponibilizado' : 'não disponibilizados'}` : ''}` +
        `${naoConformes > 0 ? `, com ${naoConformes} em não conformidade` : ''}.`);
    }
    if (intervencoes > 0) {
      partes.push(`Foram relatadas ${intervencoes} intervenção(ões) ou reforma(s) anterior(es) na anamnese, o que deve ser ` +
        'confrontado com os registros técnicos disponíveis.');
    }
    if (relatosOcupante > 0) {
      partes.push(`Há ${relatosOcupante} relato(s) de ocupante(s) que complementam o histórico de uso e manutenção da edificação.`);
    }
    partes.push('Recomenda-se que o responsável legal formalize e mantenha atualizado um programa de manutenção ' +
      'preventiva, nos termos da ABNT NBR 5674. Este texto foi sugerido automaticamente a partir dos dados ' +
      'levantados e deve ser revisado pelo Responsável Técnico antes da emissão do laudo.');

    return partes.join(' ');
  }

  navegarParaAvaliacaoManutencao(): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) { this.toastService.show('Selecione uma vistoria ativa.', 'error'); return; }
    const textoAtual = ativa.avaliacaoManutencaoTexto?.trim();
    this.novoAvaliacaoManutencaoTexto.set(textoAtual || this.sugerirAvaliacaoManutencao(ativa));
    this.modoExibicao.set('AVALIACAO_MANUTENCAO');
  }

  voltarDeAvaliacaoManutencao(): void {
    this.modoExibicao.set('EXECUCAO');
  }

  salvarAvaliacaoManutencao(texto: string): void {
    this.atualizarVistoriaAtiva({ avaliacaoManutencaoTexto: texto });
  }

  regerarSugestaoAvaliacaoManutencao(): void {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    const sugestao = this.sugerirAvaliacaoManutencao(ativa);
    this.novoAvaliacaoManutencaoTexto.set('');
    this.novoAvaliacaoManutencaoTexto.set(sugestao);
    this.salvarAvaliacaoManutencao(sugestao);
  }

  sugerirAvaliacaoCriticidade(vistoria: Vistoria): string {
    const todasFichas: { item: ChecklistItem; ficha: FichaDano }[] = [];
    (vistoria.items ?? []).forEach(item => {
      (item.ocorrencias ?? []).forEach(ficha => todasFichas.push({ item, ficha }));
    });

    if (todasFichas.length === 0) {
      return 'Não foram registradas ocorrências, anomalias ou falhas nesta vistoria até o momento, não havendo, ' +
        'portanto, elementos para avaliação do grau de criticidade. Este texto pode ser editado livremente pelo ' +
        'Responsável Técnico.';
    }

    const p1 = todasFichas.filter(f => f.ficha.criticidade === 'P1').length;
    const p2 = todasFichas.filter(f => f.ficha.criticidade === 'P2').length;
    const p3 = todasFichas.filter(f => f.ficha.criticidade === 'P3').length;
    const pendentes = todasFichas.length - p1 - p2 - p3;

    const porSistema = new Map<string, number>();
    todasFichas.forEach(f => {
      const s = f.item.systemTitle || 'Não identificado';
      porSistema.set(s, (porSistema.get(s) ?? 0) + 1);
    });
    let sistemaMax = ''; let maxCount = 0;
    porSistema.forEach((count, sistema) => { if (count > maxCount) { maxCount = count; sistemaMax = sistema; } });

    const partes: string[] = [];
    partes.push(`Das ${todasFichas.length} ocorrência(s) registrada(s) nesta vistoria, ${p1} ${p1 === 1 ? 'foi classificada' : 'foram classificadas'} ` +
      `como Prioridade 1 (crítica), ${p2} como Prioridade 2 (regular) e ${p3} como Prioridade 3 (mínima)` +
      `${pendentes > 0 ? `, com ${pendentes} ainda pendente(s) de classificação` : ''}.`);

    if (p1 > 0) {
      partes.push(`A presença de ${p1} ocorrência(s) de Prioridade 1 indica risco à saúde, segurança ou funcionalidade ` +
        'dos sistemas construtivos, demandando intervenção prioritária e imediata, conforme detalhado nas fichas ' +
        'correspondentes do Anexo III.');
    }
    if (sistemaMax && maxCount > 0) {
      partes.push(`O sistema com maior concentração de ocorrências foi "${sistemaMax}" (${maxCount} ocorrência(s)), ` +
        'merecendo atenção específica no planejamento de intervenções.');
    }
    partes.push('Recomenda-se que as ações corretivas sejam priorizadas conforme os patamares de criticidade ' +
      'descritos na Seção 6.0 deste laudo, iniciando pelas ocorrências de Prioridade 1. Este texto foi sugerido ' +
      'automaticamente a partir dos dados levantados e deve ser revisado pelo Responsável Técnico antes da emissão do laudo.');

    return partes.join(' ');
  }

  navegarParaAvaliacaoCriticidade(): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) { this.toastService.show('Selecione uma vistoria ativa.', 'error'); return; }
    const textoAtual = ativa.avaliacaoCriticidadeTexto?.trim();
    this.novoAvaliacaoCriticidadeTexto.set(textoAtual || this.sugerirAvaliacaoCriticidade(ativa));
    this.modoExibicao.set('AVALIACAO_CRITICIDADE');
  }

  voltarDeAvaliacaoCriticidade(): void {
    this.modoExibicao.set('EXECUCAO');
  }

  salvarAvaliacaoCriticidade(texto: string): void {
    this.atualizarVistoriaAtiva({ avaliacaoCriticidadeTexto: texto });
  }

  regerarSugestaoAvaliacaoCriticidade(): void {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    const sugestao = this.sugerirAvaliacaoCriticidade(ativa);
    this.novoAvaliacaoCriticidadeTexto.set('');
    this.novoAvaliacaoCriticidadeTexto.set(sugestao);
    this.salvarAvaliacaoCriticidade(sugestao);
  }

  sugerirConclusaoSintese(vistoria: Vistoria): string {
    const stats = this.calcularEstatisticas(vistoria);
    const todasFichas: FichaDano[] = [];
    (vistoria.items ?? []).forEach(item => (item.ocorrencias ?? []).forEach(f => todasFichas.push(f)));
    const p1 = todasFichas.filter(f => f.criticidade === 'P1').length;
    const p2 = todasFichas.filter(f => f.criticidade === 'P2').length;
    const p3 = todasFichas.filter(f => f.criticidade === 'P3').length;

    if (stats.total === 0) {
      return `A edificação ${vistoria.buildingName || 'objeto desta inspeção'} não possui tipologias inspecionadas ` +
        'registradas até o momento, não sendo possível apresentar uma síntese conclusiva. Este texto pode ser ' +
        'editado livremente pelo Responsável Técnico.';
    }

    return `A edificação ${vistoria.buildingName || 'objeto desta inspeção'} apresenta, das ${stats.total} ` +
      `tipologias inspecionadas, ${stats.conformes} em conformidade e ${stats.naoConformes} em não conformidade, ` +
      `correspondendo a uma taxa de conformidade de ${stats.taxaConformidade}%. Foram identificadas ` +
      `${todasFichas.length} ocorrência(s), sendo ${p1} de criticidade P1, ${p2} de criticidade P2 e ${p3} de ` +
      'criticidade P3. Este texto foi sugerido automaticamente a partir dos dados levantados e deve ser revisado ' +
      'pelo Responsável Técnico.';
  }

  sugerirConclusaoRiscos(vistoria: Vistoria): string {
    const fichasP1: FichaDano[] = [];
    (vistoria.items ?? []).forEach(item => (item.ocorrencias ?? []).forEach(f => { if (f.criticidade === 'P1') fichasP1.push(f); }));

    if (fichasP1.length === 0) {
      return 'Não foram identificadas ocorrências de Prioridade 1 (crítica) nesta vistoria. Os riscos identificados, ' +
        'quando existentes, encontram-se detalhados nas fichas do Anexo III com criticidade P2 ou P3. Este texto ' +
        'pode ser editado livremente pelo Responsável Técnico.';
    }

    const lista = fichasP1.map(f => `Ficha Nº ${String(f.numeroFicha ?? 0).padStart(3, '0')}` +
      `${f.manifestacao ? ` (${f.manifestacao.slice(0, 80)}${f.manifestacao.length > 80 ? '…' : ''})` : ''}`).join('; ');

    return `O principal risco identificado refere-se às ${fichasP1.length} ocorrência(s) de Prioridade 1 registrada(s) ` +
      `nesta vistoria: ${lista}. Essas condições, se não corrigidas, podem comprometer a saúde, a segurança dos ` +
      'usuários ou a funcionalidade dos sistemas construtivos. Este texto foi sugerido automaticamente a partir ' +
      'dos dados levantados e deve ser revisado pelo Responsável Técnico.';
  }

  sugerirConclusaoRecomendacoes(vistoria: Vistoria): string {
    const todasFichas: FichaDano[] = [];
    (vistoria.items ?? []).forEach(item => (item.ocorrencias ?? []).forEach(f => todasFichas.push(f)));
    const p1 = todasFichas.filter(f => f.criticidade === 'P1').length;
    const docsNaoDisp = (vistoria.documentosNorteadores ?? []).filter(d => d.disponibilidade === 'DND').length;

    const partes: string[] = [];
    if (p1 > 0) {
      partes.push(`Recomenda-se, em caráter prioritário, a correção imediata das ${p1} ocorrência(s) de Prioridade 1 ` +
        'identificadas, mediante intervenção de profissional habilitado.');
    }
    if (todasFichas.length > p1) {
      partes.push('As demais ocorrências, de criticidade P2 e P3, devem ser corrigidas em prazo compatível com sua ' +
        'classificação, conforme detalhado no Anexo III.');
    }
    if (docsNaoDisp > 0) {
      partes.push(`Recomenda-se ainda a regularização dos ${docsNaoDisp} documento(s) norteador(es) formalmente não ` +
        'disponibilizados, relacionados no Anexo I.');
    }
    if (partes.length === 0) {
      partes.push('Não foram identificadas não conformidades que demandem ação corretiva imediata nesta vistoria.');
    }
    partes.push('Recomenda-se, por fim, a formalização e manutenção de um programa de manutenção preventiva, nos ' +
      'termos da ABNT NBR 5674. Este texto foi sugerido automaticamente a partir dos dados levantados e deve ser ' +
      'revisado pelo Responsável Técnico.');

    return partes.join(' ');
  }

  sugerirConclusaoConsideracoesFinais(vistoria: Vistoria): string {
    return `O presente laudo reflete as condições observadas na edificação ${vistoria.buildingName || ''} na data ` +
      'da vistoria, dentro do escopo e metodologia declarados nas Seções 6.0 e 7.0 deste documento. Recomenda-se ' +
      'a adoção das medidas indicadas na Seção 13.3 e a reavaliação periódica dos sistemas construtivos, em ' +
      'conformidade com a ABNT NBR 5674, como parte da gestão contínua da manutenção predial. Este texto foi ' +
      'sugerido automaticamente e deve ser revisado pelo Responsável Técnico antes da emissão do laudo.';
  }

  navegarParaConclusoes(): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) { this.toastService.show('Selecione uma vistoria ativa.', 'error'); return; }
    this.novoConclusaoSinteseTexto.set(ativa.conclusaoSinteseTexto?.trim() || this.sugerirConclusaoSintese(ativa));
    this.novoConclusaoRiscosTexto.set(ativa.conclusaoRiscosTexto?.trim() || this.sugerirConclusaoRiscos(ativa));
    this.novoConclusaoRecomendacoesTexto.set(ativa.conclusaoRecomendacoesTexto?.trim() || this.sugerirConclusaoRecomendacoes(ativa));
    this.novoConclusaoConsideracoesTexto.set(ativa.conclusaoConsideracoesTexto?.trim() || this.sugerirConclusaoConsideracoesFinais(ativa));
    this.modoExibicao.set('CONCLUSOES');
  }

  voltarDeConclusoes(): void {
    this.modoExibicao.set('EXECUCAO');
  }

  salvarConclusaoSintese(texto: string): void {
    this.atualizarVistoriaAtiva({ conclusaoSinteseTexto: texto });
  }

  salvarConclusaoRiscos(texto: string): void {
    this.atualizarVistoriaAtiva({ conclusaoRiscosTexto: texto });
  }

  salvarConclusaoRecomendacoes(texto: string): void {
    this.atualizarVistoriaAtiva({ conclusaoRecomendacoesTexto: texto });
  }

  salvarConclusaoConsideracoes(texto: string): void {
    this.atualizarVistoriaAtiva({ conclusaoConsideracoesTexto: texto });
  }

  regerarSugestaoConclusaoSintese(): void {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    const s = this.sugerirConclusaoSintese(ativa);
    this.novoConclusaoSinteseTexto.set('');
    this.novoConclusaoSinteseTexto.set(s);
    this.salvarConclusaoSintese(s);
  }

  regerarSugestaoConclusaoRiscos(): void {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    const s = this.sugerirConclusaoRiscos(ativa);
    this.novoConclusaoRiscosTexto.set('');
    this.novoConclusaoRiscosTexto.set(s);
    this.salvarConclusaoRiscos(s);
  }

  regerarSugestaoConclusaoRecomendacoes(): void {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    const s = this.sugerirConclusaoRecomendacoes(ativa);
    this.novoConclusaoRecomendacoesTexto.set('');
    this.novoConclusaoRecomendacoesTexto.set(s);
    this.salvarConclusaoRecomendacoes(s);
  }

  regerarSugestaoConclusaoConsideracoes(): void {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    const s = this.sugerirConclusaoConsideracoesFinais(ativa);
    this.novoConclusaoConsideracoesTexto.set('');
    this.novoConclusaoConsideracoesTexto.set(s);
    this.salvarConclusaoConsideracoes(s);
  }

  textoAvaliacaoManutencaoDesatualizado(vistoria: Vistoria | null): boolean {
    if (!vistoria) return false;
    const salvo = vistoria.avaliacaoManutencaoTexto?.trim();
    if (!salvo) return false;
    const atual = this.sugerirAvaliacaoManutencao(vistoria).trim();
    return salvo !== atual;
  }

  textoAvaliacaoCriticidadeDesatualizado(vistoria: Vistoria | null): boolean {
    if (!vistoria) return false;
    const salvo = vistoria.avaliacaoCriticidadeTexto?.trim();
    if (!salvo) return false;
    const atual = this.sugerirAvaliacaoCriticidade(vistoria).trim();
    return salvo !== atual;
  }

  textoConclusaoSinteseDesatualizado(vistoria: Vistoria | null): boolean {
    if (!vistoria) return false;
    const salvo = vistoria.conclusaoSinteseTexto?.trim();
    if (!salvo) return false;
    const atual = this.sugerirConclusaoSintese(vistoria).trim();
    return salvo !== atual;
  }

  textoConclusaoRiscosDesatualizado(vistoria: Vistoria | null): boolean {
    if (!vistoria) return false;
    const salvo = vistoria.conclusaoRiscosTexto?.trim();
    if (!salvo) return false;
    const atual = this.sugerirConclusaoRiscos(vistoria).trim();
    return salvo !== atual;
  }

  textoConclusaoRecomendacoesDesatualizado(vistoria: Vistoria | null): boolean {
    if (!vistoria) return false;
    const salvo = vistoria.conclusaoRecomendacoesTexto?.trim();
    if (!salvo) return false;
    const atual = this.sugerirConclusaoRecomendacoes(vistoria).trim();
    return salvo !== atual;
  }

  textoConclusaoConsideracoesDesatualizado(vistoria: Vistoria | null): boolean {
    if (!vistoria) return false;
    const salvo = vistoria.conclusaoConsideracoesTexto?.trim();
    if (!salvo) return false;
    const atual = this.sugerirConclusaoConsideracoesFinais(vistoria).trim();
    return salvo !== atual;
  }

  obterSecoesDesatualizadas(vistoria: Vistoria | null): { titulo: string; acao: string; navegar: () => void }[] {
    if (!vistoria) return [];
    const lista: { titulo: string; acao: string; navegar: () => void }[] = [];

    if (this.textoAvaliacaoManutencaoDesatualizado(vistoria)) {
      lista.push({
        titulo: 'Seção 11.0 — Avaliação da Manutenção e Uso',
        acao: 'Revisar / Regerar Seção 11.0',
        navegar: () => this.navegarParaAvaliacaoManutencao(),
      });
    }
    if (this.textoAvaliacaoCriticidadeDesatualizado(vistoria)) {
      lista.push({
        titulo: 'Seção 12.0 — Avaliação do Grau de Criticidade',
        acao: 'Revisar / Regerar Seção 12.0',
        navegar: () => this.navegarParaAvaliacaoCriticidade(),
      });
    }
    if (this.textoConclusaoSinteseDesatualizado(vistoria)) {
      lista.push({
        titulo: 'Seção 13.1 — Síntese Geral do Grau de Conformidade',
        acao: 'Revisar / Regerar Seção 13.1',
        navegar: () => this.navegarParaConclusoes(),
      });
    }
    if (this.textoConclusaoRiscosDesatualizado(vistoria)) {
      lista.push({
        titulo: 'Seção 13.2 — Riscos Identificados à Segurança e Funcionalidade',
        acao: 'Revisar / Regerar Seção 13.2',
        navegar: () => this.navegarParaConclusoes(),
      });
    }
    if (this.textoConclusaoRecomendacoesDesatualizado(vistoria)) {
      lista.push({
        titulo: 'Seção 13.3 — Recomendações Prioritárias e Plano de Ação',
        acao: 'Revisar / Regerar Seção 13.3',
        navegar: () => this.navegarParaConclusoes(),
      });
    }
    if (this.textoConclusaoConsideracoesDesatualizado(vistoria)) {
      lista.push({
        titulo: 'Seção 13.4 — Considerações Finais',
        acao: 'Revisar / Regerar Seção 13.4',
        navegar: () => this.navegarParaConclusoes(),
      });
    }

    return lista;
  }

  obterTextosNaoHomologados(vistoria: Vistoria | null): string[] {
    if (!vistoria) return [];
    const pendentes: string[] = [];

    const secoes: { campo: string | undefined; titulo: string }[] = [
      { campo: vistoria.avaliacaoManutencaoTexto, titulo: 'Seção 11.0 — Avaliação da Manutenção e Uso' },
      { campo: vistoria.avaliacaoCriticidadeTexto, titulo: 'Seção 12.0 — Avaliação do Grau de Criticidade' },
      { campo: vistoria.conclusaoSinteseTexto, titulo: 'Seção 13.1 — Síntese Geral' },
      { campo: vistoria.conclusaoRiscosTexto, titulo: 'Seção 13.2 — Riscos Identificados' },
      { campo: vistoria.conclusaoRecomendacoesTexto, titulo: 'Seção 13.3 — Recomendações Prioritárias' },
      { campo: vistoria.conclusaoConsideracoesTexto, titulo: 'Seção 13.4 — Considerações Finais' },
    ];

    secoes.forEach(s => {
      if (!s.campo?.trim()) {
        pendentes.push(`${s.titulo}: texto ainda não revisado e salvo pelo Responsável Técnico.`);
      }
    });

    return pendentes;
  }

  obterImpedimentosEmissao(vistoria: Vistoria | null): string[] {
    if (!vistoria) return [];
    const impedimentos: string[] = [];

    (vistoria.items ?? []).forEach(item => {
      const ocorrencias = item.ocorrencias ?? [];
      const ehConforme = item.status === 'PASS' || item.status === 'CONFORME';

      if (ehConforme && ocorrencias.length > 0) {
        impedimentos.push(
          `${item.typologyTitle} — ${item.title}: item marcado como conforme, mas possui ${ocorrencias.length} ocorrência(s) registrada(s).`
        );
      }

      ocorrencias.forEach((ficha, idx) => {
        const rotulo = `${item.typologyTitle} — ${item.title}, ficha ${idx + 1}`;

        const temDiagnostico =
          !!(ficha.manifestacao || ficha.causaProvavel || ficha.recomendacaoTecnica) ||
          !!ficha.memorialDescritivo?.trim();
        if (!temDiagnostico) {
          impedimentos.push(`${rotulo}: sem diagnóstico preenchido.`);
        }

        if (!ficha.criticidade) {
          impedimentos.push(`${rotulo}: sem classificação de criticidade.`);
        }

        if (ficha.sugestaoIaPendente) {
          impedimentos.push(`${rotulo}: há sugestão de IA pendente de aceitação ou descarte.`);
        }
      });
    });

    impedimentos.push(...this.obterTextosNaoHomologados(vistoria));

    return impedimentos;
  }

  solicitarExportarRelatorioPDF(): void {
    const ativa = this.vistoriaAtiva();
    const profile = this.userProfile();
    if (!profile || !registroValido(profile.professionalId)) {
      this.toastService.show('Emissão bloqueada. É necessário possuir um registro profissional (CAU/CREA) válido cadastrado no seu perfil para emitir documentos técnicos.', 'error');
      return;
    }
    if (!ativa) {
      this.toastService.show('Dados insuficientes para gerar o relatório em PDF.', 'error');
      return;
    }

    const impedimentos = this.obterImpedimentosEmissao(ativa);
    if (impedimentos.length > 0) {
      this.impedimentosEmissao.set(impedimentos);
      this.exibirModalImpedimentos.set(true);
      return;
    }
    this.impedimentosEmissao.set([]);

    const desatualizadas = this.obterSecoesDesatualizadas(ativa);
    if (desatualizadas.length > 0) {
      this.exibirModalPreEmissao.set(true);
      return;
    }

    void this.exportarRelatorioPDF();
  }

  confirmarEmissaoComTextosDesatualizados(): void {
    this.exibirModalPreEmissao.set(false);
    void this.exportarRelatorioPDF();
  }

  fecharModalPreEmissao(): void {
    this.exibirModalPreEmissao.set(false);
  }

  fecharModalImpedimentos(): void {
    this.exibirModalImpedimentos.set(false);
  }

  navegarParaAnexoArt(): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) { this.toastService.show('Selecione uma vistoria ativa.', 'error'); return; }
    this.modoExibicao.set('ANEXO_ART');
  }

  voltarDeAnexoArt(): void {
    this.modoExibicao.set('EXECUCAO');
  }

  async processarAnexoArtRrt(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    const ativa = this.vistoriaAtiva(); if (!ativa) return;

    const file = files[0]; // só o primeiro — um ART por vistoria
    const id = crypto.randomUUID();
    await this.dbService.saveAnexoBlob({ id, blob: file, mimeType: file.type });

    const anexo: Anexo = { id, nome: file.name, tipo: file.type, tamanho: file.size, dataUpload: new Date().toISOString() };

    // Se já havia um ART anexado antes, remover o blob antigo (evita órfão no store)
    if (ativa.anexoArtRrt?.id) {
      await this.dbService.deleteAnexoBlob(ativa.anexoArtRrt.id);
    }

    this.atualizarVistoriaAtiva({ anexoArtRrt: anexo });
    this.toastService.show('ART/RRT anexado com sucesso.', 'success');
  }

  solicitarExcluirAnexoArtRrt(): void {
    const ativa = this.vistoriaAtiva(); if (!ativa?.anexoArtRrt) return;
    const anexoId = ativa.anexoArtRrt.id;
    if (this.anexoPendenteConfirmacaoExclusao() === anexoId) {
      void this.excluirAnexoArtRrt(anexoId);
      this.anexoPendenteConfirmacaoExclusao.set(null);
    } else {
      this.anexoPendenteConfirmacaoExclusao.set(anexoId);
      this.toastService.show('Clique novamente para confirmar a exclusão do ART/RRT.', 'info');
      setTimeout(() => {
        if (this.anexoPendenteConfirmacaoExclusao() === anexoId) this.anexoPendenteConfirmacaoExclusao.set(null);
      }, 3000);
    }
  }

  private async excluirAnexoArtRrt(anexoId: string): Promise<void> {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    await this.dbService.deleteAnexoBlob(anexoId);
    this.atualizarVistoriaAtiva({ anexoArtRrt: undefined });
    this.toastService.show('ART/RRT removido.', 'success');
  }

  voltarParaLista(): void {
    this.vistoriaAtiva.set(null);
    this.modoExibicao.set('LISTA');
    void this.carregarVistorias(); // Recarregar e ordenar
  }

  private formatarLogoMarca(nome: string | undefined): string {
    if (!nome || nome === 'AmorimTech') return 'Amorim<span>Tech</span>';
    return nome;
  }

  private normalizarCnpjExibicao(valor: string | undefined): string {
    if (!valor) return '';
    // Remove qualquer prefixo "CNPJ" já digitado pelo usuário (com ou sem dois-pontos,
    // maiúsculo ou minúsculo, com espaços variáveis) antes de reaplicar o label fixo.
    return valor.replace(/^\s*cnpj\s*:?\s*/i, '').trim();
  }

  async exportarRelatorioPDF(): Promise<void> {
    const ativa = this.vistoriaAtiva();
    const profile = this.userProfile();
    if (!profile || !registroValido(profile.professionalId)) {
      this.toastService.show('Emissão bloqueada. É necessário possuir um registro profissional (CAU/CREA) válido cadastrado no seu perfil para emitir documentos técnicos.', 'error');
      return;
    }
    if (!ativa) {
      this.toastService.show('Dados insuficientes para gerar o relatório em PDF.', 'error');
      return;
    }

    const impedimentos = this.obterImpedimentosEmissao(ativa);
    if (impedimentos.length > 0) {
      this.impedimentosEmissao.set(impedimentos);
      this.exibirModalImpedimentos.set(true);
      return;
    }

    const novaJanela = window.open('', '_blank');
    if (!novaJanela) {
      this.toastService.show('Popup bloqueado. Permita popups para este site e tente novamente.', 'error');
      return;
    }
    novaJanela.document.write('<html><body style="font-family:sans-serif;padding:20px">Gerando relatório, aguarde…</body></html>');

    // Registro imutável da emissão — snapshot congelado, nunca editado depois
    let numeroDocumentoFormatado = '';
    const anoAtual = new Date().getFullYear();
    let numeroEmissao = 1;
    try {
      numeroEmissao = (await this.dbService.countLaudosEmitidosNoAno(anoAtual)) + 1;
      numeroDocumentoFormatado = `LTIP-nº${String(numeroEmissao).padStart(3, '0')}/${anoAtual}`;
      const novoLaudo: LaudoEmitido = {
        id: crypto.randomUUID(),
        numeroEmissao,
        vistoriaId: ativa.id,
        buildingName: ativa.buildingName,
        address: ativa.address,
        dataEmissao: new Date().toISOString(),
        snapshotVistoria: JSON.parse(JSON.stringify(ativa)),
        snapshotProfile: JSON.parse(JSON.stringify(profile)),
      };
      await this.dbService.salvarLaudoEmitido(novoLaudo);
      void this.carregarLaudosEmitidos();
    } catch (e) {
      console.error('Falha ao registrar emissão do laudo (o PDF ainda será gerado normalmente):', e);
      // Falha no registro NÃO deve impedir a geração do PDF em si.
    }

    if (!numeroDocumentoFormatado) {
      numeroDocumentoFormatado = `LTIP-nº${String(numeroEmissao).padStart(3, '0')}/${anoAtual}`;
    }
    const ltipNumero = numeroDocumentoFormatado;
    const documentoRegistrado = !!(profile.professionalId?.trim() && ativa.artRrtNumero?.trim() && ativa.anexoArtRrt);

    // Pré-carregar evidências como data URL base64
    const evidenciasMap = new Map<string, { dataUrl: string; geo: any; timestamp: string; tipo: string }>();

    const itens = ativa.items ?? [];

    for (const item of itens) {
      const oc = item.ocorrencias?.[0];
      const idEvidencias = oc?.id_evidencias ?? [];
      if (idEvidencias.length) {
        for (const evId of idEvidencias) {
          try {
            const ev = await this.dbService.getEvidencia(evId);
            if (ev?.blob) {
              const base64 = await this.blobParaBase64(ev.blob);
              const dataUrl = `data:${ev.mimeType || 'image/jpeg'};base64,${base64}`;
              evidenciasMap.set(evId, {
                dataUrl,
                geo: ev.geo ?? null,
                timestamp: ev.timestamp ? new Date(ev.timestamp).toLocaleString('pt-BR') : '',
                tipo: ev.tipo ?? 'contexto'
              });
            }
          } catch {
            // evidência não encontrada — ignora silenciosamente
          }
        }
      }
    }

    // Pré-carregar imagens da anamnese como data URL base64 (object URL não funciona na impressão)
    const anexoImagensMap = new Map<string, string>();   // anexoId -> dataUrl
    for (const anexo of (ativa.anamnese?.anexos ?? [])) {
      if (anexo.tipo.startsWith('image/')) {
        try {
          const ab = await this.dbService.getAnexoBlob(anexo.id);
          if (ab?.blob) {
            const base64 = await this.blobParaBase64(ab.blob);
            anexoImagensMap.set(anexo.id, `data:${ab.mimeType || anexo.tipo};base64,${base64}`);
          }
        } catch { /* anexo ausente — ignora */ }
      }
    }

    const estatisticas = this.estatisticasAtivas();
    const form = { buildingName: ativa.buildingName, address: ativa.address };
    
    // Organizar itens por Sistema para renderização limpa
    const itensPorSistema: { [sistema: string]: ChecklistItem[] } = {};
    ativa.items.forEach(item => {
      if (!itensPorSistema[item.systemTitle]) {
        itensPorSistema[item.systemTitle] = [];
      }
      itensPorSistema[item.systemTitle].push(item);
    });

    let itemsHtml = '';
    Object.entries(itensPorSistema).forEach(([sistema, itens]) => {
      itemsHtml += `
        <tr class="sistema-row">
          <th colspan="4">${sistema}</th>
        </tr>
      `;
      itens.forEach(item => {
        let badgeClass = 'badge-status-pend';
        let badgeText = 'PENDENTE';
        if (item.status === 'PASS' || item.status === 'CONFORME') {
          badgeClass = 'badge-status-ok'; badgeText = 'CONFORME';
        } else if (item.status === 'FAIL' || item.status === 'NAO_CONFORME') {
          badgeClass = 'badge-status-nc';
          const qtd = item.ocorrencias?.length ?? 0;
          const criticidades = (item.ocorrencias ?? []).map(f => f.criticidade).filter(Boolean);
          const maisCritica = criticidades.includes('P1') ? 'P1' : criticidades.includes('P2') ? 'P2' : criticidades.includes('P3') ? 'P3' : null;
          const rotuloCriticidade = maisCritica ? maisCritica : (item.ocorrencias?.[0]?.severity?.toUpperCase() ?? 'PENDENTE');
          badgeText = `NÃO CONFORME · ${qtd} OCORRÊNCIA${qtd === 1 ? '' : 'S'} · ${rotuloCriticidade}`;
        } else if (item.status === 'NA' || item.status === 'NAO_APLICAVEL') {
          badgeClass = 'badge-status-na'; badgeText = 'N/A';
        }

        itemsHtml += `
          <tr>
            <td style="font-size: 0.85em;"><strong>${item.typologyTitle}</strong><br><span style="color: #666;">${item.title}</span></td>
            <td style="font-size: 0.8em; color: #555;">${item.description}</td>
            <td style="text-align: center;"><span class="${badgeClass}">${badgeText}</span></td>
          </tr>
        `;
      });
    });

    let companyInfo = '';
    if (profile.companyName) {
      companyInfo += `<p>${profile.companyName}${profile.position ? ` - ${profile.position}` : ''}</p>`;
      if (profile.companyCnpj) companyInfo += `<p>CNPJ: ${profile.companyCnpj}</p>`;
      if (profile.companyAddress) companyInfo += `<p>${profile.companyAddress}</p>`;
    }

    const secao4 = gerarSecao4Html(ativa);
    const qualificacao = gerarQualificacaoHtml(profile);
    const glossario = gerarGlossarioHtml(ativa.exibirGlossario ?? true);
    const ressalvas = gerarRessalvasHtml();
    const metodologia = gerarMetodologiaHtml();
    const diagnostico = gerarDiagnosticoHtml(itens);
    const avaliacaoManutencao = this.gerarAvaliacaoManutencaoHtml(ativa);
    const avaliacaoCriticidade = this.gerarAvaliacaoCriticidadeHtml(ativa);
    const conclusoes = this.gerarConclusoesHtml(ativa);
    const anamnese = gerarAnamneseHtml(ativa, anexoImagensMap);
    const secao7 = gerarSecao7Html(itens, evidenciasMap);
    const secao8 = gerarSecao8DocumentosNorteadoresHtml(ativa);
    const secao9 = gerarSecao9Html(itens);
    const anexoI = gerarAnexoINorteadoresHtml(ativa);
    const relacaoAnexos = this.gerarRelacaoAnexosHtml(ativa);
    const anexoIV = gerarAnexoIVHtml(ativa);
    const encerramento = gerarEncerramentoHtml(ativa, profile);

    const sumarioEntries = [
      { href: 'sec-1',  num: '1.0',  label: 'Apresentação' },
      { href: 'sec-2',  num: '2.0',  label: 'Qualificação do Responsável Técnico' },
      ...((ativa.exibirGlossario ?? true) ? [{ href: 'sec-3', num: '3.0', label: 'Glossário' }] : []),
      { href: 'sec-4',  num: '4.0',  label: 'Normativo Técnico Aplicado' },
      { href: 'sec-5',  num: '5.0',  label: 'Ressalvas e Princípios' },
      { href: 'sec-6',  num: '6.0',  label: 'Metodologia Aplicada' },
      { href: 'sec-7',  num: '7.0',  label: 'Caracterização do Objeto da Inspeção' },
      { href: 'sec-8',  num: '8.0',  label: 'Levantamento e Análise dos Documentos Norteadores' },
      { href: 'sec-9',  num: '9.0',  label: 'Vistoria no Objeto da Inspeção' },
      { href: 'sec-9-1', num: '9.1', label: 'Anamnese — Histórico e Constatações' },
      { href: 'sec-10', num: '10.0', label: 'Diagnóstico do Objeto da Inspeção' },
      { href: 'sec-11', num: '11.0', label: 'Avaliação da Manutenção e Uso' },
      { href: 'sec-12', num: '12.0', label: 'Avaliação do Grau de Criticidade' },
      { href: 'sec-13', num: '13.0', label: 'Conclusões e Considerações Finais' },
      { href: 'sec-14', num: '14.0', label: 'Relação de Anexos' },
      { href: 'sec-15', num: '15.0', label: 'Encerramento e Assinatura' },
      { href: 'anexo-1', label: 'Anexo I — Verificação de Documentos Norteadores' },
      { href: 'anexo-2', label: 'Anexo II — Relatório Fotográfico' },
      { href: 'anexo-3', label: 'Anexo III — Mapeamento de Danos' },
      { href: 'anexo-4', label: 'Anexo IV — ART / RRT' }
    ];
    const sumario = gerarSumarioHtml(sumarioEntries);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="utf-8">
          <title>Laudo Técnico de Inspeção Predial - ${form.buildingName}</title>
          <style>${LAUDO_LTIP_CSS}</style>
      </head>
      <body>
          <table class="print-table">
            <!-- CABEÇALHO: repete no TOPO de TODAS as páginas (comportamento nativo do <thead> no Chrome Print) -->
            <thead>
              <tr>
                <td class="print-thead-td">
                  <div class="rh-wrap">
                    <div class="rh-left">
                      ${profile.companyLogoBase64
                        ? `<img src="${profile.companyLogoBase64}" style="max-height:13mm;max-width:60mm;object-fit:contain;">`
                        : `<span class="rh-brand">${this.formatarLogoMarca(profile.companyName)}</span>`
                      }
                    </div>
                    <div class="rh-right">
                      <span class="rh-rt">${profile.fullName} — ${profile.professionalId || ''}</span>
                      <span class="rh-company">${profile.companyName || ''}${profile.companyCnpj ? ` · CNPJ: ${profile.companyCnpj}` : ''}</span>
                    </div>
                  </div>
                </td>
              </tr>
            </thead>
            <!-- RODAPÉ: repete no FUNDO de TODAS as páginas -->
            <tfoot>
              <tr>
                <td class="print-tfoot-td">
                  <div class="rf-wrap">
                    <span class="rf-doc">Laudo Técnico de Inspeção Predial — ${form.buildingName.length > 45 ? form.buildingName.slice(0, 42) + '…' : form.buildingName}</span>
                    <span class="rf-prov">${documentoRegistrado ? numeroDocumentoFormatado : '⚠ Documento Provisório'}</span>
                    <span class="rf-page"></span>
                  </div>
                </td>
              </tr>
            </tfoot>
            <!-- CONTEÚDO: todo o documento dentro de uma única célula -->
            <tbody>
              <tr class="print-tbody-tr">
                <td class="print-tbody-td">
 
          <!-- CAPA P4 -->
          <div class="capa">
            <div class="capa-logo-wrap">
              ${profile.companyLogoBase64
                ? `<img src="${profile.companyLogoBase64}" style="max-height:22mm;max-width:60mm;object-fit:contain;">`
                : `<div class="capa-logo-mark">${(profile.companyName || 'P4').slice(0,2).toUpperCase()}</div>`
              }
            </div>
            <div class="capa-titulo">
              <h1>Laudo Técnico de Inspeção Predial</h1>
              <div class="sub">${form.buildingName}</div>
            </div>
            <div class="capa-meta">
              <b>Empreendimento:</b> ${form.buildingName}<br>
              <b>Endereço da Edificação:</b> ${form.address}<br>
              <b>Empresa:</b> ${profile.companyName || ''}${profile.companyCnpj ? ` · CNPJ: ${profile.companyCnpj}` : ''}<br>
              ${profile.companyAddress ? `<b>Endereço:</b> ${profile.companyAddress}<br>` : ''}
              ${profile.companyPhone ? `<b>Telefone:</b> <a href="tel:${this.normalizarTel(profile.companyPhone)}" style="color:#132A41;text-decoration:none;">${profile.companyPhone}</a><br>` : ''}
              ${profile.companyEmail ? `<b>E-mail:</b> <a href="mailto:${profile.companyEmail}" style="color:#185fa5;">${profile.companyEmail}</a><br>` : ''}
              ${profile.companySite ? `<b>Site:</b> <a href="${this.normalizarUrl(profile.companySite)}" style="color:#185fa5;">${profile.companySite}</a><br>` : ''}
              ${(profile.socialNetworkLabel && profile.socialNetworkUrl) ? `<b>Rede Social:</b> <a href="${this.normalizarUrl(profile.socialNetworkUrl)}" style="color:#185fa5;">${profile.socialNetworkLabel}</a><br>` : ''}
              <b>Responsável Técnico:</b> ${profile.fullName}${profile.professionalTitle ? ` — ${profile.professionalTitle}` : ''}${profile.professionalId ? ` — ${profile.professionalId}` : ''}<br>
              <b>Data da vistoria:</b> ${new Date(ativa.dateCreated).toLocaleDateString('pt-BR')}
            </div>
            ${documentoRegistrado
              ? `<div class="prov-banner" style="background:#EAF3EC;border-color:#1E7A46;">
                   <strong style="color:#1E7A46;">${numeroDocumentoFormatado}</strong> — ART/RRT nº ${ativa.artRrtNumero} anexado. Documento adquire plena validade técnica mediante assinatura do Responsável Técnico.
                 </div>`
              : `<div class="prov-banner">
                   ⚠ Documento provisório — Adquire validade técnica mediante assinatura do Responsável Técnico (ART/RRT).
                 </div>`
            }
          </div>

          <!-- SUMÁRIO -->
          ${sumario}

          <!-- 1.0 Apresentação -->
          <h2 class="sec-h" id="sec-1"><span class="sn">1.0</span>Apresentação</h2>
          
          <h3 style="font-size:10pt;font-weight:700;color:#132A41;margin:4mm 0 2mm;">1.1 Identificação</h3>
          ${(() => {
            const tdL1 = 'background:#F7F5F0;padding:1.5mm 3mm;font-size:8pt;font-weight:600;color:#4A5A66;border:1px solid #D8D0C6;width:23%;white-space:nowrap;';
            const tdV1 = 'padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;width:27%;';
            let rows = '';

            // Linha 1: Empreendimento (span completo)
            rows += `<tr><td style="${tdL1}">Empreendimento</td><td colspan="3" style="${tdV1}">${form.buildingName}</td></tr>`;
            // Linha 2: Endereço (span completo)
            rows += `<tr><td style="${tdL1}">Endereço</td><td colspan="3" style="${tdV1}">${form.address}</td></tr>`;
            // Linha 3: RT + Data da vistoria
            rows += `<tr><td style="${tdL1}">Responsável Técnico</td><td style="${tdV1}">${profile.fullName} — ${profile.professionalId || ''}</td><td style="${tdL1}">Data da Vistoria</td><td style="${tdV1}">${new Date(ativa.dateCreated).toLocaleDateString('pt-BR')}</td></tr>`;
            // Linha 4: Empresa + ART/RRT
            rows += `<tr><td style="${tdL1}">Empresa / CNPJ</td><td style="${tdV1}">${profile.companyName || ''} · ${profile.companyCnpj || ''}</td>${ativa.artRrtNumero ? `<td style="${tdL1}">ART / RRT</td><td style="${tdV1}">${ativa.artRrtNumero}</td>` : `<td colspan="2" style="border:1px solid #D8D0C6;background:#fafafa;"></td>`}</tr>`;

            if (ativa.contratanteRazaoSocial) {
              rows += `<tr><td style="${tdL1}">Contratante</td><td colspan="3" style="${tdV1}">${ativa.contratanteRazaoSocial}${ativa.contratanteCnpj ? ` · CNPJ: ${this.normalizarCnpjExibicao(ativa.contratanteCnpj)}` : ''}</td></tr>`;
            }

            return `<table style="width:100%;border-collapse:collapse;margin-bottom:4mm;">${rows}</table>`;
          })()}

          <h3 style="font-size:10pt;font-weight:700;color:#132A41;margin:4mm 0 2mm;">1.2 Objeto e Natureza da Inspeção</h3>
          <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">
            O presente Laudo Técnico de Inspeção Predial tem por objeto a edificação denominada
            <strong>${form.buildingName}</strong>, localizada em <strong>${form.address}</strong>,
            conforme identificação e caracterização constantes das seções subsequentes.
            A inspeção foi realizada por profissional habilitado (${profile.fullName} — ${profile.professionalId || 'CAU/CREA'}),
            com emissão de Registro de Responsabilidade Técnica (RRT/ART), em conformidade com a ABNT NBR 16747:2020.
          </p>
          <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">
            A inspeção tem por objetivo avaliar as condições técnicas de conservação, desempenho, segurança e
            manutenção da edificação, com classificação das anomalias segundo critérios de grau de risco
            (Mínimo, Regular e Crítico), em conformidade com a ABNT NBR 16747:2020.
            A metodologia adotada compreende inspeção visual sistêmica, registro fotográfico georreferenciado,
            análise por inteligência artificial (diagnóstico assistido) e emissão de relatório técnico estruturado
            por sistemas e tipologias prediais.
          </p>

          <!-- 2.0 Qualificação do Responsável Técnico -->
          ${qualificacao}

          <!-- 3.0 Glossário -->
          ${glossario}

          <!-- 4.0 Normativo Técnico Aplicado -->
          <h2 class="sec-h" id="sec-4"><span class="sn">4.0</span>Normativo Técnico Aplicado</h2>
          ${(() => {
            const sistemasUsados = [...new Set(ativa.items.map((i: any) => i.systemTitle))];
            const normas = this.dataService.getNormasParaRTIPA(sistemasUsados);
            const transversais = normas.transversais.filter((n: NormaRef) =>
              normaAplicavelATipologia(n.codigo, ativa.tipoUso)
            );
            const porSistema = normas.porSistema
              .map((s: any) => ({
                ...s,
                normasSistema: s.normasSistema.filter((n: NormaRef) =>
                  normaAplicavelATipologia(n.codigo, ativa.tipoUso)
                ),
              }))
              .filter((s: any) => s.normasSistema.length > 0);

            let html = '';
            // Normas transversais
            html += `<p style="font-size:8.5pt;font-weight:600;color:#132A41;margin:3mm 0 1mm;">Normas transversais (todos os sistemas):</p>`;
            html += `<table style="width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:4mm;">`;
            html += `<thead><tr style="background:#2C5AA0;color:#fff;"><th style="padding:2mm 3mm;text-align:left;width:30%">Norma</th><th style="padding:2mm 3mm;text-align:left">Título e Aplicação</th></tr></thead><tbody>`;
            transversais.forEach((n: NormaRef, idx: number) => {
              const bg = idx % 2 === 0 ? '#fff' : '#F7F5F0';
              html += `<tr style="background:${bg};"><td style="padding:2mm 3mm;font-weight:600;color:#B5642A;vertical-align:top;">${n.codigo}</td><td style="padding:2mm 3mm;vertical-align:top;">${n.titulo}</td></tr>`;
            });
            html += `</tbody></table>`;
            // Normas por sistema
            if (porSistema.length > 0) {
              html += `<p style="font-size:8.5pt;font-weight:600;color:#132A41;margin:3mm 0 1mm;">Normas específicas dos sistemas inspecionados:</p>`;
              html += `<table style="width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:4mm;">`;
              html += `<thead><tr style="background:#2C5AA0;color:#fff;"><th style="padding:2mm 3mm;text-align:left;width:22%">Norma</th><th style="padding:2mm 3mm;text-align:left;width:35%">Título</th><th style="padding:2mm 3mm;text-align:left">Sistema / Aplicação</th></tr></thead><tbody>`;
              porSistema.forEach((s: any) => {
                s.normasSistema.forEach((n: NormaRef, idx: number) => {
                  const bg = idx % 2 === 0 ? '#fff' : '#F7F5F0';
                  html += `<tr style="background:${bg};"><td style="padding:2mm 3mm;font-weight:600;color:#B5642A;vertical-align:top;">${n.codigo}</td><td style="padding:2mm 3mm;vertical-align:top;">${n.titulo}</td><td style="padding:2mm 3mm;vertical-align:top;color:#4A5A66;">${s.titulo} — ${n.aplicacao}</td></tr>`;
                });
              });
              html += `</tbody></table>`;
            }
            return html;
          })()}

          <!-- 5.0 Ressalvas e Princípios -->
          ${ressalvas}

          <!-- 6.0 Metodologia Aplicada -->
          ${metodologia}

          <!-- 7.0 Caracterização do Objeto da Inspeção -->
          ${secao4}

          <!-- 8.0 Levantamento e Análise dos Documentos Norteadores -->
          ${secao8}

          <!-- 9.0 Vistoria no Objeto da Inspeção -->
          <h2 class="sec-h" id="sec-9"><span class="sn">9.0</span>Vistoria no Objeto da Inspeção</h2>

          <!-- 9.1 Anamnese -->
          ${anamnese}

          <!-- 9.2 Sistemas Inspecionados -->
          <h3 style="font-size:10pt;font-weight:700;color:#132A41;margin:4mm 0 2mm;">9.2 Sistemas Inspecionados — Tabela-Resumo</h3>
          <table class="t-std">
            <thead>
              <tr>
                <th style="width:30%">Tipologia / Item</th>
                <th style="width:50%">Procedimento e Critério de Inspeção</th>
                <th style="width:20%;text-align:center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- 9.3 Síntese da Inspeção -->
          <h3 style="font-size:10pt;font-weight:700;color:#132A41;margin:4mm 0 2mm;">9.3 Síntese da Inspeção</h3>
          <div class="sintese-grid">
            <div class="sintese-card">
              <span class="big">${estatisticas.total}</span>
              <span class="lbl">Itens totais</span>
            </div>
            <div class="sintese-card">
              <span class="big">${estatisticas.avaliados}</span>
              <span class="lbl">Inspecionados</span>
            </div>
            <div class="sintese-card">
              <span class="big ok">${estatisticas.conformes}</span>
              <span class="lbl">Conformes</span>
            </div>
            <div class="sintese-card">
              <span class="big critico">${estatisticas.naoConformes}</span>
              <span class="lbl">Não conformes</span>
            </div>
            <div class="sintese-card">
              <span class="big">${estatisticas.percentualConclusao}%</span>
              <span class="lbl">Conclusão</span>
            </div>
            <div class="sintese-card">
              <span class="big ok">${estatisticas.taxaConformidade}%</span>
              <span class="lbl">Conformidade</span>
            </div>
          </div>

          <!-- 10.0 Diagnóstico do Objeto da Inspeção -->
          ${diagnostico}

          <!-- 11.0 Avaliação da Manutenção e Uso -->
          ${avaliacaoManutencao}

          <!-- 12.0 Avaliação do Grau de Criticidade -->
          ${avaliacaoCriticidade}

          <!-- 13.0 Conclusões e Considerações Finais -->
          ${conclusoes}

          <!-- 14.0 Relação de Anexos -->
          ${relacaoAnexos}

          <!-- 15.0 Encerramento e Assinatura -->
          ${encerramento}

          <!-- Anexo I — Verificação de Documentos Norteadores -->
          ${anexoI}

          <!-- Anexo II — Relatório Fotográfico -->
          ${secao7}

          <!-- Anexo III — Mapeamento de Danos -->
          ${secao9}

          <!-- Anexo IV — ART / RRT -->
          ${anexoIV}

          <!-- Selo final — sempre a última peça do documento -->
          <div style="text-align:center; margin-top:6mm;">
            <div class="selo-amorimtech">
              <div class="badge-circ">A</div>
              <div class="txt"><b>Gerado pela plataforma Predial 4.0</b><br>AmorimTech Ecossistema 4.0 — tecnologia de inspeção predial</div>
            </div>
          </div>

          <!-- RODAPÉ P4 -->
          <div class="doc-footer">
            ${documentoRegistrado
              ? `<span class="prov-tag" style="background:#EAF3EC;color:#1E7A46;">${numeroDocumentoFormatado}</span>
                 ART/RRT nº ${ativa.artRrtNumero}. Documento adquire plena validade técnica mediante assinatura do RT.`
              : `<span class="prov-tag">PROVISÓRIO</span>
                 Documento provisório. Adquire validade técnica mediante assinatura do RT (ART/RRT).`
            }
            Emitido por: ${profile.fullName} — ${profile.professionalId || ''} — ${profile.companyName || ''}
          </div>
          <div class="chancela-at">
            <div style="display:flex;align-items:flex-start;gap:6mm;flex-wrap:wrap;">
              <div style="flex:0 0 auto;">
                <div class="at-logo" style="margin-bottom:2mm;">${profile.companyName || 'Predial 4.0'}</div>
              </div>
              <div class="at-txt" style="flex:1;min-width:180px;">
                <strong style="color:#1A2A38;font-size:8pt;">Predial 4.0</strong> — Plataforma de Gestão e Inteligência Predial Avançada<br>
                ${profile.companyAddress ? `${profile.companyAddress}<br>` : ''}
                ${[
                  profile.companyEmail ? `<a href="mailto:${profile.companyEmail}" style="color:#B5642A;">${profile.companyEmail}</a>` : '',
                  profile.companyPhone ? `<a href="tel:${this.normalizarTel(profile.companyPhone)}" style="color:#4A5A66;text-decoration:none;">${profile.companyPhone}</a>` : '',
                ].filter(Boolean).join('&nbsp;·&nbsp;')}<br>
                ${[
                  profile.companySite ? `<a href="${this.normalizarUrl(profile.companySite)}" style="color:#185fa5;font-size:7pt;">${profile.companySite}</a>` : '',
                  (profile.socialNetworkLabel && profile.socialNetworkUrl) ? `<a href="${this.normalizarUrl(profile.socialNetworkUrl)}" style="color:#185fa5;font-size:7pt;">${profile.socialNetworkLabel}</a>` : '',
                  profile.companyCnpj ? `CNPJ: ${profile.companyCnpj}` : '',
                ].filter(Boolean).join('&nbsp;·&nbsp;')}
              </div>
            </div>
          </div>
                </td>
              </tr>
            </tbody>
          </table>
      </body>
      </html>
    `;

    novaJanela.document.open();
    novaJanela.document.write(htmlContent);
    novaJanela.document.close();
    setTimeout(() => novaJanela.print(), 1500);
  }

  private gerarAvaliacaoManutencaoHtml(ativa: Vistoria): string {
    const texto = (ativa.avaliacaoManutencaoTexto && ativa.avaliacaoManutencaoTexto.trim())
      ? ativa.avaliacaoManutencaoTexto
      : this.sugerirAvaliacaoManutencao(ativa);
    return `
      <h2 class="sec-h" id="sec-11"><span class="sn">11.0</span>Avaliação da Manutenção e Uso</h2>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">${texto}</p>`;
  }

  private gerarAvaliacaoCriticidadeHtml(ativa: Vistoria): string {
    const todasFichas: { item: ChecklistItem; ficha: FichaDano }[] = [];
    (ativa.items ?? []).forEach(item => {
      (item.ocorrencias ?? []).forEach(ficha => todasFichas.push({ item, ficha }));
    });
    const p1 = todasFichas.filter(f => f.ficha.criticidade === 'P1').length;
    const p2 = todasFichas.filter(f => f.ficha.criticidade === 'P2').length;
    const p3 = todasFichas.filter(f => f.ficha.criticidade === 'P3').length;

    const texto = (ativa.avaliacaoCriticidadeTexto && ativa.avaliacaoCriticidadeTexto.trim())
      ? ativa.avaliacaoCriticidadeTexto
      : this.sugerirAvaliacaoCriticidade(ativa);

    const gridHtml = todasFichas.length > 0 ? `
      <div class="sintese-grid">
        <div class="sintese-card"><span class="big" style="color:#B23A48;">${p1}</span><span class="lbl">Prioridade 1</span></div>
        <div class="sintese-card"><span class="big" style="color:#B77D1A;">${p2}</span><span class="lbl">Prioridade 2</span></div>
        <div class="sintese-card"><span class="big" style="color:#6B7280;">${p3}</span><span class="lbl">Prioridade 3</span></div>
        <div class="sintese-card"><span class="big">${todasFichas.length}</span><span class="lbl">Total de Ocorrências</span></div>
      </div>` : '';

    return `
      <h2 class="sec-h" id="sec-12"><span class="sn">12.0</span>Avaliação do Grau de Criticidade</h2>
      ${gridHtml}
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">${texto}</p>
      <p style="font-size:8pt;color:#8A949C;">Matriz GUT: não aplicada nesta vistoria por decisão do Responsável
      Técnico, tendo em vista que a classificação por patamares de criticidade (P1/P2/P3) foi considerada
      suficiente para a priorização das ocorrências identificadas.</p>`;
  }

  private gerarConclusoesHtml(ativa: Vistoria): string {
    const sintese = (ativa.conclusaoSinteseTexto?.trim()) || this.sugerirConclusaoSintese(ativa);
    const riscos = (ativa.conclusaoRiscosTexto?.trim()) || this.sugerirConclusaoRiscos(ativa);
    const recomendacoes = (ativa.conclusaoRecomendacoesTexto?.trim()) || this.sugerirConclusaoRecomendacoes(ativa);
    const consideracoes = (ativa.conclusaoConsideracoesTexto?.trim()) || this.sugerirConclusaoConsideracoesFinais(ativa);

    return `
      <h2 class="sec-h" id="sec-13"><span class="sn">13.0</span>Conclusões e Considerações Finais</h2>
      <p style="margin-top:4mm;margin-bottom:1.5mm;font-weight:bold;font-size:9.5pt;color:#132A41;">13.1 Síntese Geral</p>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">${sintese}</p>
      <p style="margin-top:4mm;margin-bottom:1.5mm;font-weight:bold;font-size:9.5pt;color:#132A41;">13.2 Riscos Identificados</p>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">${riscos}</p>
      <p style="margin-top:4mm;margin-bottom:1.5mm;font-weight:bold;font-size:9.5pt;color:#132A41;">13.3 Recomendações Prioritárias</p>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">${recomendacoes}</p>
      <p style="margin-top:4mm;margin-bottom:1.5mm;font-weight:bold;font-size:9.5pt;color:#132A41;">13.4 Considerações Finais</p>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">${consideracoes}</p>`;
  }

  private gerarRelacaoAnexosHtml(ativa: Vistoria): string {
    interface LinhaAnexo { origem: string; anexo: Anexo }
    const linhas: LinhaAnexo[] = [];

    // Anamnese: SÓ documentos (não-imagem) — as imagens já são figuras na seção Anamnese
    for (const a of (ativa.anamnese?.anexos ?? [])) {
      if (!a.tipo.startsWith('image/')) {
        linhas.push({ origem: 'Anamnese', anexo: a });
      }
    }

    // Norteadores: TODOS os anexos (imagem e documento), pois não aparecem em outro lugar
    for (const doc of (ativa.documentosNorteadores ?? [])) {
      for (const a of (doc.anexos ?? [])) {
        linhas.push({ origem: `Norteador: ${doc.descricao}`, anexo: a });
      }
    }

    if (linhas.length === 0) {
      return `
        <div style="page-break-before:always;margin-top:8mm;page-break-inside:avoid;">
          <h2 class="sec-h" id="sec-14"><span class="sn">14.0</span>Relação de Anexos</h2>
          <p style="font-size:9pt;color:#6B7280;font-style:italic;margin-bottom:6mm;">
            Nenhum anexo (documento ou imagem) foi vinculado à Anamnese ou aos Documentos Norteadores desta vistoria.
          </p>
        </div>`;
    }

    const tipoLabel = (a: Anexo): string => {
      if (a.tipo.startsWith('image/')) return 'Imagem';
      const ext = (a.nome.split('.').pop() || '').toUpperCase();
      if (ext && ext.length <= 5) return ext;
      return (a.tipo.split('/').pop() || 'arquivo').toUpperCase();
    };

    const thS = 'background:#2C5AA0;color:#fff;padding:1.5mm 3mm;font-size:7.5pt;font-weight:700;text-align:left;border:1px solid #1a3f70;';
    const tdS = 'padding:1.5mm 3mm;font-size:8pt;border:1px solid #D8D0C6;vertical-align:top;';

    let linhasHtml = '';
    let isEven = false;
    for (let i = 0; i < linhas.length; i++) {
      const item = linhas[i];
      const bg = isEven ? '#F7F5F0' : '#ffffff';
      isEven = !isEven;

      const numStr = String(i + 1).padStart(2, '0');
      const descStr = item.anexo.legenda || item.anexo.nome;
      const sizeStr = this.formatarBytes(item.anexo.tamanho);
      const labelT = tipoLabel(item.anexo);

      linhasHtml += `
        <tr style="background:${bg}">
          <td style="${tdS}text-align:center;font-weight:600;width:5%;">${numStr}</td>
          <td style="${tdS}width:30%;font-weight:500;color:#1A2A38;">${item.origem}</td>
          <td style="${tdS}width:40%;">${descStr}</td>
          <td style="${tdS}width:12%;">${labelT}</td>
          <td style="${tdS}width:13%;font-family:monospace;font-size:7.5pt;">${sizeStr}</td>
        </tr>
      `;
    }

    return `
      <div style="page-break-before:always;margin-top:8mm;page-break-inside:avoid;">
        <h2 class="sec-h" id="sec-14"><span class="sn">14.0</span>Relação de Anexos</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:2mm;">
          <thead>
            <tr>
              <th style="${thS}text-align:center;width:5%;">Nº</th>
              <th style="${thS}width:30%;">Origem</th>
              <th style="${thS}width:40%;">Descrição</th>
              <th style="${thS}width:12%;">Tipo</th>
              <th style="${thS}width:13%;">Tamanho</th>
            </tr>
          </thead>
          <tbody>
            ${linhasHtml}
          </tbody>
        </table>
        <p style="font-size:7.5pt;color:#6B7280;font-style:italic;margin-top:2mm;">
          Os documentos acima integram o acervo digital desta inspeção e são disponibilizados em meio eletrônico junto a este relatório.
        </p>
      </div>
    `;
  }

  async carregarUrlsAnexos(): Promise<void> {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    // Libera URLs antigas
    const urlsAtuais = this.anexoUrls();
    Object.values(urlsAtuais).forEach(url => URL.revokeObjectURL(url));

    const novasUrls: Record<string, string> = {};
    const docs = ativa.documentosNorteadores ?? [];
    for (const doc of docs) {
      for (const anexo of doc.anexos) {
        if (anexo.tipo.startsWith('image/')) {
          const ab = await this.dbService.getAnexoBlob(anexo.id);
          if (ab) {
            novasUrls[anexo.id] = URL.createObjectURL(ab.blob);
          }
        }
      }
    }

    // Carrega também as imagens da Anamnese
    for (const anexo of (ativa.anamnese?.anexos ?? [])) {
      if (anexo.tipo.startsWith('image/')) {
        const ab = await this.dbService.getAnexoBlob(anexo.id);
        if (ab) {
          novasUrls[anexo.id] = URL.createObjectURL(ab.blob);
        }
      }
    }

    this.anexoUrls.set(novasUrls);
  }

  limparUrlsAnexos(): void {
    const urlsAtuais = this.anexoUrls();
    Object.values(urlsAtuais).forEach(url => URL.revokeObjectURL(url));
    this.anexoUrls.set({});
  }

  navegarParaNorteadores(): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) {
      this.toastService.show('Selecione uma vistoria ativa para acessar os Documentos Norteadores.', 'error');
      return;
    }
    // Inicializa a lista de norteadores se necessário (semeando)
    if (!ativa.documentosNorteadores || ativa.documentosNorteadores.length === 0) {
      const seedItems: DocumentoNorteador[] = SEED_NORTEADORES_RAW.map(item => ({
        id: crypto.randomUUID(),
        grupo: item.grupo,
        descricao: item.descricao,
        seed: true,
        disponibilidade: 'A_AVALIAR',
        anexos: []
      }));
      this.atualizarVistoriaAtiva({ documentosNorteadores: seedItems });
    }
    this.modoExibicao.set('NORTEADORES');
    void this.carregarUrlsAnexos();
  }

  voltarDeNorteadores(): void {
    this.limparUrlsAnexos();
    this.modoExibicao.set('EXECUCAO');
  }

  navegarParaAnamnese(): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) {
      this.toastService.show('Selecione uma vistoria ativa para acessar a Anamnese.', 'error');
      return;
    }
    if (!ativa.anamnese) {
      this.atualizarVistoriaAtiva({
        anamnese: { constatacoes: [], anexos: [] }
      });
    }
    this.modoExibicao.set('ANAMNESE');
    void this.carregarUrlsAnexos();
  }

  voltarDeAnamnese(): void {
    this.limparUrlsAnexos();
    this.modoExibicao.set('EXECUCAO');
  }

  async processarAnexoAnamnese(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    const novos: Anexo[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]; const id = crypto.randomUUID();
      await this.dbService.saveAnexoBlob({ id, blob: file, mimeType: file.type });
      novos.push({ id, nome: file.name, tipo: file.type, tamanho: file.size, dataUpload: new Date().toISOString() });
    }
    const base = ativa.anamnese ?? { constatacoes: [], anexos: [] };
    const listaAtual = Array.isArray(base.constatacoes) ? base.constatacoes : [];
    this.atualizarVistoriaAtiva({ anamnese: { ...base, constatacoes: listaAtual, anexos: [...base.anexos, ...novos] } });
    void this.carregarUrlsAnexos();
  }

  solicitarExcluirAnexoAnamnese(anexoId: string): void {
    if (this.anexoPendenteConfirmacaoExclusao() === anexoId) {
      void this.excluirAnexoAnamnese(anexoId);
      this.anexoPendenteConfirmacaoExclusao.set(null);
    } else {
      this.anexoPendenteConfirmacaoExclusao.set(anexoId);
      this.toastService.show('Clique novamente para confirmar a exclusão deste anexo.', 'info');
      setTimeout(() => {
        if (this.anexoPendenteConfirmacaoExclusao() === anexoId) this.anexoPendenteConfirmacaoExclusao.set(null);
      }, 3000);
    }
  }

  private async excluirAnexoAnamnese(anexoId: string): Promise<void> {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    await this.dbService.deleteAnexoBlob(anexoId);
    const base = ativa.anamnese ?? { constatacoes: [], anexos: [] };
    const listaAtual = Array.isArray(base.constatacoes) ? base.constatacoes : [];
    this.atualizarVistoriaAtiva({ anamnese: { ...base, constatacoes: listaAtual, anexos: base.anexos.filter(a => a.id !== anexoId) } });
    this.toastService.show('Anexo excluído com sucesso.', 'success');
    void this.carregarUrlsAnexos();
  }

  salvarLegendaAnexoAnamnese(anexoId: string, legenda: string): void {
    const ativa = this.vistoriaAtiva(); if (!ativa?.anamnese) return;
    const anexos = ativa.anamnese.anexos.map(a =>
      a.id === anexoId ? { ...a, legenda: legenda.trim() || undefined } : a
    );
    this.atualizarVistoriaAtiva({ anamnese: { ...ativa.anamnese, anexos } });
  }

  vincularAnexoConstatacao(anexoId: string, constatacaoId: string): void {
    const ativa = this.vistoriaAtiva(); if (!ativa?.anamnese) return;
    const anexos = ativa.anamnese.anexos.map(a =>
      a.id === anexoId ? { ...a, constatacaoId: constatacaoId || undefined } : a
    );
    this.atualizarVistoriaAtiva({ anamnese: { ...ativa.anamnese, anexos } });
  }

  rotuloConstatacaoBreve(c: Constatacao): string {
    const meta = this.metaConstatacao(c.tipo);
    const prefix = meta ? meta.rotulo : c.tipo;
    const desc = c.descricao || '';
    return `${prefix}: ${desc.slice(0, 40)}${desc.length > 40 ? '…' : ''}`;
  }

  limparRascunhoConstatacao(): void {
    this.novaConstatacaoDescricao.set('');
    this.novaConstatacaoNome.set('');
    this.novaConstatacaoIdentificacao.set('');
    this.novaConstatacaoData.set('');
    this.novaConstatacaoFonte.set('');
  }

  adicionarConstatacao(): void {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    const tipo = this.novaConstatacaoTipo();
    const descricao = this.novaConstatacaoDescricao().trim();

    if (!descricao) { this.toastService.show('Preencha o campo principal da constatação.', 'error'); return; }
    if (tipo === 'RELATO_OCUPANTE') {
      if (!this.novaConstatacaoNome().trim())          { this.toastService.show('Informe o nome do ocupante.', 'error'); return; }
      if (!this.novaConstatacaoIdentificacao().trim()) { this.toastService.show('Informe a identificação / vínculo do ocupante.', 'error'); return; }
    }
    if ((tipo === 'HISTORICO' || tipo === 'INTERVENCAO') && !this.novaConstatacaoData().trim()) {
      this.toastService.show('Informe a data / período.', 'error'); return;
    }
    if (tipo === 'PATOLOGIA_RECORRENTE' && !this.novaConstatacaoFonte().trim()) {
      this.toastService.show('Informe quem relatou / como foi verificada.', 'error'); return;
    }

    const nova: Constatacao = {
      id: crypto.randomUUID(),
      tipo,
      descricao,
      nomeOcupante:   tipo === 'RELATO_OCUPANTE' ? this.novaConstatacaoNome().trim() : undefined,
      identificacao:  tipo === 'RELATO_OCUPANTE' ? this.novaConstatacaoIdentificacao().trim() : undefined,
      data:           (tipo === 'HISTORICO' || tipo === 'INTERVENCAO') ? this.novaConstatacaoData().trim() : undefined,
      fonteRelato:    tipo === 'PATOLOGIA_RECORRENTE' ? this.novaConstatacaoFonte().trim() : undefined,
      dateCreated: new Date().toISOString(),
    };

    const base = ativa.anamnese ?? { constatacoes: [], anexos: [] };
    const listaAtual = Array.isArray(base.constatacoes) ? base.constatacoes : [];
    this.atualizarVistoriaAtiva({ anamnese: { ...base, constatacoes: [...listaAtual, nova] } });
    this.limparRascunhoConstatacao();
    this.toastService.show('Constatação adicionada.', 'success');
  }

  solicitarExcluirConstatacao(id: string): void {
    if (this.constatacaoPendenteConfirmacaoExclusao() === id) {
      this.excluirConstatacao(id);
      this.constatacaoPendenteConfirmacaoExclusao.set(null);
    } else {
      this.constatacaoPendenteConfirmacaoExclusao.set(id);
      this.toastService.show('Clique novamente para confirmar a exclusão.', 'info');
      setTimeout(() => {
        if (this.constatacaoPendenteConfirmacaoExclusao() === id) this.constatacaoPendenteConfirmacaoExclusao.set(null);
      }, 3000);
    }
  }

  private excluirConstatacao(id: string): void {
    const ativa = this.vistoriaAtiva(); if (!ativa) return;
    const base = ativa.anamnese ?? { constatacoes: [], anexos: [] };
    const listaAtual = Array.isArray(base.constatacoes) ? base.constatacoes : [];
    this.atualizarVistoriaAtiva({ anamnese: { ...base, constatacoes: listaAtual.filter(c => c.id !== id) } });
    this.toastService.show('Constatação excluída.', 'success');
  }

  adicionarDocumentoNorteador(): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const novoDoc: DocumentoNorteador = {
      id: crypto.randomUUID(),
      grupo: 'Itens adicionais',
      descricao: '',
      seed: false,
      disponibilidade: 'A_AVALIAR',
      anexos: []
    };

    const atualizados = [...(ativa.documentosNorteadores ?? []), novoDoc];
    this.atualizarVistoriaAtiva({ documentosNorteadores: atualizados });
    this.toastService.show('Novo documento norteador adicionado.', 'success');
  }

  salvarDescricaoNorteador(docId: string, descricao: string): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const atualizados = (ativa.documentosNorteadores ?? []).map(doc => {
      if (doc.id === docId) {
        return { ...doc, descricao };
      }
      return doc;
    });

    this.atualizarVistoriaAtiva({ documentosNorteadores: atualizados });
  }

  setDisponibilidade(docId: string, event: Event): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const select = event.target as HTMLSelectElement;
    const value = select.value as DisponibilidadeNorteador;

    const atualizados = (ativa.documentosNorteadores ?? []).map(doc => {
      if (doc.id === docId) {
        const updated = { ...doc, disponibilidade: value };
        if (value !== 'DD') {
          delete updated.conformidade;
        }
        return updated;
      }
      return doc;
    });

    this.atualizarVistoriaAtiva({ documentosNorteadores: atualizados });
  }

  setConformidade(docId: string, event: Event): void {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const select = event.target as HTMLSelectElement;
    const value = (select.value || undefined) as ConformidadeNorteador | undefined;

    const atualizados = (ativa.documentosNorteadores ?? []).map(doc => {
      if (doc.id === docId) {
        return { ...doc, conformidade: value };
      }
      return doc;
    });

    this.atualizarVistoriaAtiva({ documentosNorteadores: atualizados });
  }

  solicitarExcluirNorteador(docId: string): void {
    if (this.norteadorPendenteConfirmacaoExclusao() === docId) {
      this.excluirNorteador(docId);
      this.norteadorPendenteConfirmacaoExclusao.set(null);
    } else {
      this.norteadorPendenteConfirmacaoExclusao.set(docId);
      this.toastService.show('Clique novamente para confirmar a exclusão do documento norteador.', 'info');
      setTimeout(() => {
        if (this.norteadorPendenteConfirmacaoExclusao() === docId) {
          this.norteadorPendenteConfirmacaoExclusao.set(null);
        }
      }, 3000);
    }
  }

  private async excluirNorteador(docId: string): Promise<void> {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const docIndex = (ativa.documentosNorteadores ?? []).findIndex(doc => doc.id === docId);
    if (docIndex === -1) return;

    const doc = (ativa.documentosNorteadores ?? [])[docIndex];
    // Excluir os anexo blobs
    for (const anexo of doc.anexos) {
      await this.dbService.deleteAnexoBlob(anexo.id);
    }

    const atualizados = (ativa.documentosNorteadores ?? []).filter(d => d.id !== docId);
    this.atualizarVistoriaAtiva({ documentosNorteadores: atualizados });
    this.toastService.show('Documento norteador excluído com sucesso.', 'success');
    void this.carregarUrlsAnexos();
  }

  solicitarExcluirAnexo(docId: string, anexoId: string): void {
    if (this.anexoPendenteConfirmacaoExclusao() === anexoId) {
      void this.excluirAnexo(docId, anexoId);
      this.anexoPendenteConfirmacaoExclusao.set(null);
    } else {
      this.anexoPendenteConfirmacaoExclusao.set(anexoId);
      this.toastService.show('Clique novamente para confirmar a exclusão deste anexo.', 'info');
      setTimeout(() => {
        if (this.anexoPendenteConfirmacaoExclusao() === anexoId) {
          this.anexoPendenteConfirmacaoExclusao.set(null);
        }
      }, 3000);
    }
  }

  private async excluirAnexo(docId: string, anexoId: string): Promise<void> {
    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    // Excluir o blob do banco
    await this.dbService.deleteAnexoBlob(anexoId);

    const atualizados = (ativa.documentosNorteadores ?? []).map(doc => {
      if (doc.id === docId) {
        const novosAnexos = doc.anexos.filter(a => a.id !== anexoId);
        return { ...doc, anexos: novosAnexos };
      }
      return doc;
    });

    this.atualizarVistoriaAtiva({ documentosNorteadores: atualizados });
    this.toastService.show('Anexo excluído com sucesso.', 'success');
    void this.carregarUrlsAnexos();
  }

  async processarAnexoDocumento(docId: string, files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;

    const ativa = this.vistoriaAtiva();
    if (!ativa) return;

    const novosAnexosMetadados: Anexo[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = crypto.randomUUID();

      // Salvar o blob
      await this.dbService.saveAnexoBlob({
        id,
        blob: file,
        mimeType: file.type
      });

      const anexo: Anexo = {
        id,
        nome: file.name,
        tipo: file.type,
        tamanho: file.size,
        dataUpload: new Date().toISOString()
      };

      novosAnexosMetadados.push(anexo);
    }

    const atualizados = (ativa.documentosNorteadores ?? []).map(doc => {
      if (doc.id === docId) {
        return {
          ...doc,
          anexos: [...doc.anexos, ...novosAnexosMetadados]
        };
      }
      return doc;
    });

    this.atualizarVistoriaAtiva({ documentosNorteadores: atualizados });
    this.toastService.show(`${novosAnexosMetadados.length} anexo(s) adicionado(s) com sucesso.`, 'success');
    void this.carregarUrlsAnexos();
  }

  async carregarLaudosEmitidos(): Promise<void> {
    this.carregandoLaudos.set(true);
    try {
      const lista = await this.dbService.getAllLaudosEmitidos();
      lista.sort((a, b) => b.numeroEmissao - a.numeroEmissao); // mais recente primeiro
      this.laudosEmitidos.set(lista);
    } finally {
      this.carregandoLaudos.set(false);
    }
  }

  verDetalhesLaudo(laudo: LaudoEmitido): void {
    this.laudoSelecionado.set(laudo);
    this.modoExibicao.set('DETALHE_LAUDO');
  }

  voltarDeDetalheLaudo(): void {
    this.laudoSelecionado.set(null);
    this.modoExibicao.set('LISTA');
  }

  formatarDataEmissao(dataIso: string): string {
    if (!dataIso) return '';
    try {
      return new Date(dataIso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dataIso;
    }
  }

  normalizarUrl(url?: string): string {
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  normalizarTel(tel?: string): string {
    if (!tel) return '';
    return tel.replace(/[^\d+]/g, '');
  }

  formatarBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
