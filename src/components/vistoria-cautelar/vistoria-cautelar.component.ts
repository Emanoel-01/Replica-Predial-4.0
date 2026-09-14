import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, WritableSignal, Input, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VistoriaDbService } from '../../services/vistoria-db.service';
import { ToastService } from '../../services/toast.service';
import { GeminiService, registroValido } from '../../services/gemini.service';
import { SyncService } from '../../services/sync.service';
import { TourService } from '../../services/tour.service';
import { FotoObra, DadosCaracterizacao } from '../../models/caracterizacao.model';
import { GeradorCaracterizacaoComponent } from '../gerador-caracterizacao/gerador-caracterizacao.component';
import { UserProfile } from '../../models/user-profile.model';

// ═══════════════════════════════════════════════════════════════════
// VISTORIA CAUTELAR DE VIZINHANÇA — MODELO DE DADOS
// Norma de Vistoria Cautelar de Vizinhança do IBAPE/SP — 2025
// ABNT NBR 13752:2024, item 7.3.3.2 (Vistoria de Constatação)
//
// REGRA CRÍTICA — NÃO REMOVER ESTE AVISO:
// Por se tratar de Vistoria de Constatação, é PROIBIDO adicionar a este modelo
// qualquer campo de causa, responsabilidade ou solução (ex.: causaProvavel,
// recomendacaoTecnica, criticidade, matriz GUT, dinâmica de fissura, origem de
// infiltração). Ver OcorrenciaCautelar abaixo para a lista explícita de proibições.
// ═══════════════════════════════════════════════════════════════════

// ─── Listas fixas ───

export const ELEMENTOS_CONSTRUTIVOS = [
  'Piso', 'Paredes', 'Forros', 'Portas', 'Janelas', 'Pinturas',
  'Cobertas', 'Instalações Elétricas', 'Instalações Sanitárias',
  'Instalações Especiais',
] as const;
export type ElementoConstrutivo = typeof ELEMENTOS_CONSTRUTIVOS[number];

export const TIPOLOGIAS_CAUTELAR = [
  'Residencial', 'Comercial', 'Industrial', 'Hospitalar', 'Educacional',
] as const;
export type TipologiaCautelar = typeof TIPOLOGIAS_CAUTELAR[number];

export const AMBIENTES_POR_TIPOLOGIA: Record<TipologiaCautelar, string[]> = {
  Residencial: ['Hall de Entrada', 'Sala de Estar', 'Sala de Jantar', 'Cozinha',
    'Área de Serviço', 'Banheiro Social', 'Quarto 1', 'Quarto 2', 'Quarto 3',
    'Banheiro Suíte', 'Varanda', 'Garagem', 'Fachada', 'Telhado', 'Paredes Externas'],
  Comercial: ['Recepção', 'Sala de Reuniões', 'Escritórios', 'Copa/Refeitório',
    'Banheiros', 'Depósito', 'Estacionamento', 'Fachada', 'Área de Circulação',
    'Elevadores', 'Escadas', 'Paredes Externas'],
  Industrial: ['Portaria', 'Área de Produção', 'Depósito/Almoxarifado', 'Expedição',
    'Vestiários', 'Refeitório', 'Escritório Administrativo', 'Pátio Externo',
    'Cobertura', 'Estrutura Metálica', 'Paredes Externas', 'Pisos Industriais'],
  Hospitalar: ['Recepção', 'Salas de Atendimento', 'Enfermarias', 'Centro Cirúrgico',
    'Farmácia', 'Laboratório', 'Banheiros Adaptados', 'Circulação', 'Elevadores',
    'Escadas', 'Fachada', 'Área de Resíduos'],
  Educacional: ['Salas de Aula', 'Biblioteca', 'Laboratórios', 'Quadra Esportiva',
    'Refeitório', 'Cozinha', 'Banheiros', 'Secretaria', 'Diretoria', 'Pátio',
    'Corredores', 'Fachada', 'Paredes Externas'],
};
// Usuário pode adicionar ambiente customizado além da lista, por imóvel (implementado no VC-6a).

export type FamiliaAbertura = 'FISSURA' | 'TRINCA' | 'RACHADURA' | 'FENDA' | 'BRECHA';

/**
 * Classifica a abertura measured (em mm) na família correspondente, seguindo a escala
 * normativa. Limite superior de cada faixa é EXCLUSIVO — não há sobreposição:
 *   < 0.50            → FISSURA
 *   0.50 ≤ x < 1.00    → TRINCA
 *   1.00 ≤ x < 5.00    → RACHADURA
 *   5.00 ≤ x < 10.00   → FENDA
 *   x ≥ 10.00          → BRECHA
 */
export function classificarAbertura(mm: number): FamiliaAbertura {
  if (mm < 0.50) return 'FISSURA';
  if (mm < 1.00) return 'TRINCA';
  if (mm < 5.00) return 'RACHADURA';
  if (mm < 10.00) return 'FENDA';
  return 'BRECHA';
}

export type OutraManifestacao =
  'INFILTRACAO' | 'UMIDADE' | 'MOFO_BOLOR' | 'DESCOLAMENTO' | 'EFLORESCENCIA'
  | 'CORROSAO_OXIDACAO' | 'DESGASTE_DETERIORACAO' | 'EMPENAMENTO_DEFORMACAO'
  | 'DESPLACAMENTO' | 'MAU_FUNCIONAMENTO' | 'OBSTRUCAO' | 'OUTRO';

/**
 * Manifestações cabíveis por elemento construtivo. Usado para restringir as
 * opções do select "Outra manifestação" no formulário de ocorrência, conforme
 * o elemento construtivo selecionado — evita listar, por exemplo, "Infiltração"
 * como opção para "Instalações Elétricas".
 */
export const MANIFESTACOES_POR_ELEMENTO: Record<ElementoConstrutivo, OutraManifestacao[]> = {
  'Piso': ['DESCOLAMENTO', 'DESGASTE_DETERIORACAO', 'EMPENAMENTO_DEFORMACAO', 'UMIDADE', 'OUTRO'],
  'Paredes': ['INFILTRACAO', 'UMIDADE', 'MOFO_BOLOR', 'EFLORESCENCIA', 'DESCOLAMENTO', 'DESPLACAMENTO', 'DESGASTE_DETERIORACAO', 'OUTRO'],
  'Forros': ['INFILTRACAO', 'UMIDADE', 'MOFO_BOLOR', 'DESCOLAMENTO', 'DESPLACAMENTO', 'EMPENAMENTO_DEFORMACAO', 'OUTRO'],
  'Portas': ['EMPENAMENTO_DEFORMACAO', 'DESGASTE_DETERIORACAO', 'CORROSAO_OXIDACAO', 'MAU_FUNCIONAMENTO', 'OUTRO'],
  'Janelas': ['EMPENAMENTO_DEFORMACAO', 'DESGASTE_DETERIORACAO', 'CORROSAO_OXIDACAO', 'MAU_FUNCIONAMENTO', 'INFILTRACAO', 'OUTRO'],
  'Pinturas': ['DESCOLAMENTO', 'DESPLACAMENTO', 'DESGASTE_DETERIORACAO', 'MOFO_BOLOR', 'UMIDADE', 'OUTRO'],
  'Cobertas': ['INFILTRACAO', 'UMIDADE', 'DESGASTE_DETERIORACAO', 'CORROSAO_OXIDACAO', 'OBSTRUCAO', 'OUTRO'],
  'Instalações Elétricas': ['MAU_FUNCIONAMENTO', 'CORROSAO_OXIDACAO', 'DESGASTE_DETERIORACAO', 'OUTRO'],
  'Instalações Sanitárias': ['INFILTRACAO', 'UMIDADE', 'MAU_FUNCIONAMENTO', 'OBSTRUCAO', 'CORROSAO_OXIDACAO', 'OUTRO'],
  'Instalações Especiais': ['MAU_FUNCIONAMENTO', 'DESGASTE_DETERIORACAO', 'CORROSAO_OXIDACAO', 'OUTRO'],
};

export type TipoConstatacaoCautelar = 'ANOMALIA' | 'MANIFESTACAO_PATOLOGICA' | 'FALHA';

export type EstadoConservacaoCautelar = 'OTIMO' | 'BOM' | 'REGULAR' | 'MAL_CONSERVADO';

export type PosicaoRelativaObra =
  'CONFRONTANTE_LATERAL_DIREITA' | 'CONFRONTANTE_LATERAL_ESQUERDA' |
  'CONFRONTANTE_FUNDOS' | 'CONFRONTANTE_FRENTE' | 'TRANSVERSAL_RAIO';

export type StatusAutorizacao = 'AUTORIZADO' | 'AUTORIZADO_PARCIAL' | 'NEGADO';

export type StatusImovelCautelar = 'A_AGENDAR' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'ACESSO_NEGADO';

export const CARACTERISTICAS_OBSERVADAS = [
  'BORDAS_VIVAS',
  'BORDAS_DESGASTADAS',
  'SUJIDADE_NO_INTERIOR',
  'AUSENCIA_DE_SUJIDADE',
  'PINTURA_CONTINUA_SOBRE_A_ABERTURA',
  'PINTURA_INTERROMPIDA_PELA_ABERTURA',
  'PRESENCA_DE_EFLORESCENCIA',
  'PRESENCA_DE_OXIDACAO',
  'DESTACAMENTO_DE_MATERIAL',
  'UMIDADE_APARENTE_NO_MOMENTO',
  'AUSENCIA_DE_UMIDADE_NO_MOMENTO',
  'REPARO_APARENTE_ANTERIOR',
] as const;

export type CaracteristicaObservada = typeof CARACTERISTICAS_OBSERVADAS[number];

// ─── Estruturas principais ───

export interface OcorrenciaCautelar {
  id: string;                               // crypto.randomUUID()
  elementoConstrutivo: ElementoConstrutivo;
  tipoConstatacao: TipoConstatacaoCautelar;
  familiaAbertura?: FamiliaAbertura;         // se for da família fissura→brecha
  aberturaMm?: number;                        // classifica familiaAbertura via classificarAbertura()
  extensaoCm?: number;                         // extensão linear aproximada, quando aplicável
  dimensoesCm?: { largura: number; altura: number };  // área afetada, para manchas e destacamentos
  caracteristicasObservadas?: CaracteristicaObservada[];  // constatação física, nunca juízo de idade
  outraManifestacao?: OutraManifestacao;      // se não for da família de abertura
  outraManifestacaoDescricao?: string;        // obrigatório se outraManifestacao === 'OUTRO'
  descricao: string;
  descricaoEstruturada?: {
    oQueSeVe: string;                          // aparência, sem causa e sem idade
    ondeNoElemento: string;                    // posição precisa dentro do elemento construtivo
  };
  fotos: string[];                            // ids de Evidencia (store 'evidencias' já existente)
  geolocalizacao?: { lat: number; lng: number } | null;
  audioTranscrito?: string;
  localizacaoNoAmbiente: string;
  testemunhoInstalado?: boolean;              // registro de FATO: selo de gesso/vidro foi instalado
  fotoTestemunho?: string;                    // id de Evidencia, obrigatória se testemunhoInstalado === true
  sugestaoIA?: {
    elementoConstrutivo?: ElementoConstrutivo;
    tipoConstatacao?: TipoConstatacaoCautelar;
    descricaoSugerida?: string;
    confirmadaPeloUsuario: boolean;
  };
  // ⛔ PROIBIDO — nunca adicionar estes campos a esta interface, mesmo que sugerido depois:
  //    causaProvavel, recomendacaoTecnica, criticidade, gut, dinamicaFissura
  //    (estabilizada/ativa), origemInfiltracao (ascendente/descendente/percussiva),
  //    ou qualquer campo que implique nexo causal entre a obra e a ocorrência.
}

export interface AmbienteCautelar {
  id: string;                                 // crypto.randomUUID()
  nome: string;
  fotos: string[];                            // ≥1 SEMPRE — validado na UI (VC-6a), mesmo sem ocorrência
  ocorrencias: OcorrenciaCautelar[];
}

export interface AutorizacaoAcesso {
  status: StatusAutorizacao;
  anexoTermo?: string;                        // id de AnexoBlob
  dataContatoPrevio?: string;
  meioContato?: 'TELEFONE' | 'EMAIL' | 'PESSOAL';
  ambientesRestritos?: string;                 // texto livre — só quando status === 'AUTORIZADO_PARCIAL'
  recusa?: {
    data: string;
    formaNotificacao: 'CORREIOS' | 'CARTORIO';
    anexoComprovante?: string;                 // id de AnexoBlob
    fotoFachadaExterna?: string;                // id de Evidencia — registro externo, não depende de autorização
  };
}

export interface AssinaturasCautelar {
  vistoriador: { nome: string; registro: string; artRrt: string; anexoArtRrt?: string; imagemAssinatura?: string };
  ocupante?: { nome: string; documento: string; imagemAssinatura?: string };
  corresponsavelTecnico?: {                    // GENÉRICO — não vinculado ao Programa Anjo
    nome: string; registro: string; artRrt: string;
    imagemAssinatura?: string; revisaoDocumentada: boolean;
  };
}

export interface ElementosNivel3 {
  fachadas: boolean; coberturas: boolean; telhados: boolean;
  captacaoAguasPluviais: boolean; pisosExternos: boolean;
  vegetacaoCursosDagua: boolean; usoRPA: boolean;
  observacoes?: string;
}

export interface InstrumentacaoComplementar {   // OPCIONAL, extra-normativo
  fissurometros?: string; pinosRecalque?: string; inclinometros?: string;
}

export interface LaudoImovelVizinho {
  id: string;                                 // crypto.randomUUID()
  status: StatusImovelCautelar;
  endereco: string;
  autorizacaoAcesso: AutorizacaoAcesso;
  posicaoRelativaObra?: PosicaoRelativaObra;
  afastamentoDivisaMetros?: number;
  dadosImovel: {
    ocupante?: string; idadeEstimada?: string; tipologia: TipologiaCautelar;
    padraoConstrutivo?: string; pavimentos?: number; usoOcupacao?: string;
  };
  caracteristicasConstrutivas: {
    estrutura?: string; cobertura?: string; contencao?: string; vedacoesVerticais?: string;
  };
  estadoConservacao: { classificacao: EstadoConservacaoCautelar; fonteNormativa: string };
  ambientes: AmbienteCautelar[];
  elementosNivel3?: ElementosNivel3;           // só se VistoriaCautelar.nivelVistoriaCautelar === '3'
  instrumentacaoComplementar?: InstrumentacaoComplementar;
  assinaturas: AssinaturasCautelar;
  dataVistoria?: string;
}

export interface VistoriaCautelar {
  id: string;                                 // crypto.randomUUID()
  solicitante: { nome: string; cnpjCpf: string; endereco: string; responsavelLegal?: string };
  obraGeradora: {
    nome: string; endereco: string; fundacao?: string; estrutura?: string;
    logisticaCanteiro?: string; impactosVizinhanca?: string;
    fotos?: FotoObra[];
  };
  momentoVistoria: 'PRE_DEMOLICAO' | 'PRE_MOVIMENTACAO_TERRA';
  areaInfluencia: {
    croqui?: string;                           // id de AnexoBlob
    raio?: string;
    memorialJustificativo?: string;
    estudosPreviosConsiderados?: string;
  };
  nivelVistoriaCautelar: '1' | '2' | '3';       // campo PRÓPRIO — não usar nivelInspecao
  canteiroObras: { fotosExternas: string[]; fotosInternas: string[] };
  marcoTemporal: 'ASSINATURA_DIGITAL' | 'REGISTRO_CARTORIO';
  imoveis: LaudoImovelVizinho[];
  responsavelTecnicoId?: string;
  dateCreated: string;
  dateUpdated: string;
  sincronizadoEm?: string;
  cloudId?: string;
}

export interface LaudoCautelarEmitido {
  id: string;                                 // crypto.randomUUID()
  numeroEmissao: number;                        // sequencial global, contador próprio
  snapshotVistoria: VistoriaCautelar;           // cópia congelada e imutável
  snapshotProfile: any;
  taxaCalculada: number;                        // Anexo I (piso/rampa/platô/teto)
  dataEmissao: string;
}

@Component({
  selector: 'app-vistoria-cautelar',
  templateUrl: './vistoria-cautelar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, GeradorCaracterizacaoComponent],
})
export class VistoriaCautelarComponent implements OnInit {
  @Input() profile: UserProfile | null = null;
  @Input('isLoggedIn') isUserLoggedIn = false;

  isLoggedIn(): boolean {
    return this.isUserLoggedIn;
  }

  readonly ELEMENTOS_CONSTRUTIVOS = ELEMENTOS_CONSTRUTIVOS;
  readonly CARACTERISTICAS_OBSERVADAS = CARACTERISTICAS_OBSERVADAS;

  readonly OPCOES_ESTRUTURA = [
    'Concreto armado convencional',
    'Alvenaria estrutural',
    'Estrutura metálica',
    'Estrutura de madeira',
    'Pré-moldado de concreto',
    'Misto (concreto + alvenaria estrutural)',
    'Não identificado / não visível',
  ];

  readonly OPCOES_COBERTURA = [
    'Telha cerâmica sobre estrutura de madeira',
    'Telha metálica (zinco/alumínio)',
    'Telha de fibrocimento',
    'Laje impermeabilizada (cobertura plana)',
    'Telha shingle',
    'Estrutura metálica com telha sanduíche',
    'Não identificado / não visível',
  ];

  readonly OPCOES_CONTENCAO = [
    'Sem elemento de contenção aparente',
    'Muro de arrimo em concreto armado',
    'Muro de arrimo em alvenaria de pedra',
    'Cortina atirantada',
    'Gabião',
    'Talude natural sem contenção',
    'Não identificado / não visível',
  ];

  readonly OPCOES_VEDACOES_VERTICAIS = [
    'Alvenaria de blocos cerâmicos',
    'Alvenaria de blocos de concreto',
    'Alvenaria estrutural',
    'Drywall / gesso acartonado',
    'Painéis pré-moldados',
    'Vidro (fachada cortina)',
    'Não identificado / não visível',
  ];

  private dbService = inject(VistoriaDbService);
  private toastService = inject(ToastService);
  private geminiService = inject(GeminiService);
  private syncService = inject(SyncService);
  public tourService = inject(TourService);

  constructor() {
    effect(() => {
      const isAtivo = this.tourService.isTourAtivo();
      const passo = this.tourService.passoAtual();
      if (!isAtivo || !passo) return;

      if (passo.view === 'cautelar') {
        const passosCriacao = [
          'cautelar-solicitante',
          'cautelar-obra-geradora'
        ];
        const passosDetalhe = [
          'cautelar-painel-status',
          'cautelar-adicionar-imovel',
          'cautelar-lista-imoveis',
          'cautelar-consolidar'
        ];
        const passosImovel = [
          'imovel-intro',
          'imovel-autorizacao-acesso',
          'imovel-dados',
          'imovel-caracteristicas',
          'imovel-estado-conservacao',
          'imovel-checklist-ambientes',
          'imovel-assinaturas'
        ];

        if (passo.acaoAoEntrar === 'abrir-detalhe-imovel-demo' || passosImovel.includes(passo.id)) {
          const lista = this.todasVistoriasCautelares();
          if (lista.length > 0) {
            if (!this.vistoriaAtiva()) {
              this.abrirDetalhe(lista[0].id);
            }
            const vistoria = this.vistoriaAtiva();
            if (vistoria && vistoria.imoveis && vistoria.imoveis.length > 0) {
              if (this.modoExibicao() !== 'DETALHE_IMOVEL' || !this.imovelEmEdicao()) {
                this.abrirDetalheImovel(vistoria.imoveis[0].id);
              }
            } else {
              // Sem imóveis cadastrados: pula todo o bloco de imóveis e vai para o orçamento
              this.tourService.pularAte('orcamento-intro');
            }
          } else {
            this.tourService.pularAte('orcamento-intro');
          }
        } else if (passosCriacao.includes(passo.id) || passo.acaoAoEntrar === 'abrir-criacao-cautelar') {
          if (this.modoExibicao() !== 'CRIACAO') {
            this.abrirCriacao();
          }
        } else if (passosDetalhe.includes(passo.id) || passo.acaoAoEntrar === 'abrir-detalhe-cautelar-demo') {
          const lista = this.todasVistoriasCautelares();
          if (lista.length > 0) {
            if (!this.vistoriaAtiva()) {
              this.abrirDetalhe(lista[0].id);
            } else if (this.modoExibicao() !== 'DETALHE') {
              this.modoExibicao.set('DETALHE');
            }
          } else {
            // Sem vistoria cautelar cadastrada: pula até o orçamento
            this.tourService.pularAte('orcamento-intro');
          }
        } else if (['cautelar-intro', 'cautelar-sincronizar', 'cautelar-nova-vistoria'].includes(passo.id)) {
          if (this.modoExibicao() !== 'LISTA') {
            this.modoExibicao.set('LISTA');
          }
        }
      }
    });
  }

  modoExibicao = signal<'LISTA' | 'CRIACAO' | 'DETALHE' | 'DETALHE_IMOVEL'>('LISTA');
  todasVistoriasCautelares = signal<VistoriaCautelar[]>([]);
  vistoriaAtivaId = signal<string | null>(null);
  vistoriaEmEdicaoId = signal<string | null>(null);
  vistoriaEmSincronizacaoId = signal<string | null>(null);
  sincronizandoTudo = signal(false);
  imovelPendenteConfirmacaoExclusao = signal<string | null>(null);
  vistoriaParaExcluir = signal<VistoriaCautelar | null>(null);
  excluindoVistoria = signal(false);

  // ─── Campos do formulário (Solicitante) ───
  novoSolicitanteNome = signal('');
  novoSolicitanteCnpjCpf = signal('');
  novoSolicitanteEndereco = signal('');
  novoSolicitanteResponsavelLegal = signal('');

  // ─── Campos do formulário (Obra Geradora) ───
  novaObraNome = signal('');
  novaObraEndereco = signal('');
  novaObraFundacao = signal('');
  novaObraEstrutura = signal('');
  novaObraLogisticaCanteiro = signal('');
  novaObraImpactosVizinhanca = signal('');
  novaObraFotos = signal<FotoObra[]>([]);

  // ─── Momento e nível ───
  novoMomentoVistoria = signal<'PRE_DEMOLICAO' | 'PRE_MOVIMENTACAO_TERRA'>('PRE_MOVIMENTACAO_TERRA');
  novoNivelVistoriaCautelar = signal<'1' | '2' | '3'>('2');

  // ─── Área de influência ───
  novaAreaRaio = signal('');
  novaAreaMemorialJustificativo = signal('');
  novaAreaEstudosPrevios = signal('');
  novaAreaCroqui = signal<string | null>(null);

  isGeradorCaracterizacaoOpen = signal(false);

  abrirGeradorCaracterizacao(): void {
    this.isGeradorCaracterizacaoOpen.set(true);
  }

  dadosIniciaisParaGerador(): Partial<DadosCaracterizacao> {
    const raioNum = parseFloat(this.novaAreaRaio().replace(/[^\d.]/g, ''));
    return {
      denominacao: this.novaObraNome(),
      endereco: this.novaObraEndereco(),
      sistemaEstrutural: this.novaObraEstrutura(),
      sistemaFundacao: this.novaObraFundacao(),
      perimetroMetros: !isNaN(raioNum) && raioNum > 0 ? raioNum : 50,
      mapaBase64: this.novaAreaCroqui() ?? undefined,
      fotos: this.novaObraFotos(),
    };
  }

  aplicarDadosDoGerador(dados: DadosCaracterizacao): void {
    if (dados.endereco) this.novaObraEndereco.set(dados.endereco);
    if (dados.denominacao && !this.novaObraNome()) this.novaObraNome.set(dados.denominacao);
    if (dados.perimetroMetros) this.novaAreaRaio.set(`${dados.perimetroMetros}m`);
    if (dados.mapaBase64) this.novaAreaCroqui.set(dados.mapaBase64);
    if (dados.fotos && dados.fotos.length > 0) {
      this.novaObraFotos.set([...dados.fotos]);
    }
    this.isGeradorCaracterizacaoOpen.set(false);
    this.toastService.show('Localização e mapa da Obra Geradora aplicados com sucesso!', 'success');
  }

  // ─── Canteiro de obras (fotos) ───
  novoCanteiroFotosExternas = signal<string[]>([]);
  novoCanteiroFotosInternas = signal<string[]>([]);

  // ─── Marco temporal ───
  novoMarcoTemporal = signal<'ASSINATURA_DIGITAL' | 'REGISTRO_CARTORIO'>('ASSINATURA_DIGITAL');

  // ─── VC-4: Lista de imóveis + busca/filtro ───
  filtroImovelTexto = signal('');
  filtroImovelStatus = signal<'TODOS' | StatusImovelCautelar>('TODOS');
  imoveisFiltrados = computed(() => {
    const vistoria = this.vistoriaAtiva();
    if (!vistoria) return [];
    const texto = this.filtroImovelTexto().toLowerCase().trim();
    const status = this.filtroImovelStatus();
    return vistoria.imoveis.filter(im => {
      const matchTexto = !texto || im.endereco.toLowerCase().includes(texto);
      const matchStatus = status === 'TODOS' || im.status === status;
      return matchTexto && matchStatus;
    });
  });

  // ─── VC-4: Modal de adicionar imóvel ───
  modalAdicionarImovelAberto = signal(false);
  novoImovelEndereco = signal('');
  novoImovelTipologia = signal<TipologiaCautelar>('Residencial');

  // ─── VC-4: Painel de autorização de acesso (imóvel selecionado) ───
  imovelEmEdicaoId = signal<string | null>(null);
  modalAutorizacaoAberto = signal(false);
  edAutorizacaoStatus = signal<StatusAutorizacao>('AUTORIZADO');
  edDataContatoPrevio = signal('');
  edMeioContato = signal<'TELEFONE' | 'EMAIL' | 'PESSOAL'>('TELEFONE');
  edAnexoTermo = signal<string | null>(null);
  edAmbientesRestritos = signal('');
  edRecusaData = signal('');
  edRecusaFormaNotificacao = signal<'CORREIOS' | 'CARTORIO'>('CORREIOS');
  edRecusaAnexoComprovante = signal<string | null>(null);
  edRecusaFotoFachada = signal<string | null>(null);

  // ─── VC-5: Dados do imóvel ───
  edImovelEndereco = signal('');
  edImovelOcupante = signal('');
  edImovelIdadeEstimada = signal('');
  edImovelPadraoConstrutivo = signal('');
  edImovelPavimentos = signal('');
  edImovelUsoOcupacao = signal('');
  edImovelPosicaoRelativa = signal<PosicaoRelativaObra | ''>('');
  edImovelAfastamentoDivisa = signal('');
  edImovelDataVistoria = signal('');
  edImovelEstrutura = signal('');
  edImovelCobertura = signal('');
  edImovelContencao = signal('');
  edImovelVedacoesVerticais = signal('');
  edImovelEstadoConservacao = signal<EstadoConservacaoCautelar>('BOM');

  // ─── VC-7: Elementos do Nível 3 ───
  edNivel3Fachadas = signal(false);
  edNivel3Coberturas = signal(false);
  edNivel3Telhados = signal(false);
  edNivel3CaptacaoAguasPluviais = signal(false);
  edNivel3PisosExternos = signal(false);
  edNivel3VegetacaoCursosDagua = signal(false);
  edNivel3UsoRPA = signal(false);
  edNivel3Observacoes = signal('');

  // ─── VC-7: Instrumentação complementar (opcional) ───
  edInstrumFissurometros = signal('');
  edInstrumPinosRecalque = signal('');
  edInstrumInclinometros = signal('');

  // ─── VC-8: Assinaturas ───
  edAssVistoriadorArtRrt = signal('');
  edAnexoArtRrt = signal<string | null>(null);

  edAssOcupanteNome = signal('');
  edAssOcupanteDocumento = signal('');

  edAssTemCorresponsavel = signal(false);
  edAssCorresponsavelNome = signal('');
  edAssCorresponsavelRegistro = signal('');
  edAssCorresponsavelArtRrt = signal('');
  edAssCorresponsavelRevisaoDocumentada = signal(false);

  private gerarInstrucoesUsoHtml(): string {
    return `
      <h2 class="sec-h" id="sec-5"><span class="sn">5.0</span>Instruções e Recomendações de Uso do Laudo</h2>
      <p>A Vistoria Cautelar de Vizinhança e o presente Relatório constituem peças fundamentais
      para salvaguardar os interesses dos ocupantes — proprietários, inquilinos ou possuidores —
      dos imóveis situados na área de influência da obra geradora, assim como dos incorporadores
      e construtores responsáveis pelo empreendimento.</p>
      <p>Recomenda-se a entrega de uma via do presente Relatório ao responsável por cada imóvel
      vistoriado, mediante assinatura de recibo de recebimento, mantendo-se cópia em poder do
      responsável técnico e do responsável pela obra geradora.</p>
      <p>É de suma importância que os ocupantes dos imóveis vistoriados sejam orientados a
      comunicar aos responsáveis técnicos ou legais do empreendimento o eventual surgimento de
      novas ocorrências no decorrer da execução da obra, de modo a permitir o devido
      acompanhamento e a atualização do histórico do imóvel.</p>
    `;
  }

  // ─── VC-9a/VC-10: Painel de consolidação & Pré-visualização Lado a Lado ───
  modalConsolidacaoAberto = signal(false);
  modalRevisaoCamposAberto = signal(false);
  modalImpedimentosCautelarAberto = signal(false);
  impedimentosCautelar = signal<string[]>([]);
  camposCurtosParaRevisao = signal<string[]>([]);
  modalPreviewPdfAberto = signal(false);
  pdfPreviewHtmlContent = signal('');
  pdfPreviewNumeroDocumento = signal('');
  pdfPreviewDocumentoRegistrado = signal(false);
  pdfPreviewZoom = signal(100);
  carregandoPreviewPdf = signal(false);

  fecharPreviewPDF(): void {
    this.modalPreviewPdfAberto.set(false);
  }

  ajustarZoomPreview(delta: number): void {
    this.pdfPreviewZoom.update(z => Math.min(180, Math.max(50, z + delta)));
  }

  resetarZoomPreview(): void {
    this.pdfPreviewZoom.set(100);
  }

  imprimirPDFDoPreview(): void {
    const html = this.pdfPreviewHtmlContent();
    if (!html) return;
    const novaJanela = window.open('', '_blank');
    if (!novaJanela) {
      this.toastService.show('Popup bloqueado. Permita popups para este site e tente novamente.', 'error');
      return;
    }
    novaJanela.document.write(html);
    novaJanela.document.close();
    setTimeout(() => novaJanela.print(), 800);
  }

  abrirPDFEmNovaAba(): void {
    const html = this.pdfPreviewHtmlContent();
    if (!html) return;
    const novaJanela = window.open('', '_blank');
    if (!novaJanela) {
      this.toastService.show('Popup bloqueado. Permita popups para este site e tente novamente.', 'error');
      return;
    }
    novaJanela.document.write(html);
    novaJanela.document.close();
  }

  pendenciasFotoDaObra = computed(() => {
    const vistoria = this.vistoriaAtiva();
    if (!vistoria) return [];
    return vistoria.imoveis
      .map(im => ({ endereco: im.endereco, ambientesSemFoto: this.ambientesSemFotoDoImovel(im) }))
      .filter(p => p.ambientesSemFoto.length > 0);
  });

  imoveisProntosParaConsolidar = computed(() => {
    const vistoria = this.vistoriaAtiva();
    if (!vistoria) return false;
    if (vistoria.imoveis.length === 0) return false;
    const statusOk = vistoria.imoveis.every(im => im.status === 'CONCLUIDO' || im.status === 'ACESSO_NEGADO');
    if (!statusOk) return false;
    return this.pendenciasFotoDaObra().length === 0;
  });

  resumoStatusImoveis = computed(() => {
    const vistoria = this.vistoriaAtiva();
    if (!vistoria) return { total: 0, concluidos: 0, negados: 0, pendentes: 0 };
    const imoveis = vistoria.imoveis;
    return {
      total: imoveis.length,
      concluidos: imoveis.filter(i => i.status === 'CONCLUIDO').length,
      negados: imoveis.filter(i => i.status === 'ACESSO_NEGADO').length,
      pendentes: imoveis.filter(i => i.status === 'A_AGENDAR' || i.status === 'EM_ANDAMENTO').length,
    };
  });

  // ─── VC-6a: Checklist de ambientes ───
  ambientesInicializados = signal(false);
  novoAmbienteNomeCustom = signal('');
  ambienteEmFocoId = signal<string | null>(null);

  // ─── VC-6b-i: Modal de registro de ocorrência ───
  modalOcorrenciaAberto = signal(false);
  ambienteDaOcorrenciaId = signal<string | null>(null);
  ocorrenciaEmEdicaoId = signal<string | null>(null); // null = nova ocorrência

  edOcElementoConstrutivo = signal<ElementoConstrutivo>('Paredes');
  edOcTipoConstatacao = signal<TipoConstatacaoCautelar>('ANOMALIA');
  edOcUsaFamiliaAbertura = signal(true); // toggle: abertura em mm vs. outra manifestação
  edOcAberturaMm = signal('');
  edOcOutraManifestacao = signal<OutraManifestacao>('INFILTRACAO');
  edOcOutraManifestacaoDescricao = signal('');
  edOcDescricao = signal('');
  edOcLocalizacaoNoAmbiente = signal('');
  edOcFotos = signal<string[]>([]);
  edOcTestemunhoInstalado = signal(false);
  edOcFotoTestemunho = signal<string | null>(null);

  // ─── VC-6b-ii: Gravação de voz ───
  gravandoAudio = signal(false);
  transcrevendoAudio = signal(false);
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  // ─── VC-6b-ii: Sugestão por IA ───
  sugerindoIA = signal(false);
  sugestaoIAPendente = signal<{
    elementoConstrutivo?: ElementoConstrutivo;
    tipoConstatacao?: TipoConstatacaoCautelar;
    descricaoSugerida?: string;
  } | null>(null);
  private sugestaoIAAplicadaNestaSessao: { elementoConstrutivo?: ElementoConstrutivo; tipoConstatacao?: TipoConstatacaoCautelar; descricaoSugerida?: string } | null = null;

  // Classificação automática, recalculada a cada digitação de mm
  edOcFamiliaCalculada = computed<FamiliaAbertura | null>(() => {
    const mm = parseFloat(this.edOcAberturaMm());
    if (isNaN(mm) || mm < 0) return null;
    return classificarAbertura(mm);
  });

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

  async onFotoObraChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const atuais = this.novaObraFotos();
    const max = 6;
    const restante = max - atuais.length;
    if (restante <= 0) {
      this.toastService.show('Máximo de 6 fotos/projetos atingido.', 'info');
      return;
    }
    for (const file of files.slice(0, restante)) {
      if (!file.type.startsWith('image/')) continue;
      await new Promise<void>(res => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          const compressed = await this.comprimirImagem(dataUrl, 900, 0.78);
          this.novaObraFotos.update(arr => [
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

  removerFotoObra(index: number): void {
    this.novaObraFotos.update(arr => arr.filter((_, i) => i !== index));
  }

  atualizarLegendaFotoObra(index: number, legenda: string): void {
    this.novaObraFotos.update(arr => arr.map((f, i) => i === index ? { ...f, legenda: legenda.trim() || undefined } : f));
  }

  async ngOnInit(): Promise<void> {
    await this.carregarVistorias();
  }

  async carregarVistorias(): Promise<void> {
    const todas = await this.dbService.getAllVistoriasCautelares();
    this.todasVistoriasCautelares.set(
      todas.sort((a, b) => new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime())
    );
  }

  abrirCriacao(): void {
    this.vistoriaEmEdicaoId.set(null);
    this.novoSolicitanteNome.set('');
    this.novoSolicitanteCnpjCpf.set('');
    this.novoSolicitanteEndereco.set('');
    this.novoSolicitanteResponsavelLegal.set('');
    this.novaObraNome.set('');
    this.novaObraEndereco.set('');
    this.novaObraFundacao.set('');
    this.novaObraEstrutura.set('');
    this.novaObraLogisticaCanteiro.set('');
    this.novaObraImpactosVizinhanca.set('');
    this.novaObraFotos.set([]);
    this.novoMomentoVistoria.set('PRE_MOVIMENTACAO_TERRA');
    this.novoNivelVistoriaCautelar.set('2');
    this.novaAreaRaio.set('');
    this.novaAreaMemorialJustificativo.set('');
    this.novaAreaEstudosPrevios.set('');
    this.novoCanteiroFotosExternas.set([]);
    this.novoCanteiroFotosInternas.set([]);
    this.novoMarcoTemporal.set('ASSINATURA_DIGITAL');
    this.modoExibicao.set('CRIACAO');
  }

  async abrirEdicaoObraGeradora(id: string): Promise<void> {
    try {
      const laudosEmitidos = await this.dbService.getAllLaudosCautelaresEmitidos();
      const possuiLaudo = laudosEmitidos.some(l => l.snapshotVistoria?.id === id);
      if (possuiLaudo) {
        this.toastService.show('Esta vistoria já possui laudo emitido e não pode ter os dados da obra alterados.', 'info');
        return;
      }
    } catch (e) {
      console.warn('Não foi possível verificar laudos emitidos:', e);
    }

    const vistoria = this.todasVistoriasCautelares().find(v => v.id === id);
    if (!vistoria) return;

    this.novoSolicitanteNome.set(vistoria.solicitante.nome || '');
    this.novoSolicitanteCnpjCpf.set(vistoria.solicitante.cnpjCpf || '');
    this.novoSolicitanteEndereco.set(vistoria.solicitante.endereco || '');
    this.novoSolicitanteResponsavelLegal.set(vistoria.solicitante.responsavelLegal || '');

    this.novaObraNome.set(vistoria.obraGeradora.nome || '');
    this.novaObraEndereco.set(vistoria.obraGeradora.endereco || '');
    this.novaObraFundacao.set(vistoria.obraGeradora.fundacao || '');
    this.novaObraEstrutura.set(vistoria.obraGeradora.estrutura || '');
    this.novaObraLogisticaCanteiro.set(vistoria.obraGeradora.logisticaCanteiro || '');
    this.novaObraImpactosVizinhanca.set(vistoria.obraGeradora.impactosVizinhanca || '');
    this.novaObraFotos.set(vistoria.obraGeradora.fotos ?? []);

    this.novoMomentoVistoria.set(vistoria.momentoVistoria || 'PRE_MOVIMENTACAO_TERRA');
    this.novoNivelVistoriaCautelar.set(vistoria.nivelVistoriaCautelar || '2');

    this.novaAreaRaio.set(vistoria.areaInfluencia?.raio || '');
    this.novaAreaMemorialJustificativo.set(vistoria.areaInfluencia?.memorialJustificativo || '');
    this.novaAreaEstudosPrevios.set(vistoria.areaInfluencia?.estudosPreviosConsiderados || '');
    this.novaAreaCroqui.set(vistoria.areaInfluencia?.croqui ?? null);

    this.novoCanteiroFotosExternas.set(vistoria.canteiroObras?.fotosExternas || []);
    this.novoCanteiroFotosInternas.set(vistoria.canteiroObras?.fotosInternas || []);

    this.novoMarcoTemporal.set(vistoria.marcoTemporal || 'ASSINATURA_DIGITAL');

    this.vistoriaEmEdicaoId.set(id);
    this.modoExibicao.set('CRIACAO');
  }

  cancelarCriacao(): void {
    const editandoId = this.vistoriaEmEdicaoId();
    this.vistoriaEmEdicaoId.set(null);
    this.novoSolicitanteNome.set('');
    this.novoSolicitanteCnpjCpf.set('');
    this.novoSolicitanteEndereco.set('');
    this.novoSolicitanteResponsavelLegal.set('');
    this.novaObraNome.set('');
    this.novaObraEndereco.set('');
    this.novaObraFundacao.set('');
    this.novaObraEstrutura.set('');
    this.novaObraLogisticaCanteiro.set('');
    this.novaObraImpactosVizinhanca.set('');
    this.novaObraFotos.set([]);
    this.novoMomentoVistoria.set('PRE_MOVIMENTACAO_TERRA');
    this.novoNivelVistoriaCautelar.set('2');
    this.novaAreaRaio.set('');
    this.novaAreaMemorialJustificativo.set('');
    this.novaAreaEstudosPrevios.set('');
    this.novaAreaCroqui.set(null);
    this.novoCanteiroFotosExternas.set([]);
    this.novoCanteiroFotosInternas.set([]);
    this.novoMarcoTemporal.set('ASSINATURA_DIGITAL');

    if (editandoId) {
      this.modoExibicao.set('DETALHE');
    } else {
      this.modoExibicao.set('LISTA');
    }
  }

  podeSalvarObra(): boolean {
    return !!(this.novoSolicitanteNome() && this.novoSolicitanteCnpjCpf()
      && this.novaObraNome() && this.novaObraEndereco());
  }

  async salvarVistoriaCautelar(): Promise<void> {
    if (!this.isLoggedIn()) {
      this.toastService.show('Faça login para criar e salvar uma vistoria cautelar. Você pode continuar explorando o tour guiado sem login.', 'info');
      return;
    }
    if (!this.podeSalvarObra()) {
      this.toastService.show('Preencha ao menos Solicitante e Obra Geradora antes de salvar.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    const editandoId = this.vistoriaEmEdicaoId();

    if (editandoId) {
      const vistoriaExistente = this.todasVistoriasCautelares().find(v => v.id === editandoId);
      if (!vistoriaExistente) {
        this.toastService.show('Vistoria não encontrada para atualização.', 'error');
        return;
      }

      const atualizada: VistoriaCautelar = {
        ...vistoriaExistente,
        solicitante: {
          nome: this.novoSolicitanteNome(),
          cnpjCpf: this.novoSolicitanteCnpjCpf(),
          endereco: this.novoSolicitanteEndereco(),
          responsavelLegal: this.novoSolicitanteResponsavelLegal() || undefined,
        },
        obraGeradora: {
          nome: this.novaObraNome(),
          endereco: this.novaObraEndereco(),
          fundacao: this.novaObraFundacao() || undefined,
          estrutura: this.novaObraEstrutura() || undefined,
          logisticaCanteiro: this.novaObraLogisticaCanteiro() || undefined,
          impactosVizinhanca: this.novaObraImpactosVizinhanca() || undefined,
          fotos: this.novaObraFotos(),
        },
        momentoVistoria: this.novoMomentoVistoria(),
        areaInfluencia: {
          croqui: this.novaAreaCroqui() || undefined,
          raio: this.novaAreaRaio() || undefined,
          memorialJustificativo: this.novaAreaMemorialJustificativo() || undefined,
          estudosPreviosConsiderados: this.novaAreaEstudosPrevios() || undefined,
        },
        nivelVistoriaCautelar: this.novoNivelVistoriaCautelar(),
        canteiroObras: {
          fotosExternas: this.novoCanteiroFotosExternas(),
          fotosInternas: this.novoCanteiroFotosInternas(),
        },
        marcoTemporal: this.novoMarcoTemporal(),
        dateUpdated: nowIso,
      };

      await this.dbService.salvarVistoriaCautelar(atualizada);
      await this.carregarVistorias();
      this.vistoriaAtivaId.set(atualizada.id);
      this.vistoriaEmEdicaoId.set(null);
      this.toastService.show('Dados da obra atualizados com sucesso.', 'success');
      this.modoExibicao.set('DETALHE');
      return;
    }

    const vistoria: VistoriaCautelar = {
      id: crypto.randomUUID(),
      solicitante: {
        nome: this.novoSolicitanteNome(),
        cnpjCpf: this.novoSolicitanteCnpjCpf(),
        endereco: this.novoSolicitanteEndereco(),
        responsavelLegal: this.novoSolicitanteResponsavelLegal() || undefined,
      },
      obraGeradora: {
        nome: this.novaObraNome(),
        endereco: this.novaObraEndereco(),
        fundacao: this.novaObraFundacao() || undefined,
        estrutura: this.novaObraEstrutura() || undefined,
        logisticaCanteiro: this.novaObraLogisticaCanteiro() || undefined,
        impactosVizinhanca: this.novaObraImpactosVizinhanca() || undefined,
        fotos: this.novaObraFotos(),
      },
      momentoVistoria: this.novoMomentoVistoria(),
      areaInfluencia: {
        croqui: this.novaAreaCroqui() || undefined,
        raio: this.novaAreaRaio() || undefined,
        memorialJustificativo: this.novaAreaMemorialJustificativo() || undefined,
        estudosPreviosConsiderados: this.novaAreaEstudosPrevios() || undefined,
      },
      nivelVistoriaCautelar: this.novoNivelVistoriaCautelar(),
      canteiroObras: {
        fotosExternas: this.novoCanteiroFotosExternas(),
        fotosInternas: this.novoCanteiroFotosInternas(),
      },
      marcoTemporal: this.novoMarcoTemporal(),
      imoveis: [],
      dateCreated: nowIso,
      dateUpdated: nowIso,
    };
    await this.dbService.salvarVistoriaCautelar(vistoria);
    await this.carregarVistorias();
    this.toastService.show('Vistoria Cautelar criada. Agora adicione os imóveis da área de influência.', 'success');
    this.modoExibicao.set('LISTA');
  }

  async removerImovel(imovelId: string, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    const vistoria = this.vistoriaAtiva();
    if (!vistoria) return;

    if (this.imovelPendenteConfirmacaoExclusao() === imovelId) {
      const imoveisAtualizados = vistoria.imoveis.filter(im => im.id !== imovelId);
      const atualizada: VistoriaCautelar = {
        ...vistoria,
        imoveis: imoveisAtualizados,
        dateUpdated: new Date().toISOString(),
      };
      await this.dbService.salvarVistoriaCautelar(atualizada);
      await this.carregarVistorias();
      this.imovelPendenteConfirmacaoExclusao.set(null);
      this.toastService.show('Imóvel removido da vistoria.', 'info');

      if (this.imovelEmEdicaoId() === imovelId) {
        this.fecharDetalheImovel();
      }
    } else {
      this.imovelPendenteConfirmacaoExclusao.set(imovelId);
      setTimeout(() => {
        if (this.imovelPendenteConfirmacaoExclusao() === imovelId) {
          this.imovelPendenteConfirmacaoExclusao.set(null);
        }
      }, 3000);
    }
  }

  abrirDetalhe(id: string): void {
    this.vistoriaAtivaId.set(id);
    this.pdfPreviewHtmlContent.set('');
    this.pdfPreviewNumeroDocumento.set('');
    this.pdfPreviewDocumentoRegistrado.set(false);
    this.modalPreviewPdfAberto.set(false);
    this.modoExibicao.set('DETALHE');
  }

  vistoriaAtiva(): VistoriaCautelar | undefined {
    return this.todasVistoriasCautelares().find(v => v.id === this.vistoriaAtivaId());
  }

  solicitarExclusaoVistoria(event: Event, v: VistoriaCautelar): void {
    event.stopPropagation();
    this.vistoriaParaExcluir.set(v);
  }

  cancelarExclusaoVistoria(): void {
    this.vistoriaParaExcluir.set(null);
  }

  async confirmarExclusaoVistoria(): Promise<void> {
    const alvo = this.vistoriaParaExcluir();
    if (!alvo) return;

    this.excluindoVistoria.set(true);
    const removidaNaNuvem = await this.syncService.excluirVistoriaCautelarNaNuvem(alvo.id);

    if (!removidaNaNuvem) {
      this.excluindoVistoria.set(false);
      this.toastService.show(
        'Não foi possível remover a obra na nuvem. A exclusão foi cancelada para evitar que ela retorne em outra sincronização.',
        'error'
      );
      return;
    }

    await this.dbService.deleteVistoriaCautelar(alvo.id);
    await this.carregarVistorias();

    this.excluindoVistoria.set(false);
    this.vistoriaParaExcluir.set(null);
    this.toastService.show('Obra e imóveis vistoriados excluídos.', 'info');
  }

  async sincronizarNuvem(event?: Event, vistoriaAlvo?: VistoriaCautelar): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    const target = vistoriaAlvo || this.vistoriaAtiva();
    if (!target) {
      this.toastService.show('Nenhuma vistoria cautelar selecionada para salvar na nuvem.', 'error');
      return;
    }

    this.vistoriaEmSincronizacaoId.set(target.id);
    const sucesso = await this.syncService.salvarVistoriaCautelarNaNuvem(target);
    this.vistoriaEmSincronizacaoId.set(null);

    if (sucesso) {
      this.toastService.show('Vistoria cautelar salva na nuvem com sucesso.', 'success');
      await this.carregarVistorias();
    } else {
      this.toastService.show('Não foi possível salvar na nuvem. Verifique sua conexão e se está autenticado.', 'error');
    }
  }

  async sincronizarTodasDaNuvem(): Promise<void> {
    this.sincronizandoTudo.set(true);
    try {
      const res = await this.syncService.baixarVistoriasCautelaresDaNuvem();
      if (res.erro) {
        this.toastService.show(res.erro, 'error');
      } else {
        await this.carregarVistorias();
        const total = res.baixadas + res.atualizadas;
        if (total > 0) {
          this.toastService.show(`${total} registro(s) cautelar(es) sincronizado(s) da nuvem.`, 'success');
        } else {
          this.toastService.show('Tudo atualizado com a nuvem.', 'info');
        }
      }
    } finally {
      this.sincronizandoTudo.set(false);
    }
  }

  imovelEmEdicao(): LaudoImovelVizinho | undefined {
    return this.vistoriaAtiva()?.imoveis.find(i => i.id === this.imovelEmEdicaoId());
  }

  abrirModalAdicionarImovel(): void {
    this.novoImovelEndereco.set('');
    this.novoImovelTipologia.set('Residencial');
    this.modalAdicionarImovelAberto.set(true);
  }

  async confirmarAdicionarImovel(): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    if (!vistoria || !this.novoImovelEndereco().trim()) {
      this.toastService.show('Informe o endereço do imóvel.', 'error');
      return;
    }
    const novoImovel: LaudoImovelVizinho = {
      id: crypto.randomUUID(),
      status: 'A_AGENDAR',
      endereco: this.novoImovelEndereco().trim(),
      autorizacaoAcesso: { status: 'AUTORIZADO' },
      dadosImovel: { tipologia: this.novoImovelTipologia() },
      caracteristicasConstrutivas: {},
      estadoConservacao: { classificacao: 'BOM', fonteNormativa: 'VEIU_IUP_IBAPE_SP' },
      ambientes: [],
      assinaturas: {
        vistoriador: {
          nome: this.profile?.fullName || '',
          registro: this.profile?.professionalId || '',
          artRrt: '',
        },
      },
    };
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: [...vistoria.imoveis, novoImovel],
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
    this.modalAdicionarImovelAberto.set(false);
    this.toastService.show('Imóvel adicionado à obra.', 'success');
  }

  abrirAutorizacaoAcesso(imovelId: string): void {
    const imovel = this.vistoriaAtiva()?.imoveis.find(i => i.id === imovelId);
    if (!imovel) return;
    this.imovelEmEdicaoId.set(imovelId);
    const auth = imovel.autorizacaoAcesso;
    this.edAutorizacaoStatus.set(auth.status);
    this.edDataContatoPrevio.set(auth.dataContatoPrevio ?? '');
    this.edMeioContato.set(auth.meioContato ?? 'TELEFONE');
    this.edAnexoTermo.set(auth.anexoTermo ?? null);
    this.edAmbientesRestritos.set(auth.ambientesRestritos ?? '');
    this.edRecusaData.set(auth.recusa?.data ?? '');
    this.edRecusaFormaNotificacao.set(auth.recusa?.formaNotificacao ?? 'CORREIOS');
    this.edRecusaAnexoComprovante.set(auth.recusa?.anexoComprovante ?? null);
    this.edRecusaFotoFachada.set(auth.recusa?.fotoFachadaExterna ?? null);
    this.modalAutorizacaoAberto.set(true);
  }

  fecharAutorizacaoAcesso(): void {
    this.modalAutorizacaoAberto.set(false);
  }

  private async processarArquivoParaDataUrl(event: Event, destino: (v: string) => void): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const compressed = await this.comprimirImagem(dataUrl, 900, 0.78);
      destino(compressed);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onAnexoTermoChange(event: Event): void {
    this.processarArquivoParaDataUrl(event, v => this.edAnexoTermo.set(v));
  }

  onRecusaComprovanteChange(event: Event): void {
    this.processarArquivoParaDataUrl(event, v => this.edRecusaAnexoComprovante.set(v));
  }

  onRecusaFotoFachadaChange(event: Event): void {
    this.processarArquivoParaDataUrl(event, v => this.edRecusaFotoFachada.set(v));
  }

  async onAnexoArtRrtChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (file.type.startsWith('image/')) {
        const compressed = await this.comprimirImagem(dataUrl, 1200, 0.85);
        this.edAnexoArtRrt.set(compressed);
      } else {
        this.edAnexoArtRrt.set(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  async salvarAutorizacaoAcesso(): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovelId = this.imovelEmEdicaoId();
    if (!vistoria || !imovelId) return;

    const status = this.edAutorizacaoStatus();
    const autorizacaoAcesso: AutorizacaoAcesso = {
      status,
      dataContatoPrevio: this.edDataContatoPrevio() || undefined,
      meioContato: this.edMeioContato(),
      anexoTermo: status !== 'NEGADO' ? (this.edAnexoTermo() ?? undefined) : undefined,
      ambientesRestritos: status === 'AUTORIZADO_PARCIAL' ? this.edAmbientesRestritos() : undefined,
      recusa: status === 'NEGADO' ? {
        data: this.edRecusaData(),
        formaNotificacao: this.edRecusaFormaNotificacao(),
        anexoComprovante: this.edRecusaAnexoComprovante() ?? undefined,
        fotoFachadaExterna: this.edRecusaFotoFachada() ?? undefined,
      } : undefined,
    };

    const novoStatusImovel: StatusImovelCautelar =
      status === 'NEGADO' ? 'ACESSO_NEGADO' : 'EM_ANDAMENTO';

    const imoveisAtualizados = vistoria.imoveis.map(im =>
      im.id === imovelId ? { ...im, autorizacaoAcesso, status: novoStatusImovel } : im
    );
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: imoveisAtualizados,
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
    this.modalAutorizacaoAberto.set(false);
    this.toastService.show('Autorização de acesso registrada.', 'success');
  }

  corStatusImovel(status: StatusImovelCautelar): string {
    switch (status) {
      case 'A_AGENDAR': return 'bg-slate-100 text-slate-600';
      case 'EM_ANDAMENTO': return 'bg-amber-50 text-amber-700';
      case 'CONCLUIDO': return 'bg-emerald-50 text-emerald-700';
      case 'ACESSO_NEGADO': return 'bg-red-50 text-red-700';
    }
  }

  labelStatusImovel(status: StatusImovelCautelar): string {
    switch (status) {
      case 'A_AGENDAR': return 'A agendar';
      case 'EM_ANDAMENTO': return 'Em andamento';
      case 'CONCLUIDO': return 'Concluído';
      case 'ACESSO_NEGADO': return 'Acesso negado';
    }
  }

  abrirDetalheImovel(imovelId: string): void {
    const imovel = this.vistoriaAtiva()?.imoveis.find(i => i.id === imovelId);
    if (!imovel) return;
    this.imovelEmEdicaoId.set(imovelId);
    this.edImovelEndereco.set(imovel.endereco ?? '');
    this.edImovelOcupante.set(imovel.dadosImovel.ocupante ?? '');
    this.edImovelIdadeEstimada.set(imovel.dadosImovel.idadeEstimada ?? '');
    this.edImovelPadraoConstrutivo.set(imovel.dadosImovel.padraoConstrutivo ?? '');
    this.edImovelPavimentos.set(imovel.dadosImovel.pavimentos != null ? String(imovel.dadosImovel.pavimentos) : '');
    this.edImovelUsoOcupacao.set(imovel.dadosImovel.usoOcupacao ?? '');
    this.edImovelPosicaoRelativa.set(imovel.posicaoRelativaObra ?? '');
    this.edImovelAfastamentoDivisa.set(imovel.afastamentoDivisaMetros != null ? String(imovel.afastamentoDivisaMetros) : '');
    this.edImovelDataVistoria.set(imovel.dataVistoria ?? '');
    this.edImovelEstrutura.set(imovel.caracteristicasConstrutivas.estrutura ?? '');
    this.edImovelCobertura.set(imovel.caracteristicasConstrutivas.cobertura ?? '');
    this.edImovelContencao.set(imovel.caracteristicasConstrutivas.contencao ?? '');
    this.edImovelVedacoesVerticais.set(imovel.caracteristicasConstrutivas.vedacoesVerticais ?? '');
    this.edImovelEstadoConservacao.set(imovel.estadoConservacao.classificacao);

    const nivel3 = imovel.elementosNivel3;
    this.edNivel3Fachadas.set(nivel3?.fachadas ?? false);
    this.edNivel3Coberturas.set(nivel3?.coberturas ?? false);
    this.edNivel3Telhados.set(nivel3?.telhados ?? false);
    this.edNivel3CaptacaoAguasPluviais.set(nivel3?.captacaoAguasPluviais ?? false);
    this.edNivel3PisosExternos.set(nivel3?.pisosExternos ?? false);
    this.edNivel3VegetacaoCursosDagua.set(nivel3?.vegetacaoCursosDagua ?? false);
    this.edNivel3UsoRPA.set(nivel3?.usoRPA ?? false);
    this.edNivel3Observacoes.set(nivel3?.observacoes ?? '');

    const instrum = imovel.instrumentacaoComplementar;
    this.edInstrumFissurometros.set(instrum?.fissurometros ?? '');
    this.edInstrumPinosRecalque.set(instrum?.pinosRecalque ?? '');
    this.edInstrumInclinometros.set(instrum?.inclinometros ?? '');

    const ass = imovel.assinaturas;
    this.edAssVistoriadorArtRrt.set(ass?.vistoriador?.artRrt ?? '');
    this.edAnexoArtRrt.set((ass as any)?.vistoriador?.anexoArtRrt ?? null);
    this.edAssOcupanteNome.set(ass?.ocupante?.nome ?? '');
    this.edAssOcupanteDocumento.set(ass?.ocupante?.documento ?? '');
    this.edAssTemCorresponsavel.set(!!ass?.corresponsavelTecnico);
    this.edAssCorresponsavelNome.set(ass?.corresponsavelTecnico?.nome ?? '');
    this.edAssCorresponsavelRegistro.set(ass?.corresponsavelTecnico?.registro ?? '');
    this.edAssCorresponsavelArtRrt.set(ass?.corresponsavelTecnico?.artRrt ?? '');
    this.edAssCorresponsavelRevisaoDocumentada.set(ass?.corresponsavelTecnico?.revisaoDocumentada ?? false);

    this.garantirAmbientesPadrao();
    this.modoExibicao.set('DETALHE_IMOVEL');
  }

  mostrarCampoOutro(valorAtual: string, opcoes: string[]): boolean {
    return !!valorAtual && !opcoes.includes(valorAtual);
  }

  opcaoSelecionadaOuOutro(valorAtual: string, opcoes: string[]): string {
    if (!valorAtual) return '';
    return opcoes.includes(valorAtual) ? valorAtual : '__OUTRO__';
  }

  onSelecionarCaracteristica(valorSelect: string, signalCampo: WritableSignal<string>, opcoes: string[]): void {
    if (valorSelect === '__OUTRO__') {
      if (!signalCampo() || opcoes.includes(signalCampo())) {
        signalCampo.set(' ');
      }
    } else {
      signalCampo.set(valorSelect);
    }
  }

  fecharDetalheImovel(): void {
    this.imovelEmEdicaoId.set(null);
    this.modoExibicao.set('DETALHE');
  }

  imovelEhNivel3(): boolean {
    return this.vistoriaAtiva()?.nivelVistoriaCautelar === '3';
  }

  imovelExigeAssinaturaOcupante(): boolean {
    const status = this.imovelEmEdicao()?.autorizacaoAcesso.status;
    return status === 'AUTORIZADO' || status === 'AUTORIZADO_PARCIAL';
  }

  async salvarDadosImovel(): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovelId = this.imovelEmEdicaoId();
    if (!vistoria || !imovelId) return;

    if (!this.edImovelEndereco().trim()) {
      this.toastService.show('Informe o endereço do imóvel.', 'error');
      return;
    }

    const pavimentosNum = this.edImovelPavimentos() ? Number(this.edImovelPavimentos()) : undefined;
    const afastamentoNum = this.edImovelAfastamentoDivisa() ? Number(this.edImovelAfastamentoDivisa()) : undefined;

    const imoveisAtualizados = vistoria.imoveis.map(im => {
      if (im.id !== imovelId) return im;
      return {
        ...im,
        endereco: this.edImovelEndereco().trim(),
        posicaoRelativaObra: this.edImovelPosicaoRelativa() || undefined,
        afastamentoDivisaMetros: afastamentoNum,
        dataVistoria: this.edImovelDataVistoria() || undefined,
        dadosImovel: {
          ...im.dadosImovel,
          ocupante: this.edImovelOcupante() || undefined,
          idadeEstimada: this.edImovelIdadeEstimada() || undefined,
          padraoConstrutivo: this.edImovelPadraoConstrutivo() || undefined,
          pavimentos: pavimentosNum,
          usoOcupacao: this.edImovelUsoOcupacao() || undefined,
        },
        caracteristicasConstrutivas: {
          estrutura: this.edImovelEstrutura()?.trim() || undefined,
          cobertura: this.edImovelCobertura()?.trim() || undefined,
          contencao: this.edImovelContencao()?.trim() || undefined,
          vedacoesVerticais: this.edImovelVedacoesVerticais()?.trim() || undefined,
        },
        estadoConservacao: {
          classificacao: this.edImovelEstadoConservacao(),
          fonteNormativa: 'VEIU_IUP_IBAPE_SP' as const,
        },
        elementosNivel3: this.imovelEhNivel3() ? {
          fachadas: this.edNivel3Fachadas(),
          coberturas: this.edNivel3Coberturas(),
          telhados: this.edNivel3Telhados(),
          captacaoAguasPluviais: this.edNivel3CaptacaoAguasPluviais(),
          pisosExternos: this.edNivel3PisosExternos(),
          vegetacaoCursosDagua: this.edNivel3VegetacaoCursosDagua(),
          usoRPA: this.edNivel3UsoRPA(),
          observacoes: this.edNivel3Observacoes() || undefined,
        } : undefined,
        instrumentacaoComplementar: (this.edInstrumFissurometros() || this.edInstrumPinosRecalque() || this.edInstrumInclinometros()) ? {
          fissurometros: this.edInstrumFissurometros() || undefined,
          pinosRecalque: this.edInstrumPinosRecalque() || undefined,
          inclinometros: this.edInstrumInclinometros() || undefined,
        } : undefined,
        assinaturas: {
          vistoriador: {
            nome: this.profile?.fullName || '',
            registro: this.profile?.professionalId || '',
            artRrt: this.edAssVistoriadorArtRrt(),
            anexoArtRrt: this.edAnexoArtRrt() || undefined,
          },
          ocupante: (this.edAssOcupanteNome() || this.edAssOcupanteDocumento()) ? {
            nome: this.edAssOcupanteNome(),
            documento: this.edAssOcupanteDocumento(),
          } : undefined,
          corresponsavelTecnico: this.edAssTemCorresponsavel() ? {
            nome: this.edAssCorresponsavelNome(),
            registro: this.edAssCorresponsavelRegistro(),
            artRrt: this.edAssCorresponsavelArtRrt(),
            revisaoDocumentada: this.edAssCorresponsavelRevisaoDocumentada(),
          } : undefined,
        },
      };
    });
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: imoveisAtualizados,
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
    this.toastService.show('Dados do imóvel salvos.', 'success');
  }

  labelPosicaoRelativa(pos: PosicaoRelativaObra | ''): string {
    switch (pos) {
      case 'CONFRONTANTE_LATERAL_DIREITA': return 'Confrontante lateral direita';
      case 'CONFRONTANTE_LATERAL_ESQUERDA': return 'Confrontante lateral esquerda';
      case 'CONFRONTANTE_FUNDOS': return 'Confrontante de fundos';
      case 'CONFRONTANTE_FRENTE': return 'Confrontante de frente';
      case 'TRANSVERSAL_RAIO': return 'Transversal (raio)';
      default: return '—';
    }
  }

  ambientesDoImovel(): AmbienteCautelar[] {
    return this.imovelEmEdicao()?.ambientes ?? [];
  }

  /**
   * Garante que a lista de ambientes do imóvel em edição já tenha os ambientes
   * padrão da tipologia carregados. Chamado ao entrar na tela de detalhe do
   * imóvel (item 3 abaixo). Só popula uma vez — se o usuário já tiver ambientes
   * salvos (inclusive customizados ou de sessão anterior), não sobrescreve.
   */
  async garantirAmbientesPadrao(): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovel = this.imovelEmEdicao();
    if (!vistoria || !imovel) return;
    if (imovel.ambientes.length > 0) return; // já tem ambientes, não mexe

    const tipologia = imovel.dadosImovel.tipologia;
    const nomesPadrao = AMBIENTES_POR_TIPOLOGIA[tipologia] ?? [];
    const novosAmbientes: AmbienteCautelar[] = nomesPadrao.map(nome => ({
      id: crypto.randomUUID(),
      nome,
      fotos: [],
      ocorrencias: [],
    }));

    const imoveisAtualizados = vistoria.imoveis.map(im =>
      im.id === imovel.id ? { ...im, ambientes: novosAmbientes } : im
    );
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: imoveisAtualizados,
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
  }

  async adicionarAmbienteCustomizado(): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovel = this.imovelEmEdicao();
    const nome = this.novoAmbienteNomeCustom().trim();
    if (!vistoria || !imovel || !nome) return;

    const novoAmbiente: AmbienteCautelar = {
      id: crypto.randomUUID(),
      nome,
      fotos: [],
      ocorrencias: [],
    };
    const imoveisAtualizados = vistoria.imoveis.map(im =>
      im.id === imovel.id ? { ...im, ambientes: [...im.ambientes, novoAmbiente] } : im
    );
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: imoveisAtualizados,
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
    this.novoAmbienteNomeCustom.set('');
  }

  async onFotoAmbienteChange(event: Event, ambienteId: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const compressed = await this.comprimirImagem(dataUrl, 900, 0.78);

      const vistoria = this.vistoriaAtiva();
      const imovel = this.imovelEmEdicao();
      if (!vistoria || !imovel) return;

      const imoveisAtualizados = vistoria.imoveis.map(im => {
        if (im.id !== imovel.id) return im;
        const ambientesAtualizados = im.ambientes.map(amb =>
          amb.id === ambienteId ? { ...amb, fotos: [...amb.fotos, compressed] } : amb
        );
        return { ...im, ambientes: ambientesAtualizados };
      });
      const atualizada: VistoriaCautelar = {
        ...vistoria,
        imoveis: imoveisAtualizados,
        dateUpdated: new Date().toISOString(),
      };
      await this.dbService.salvarVistoriaCautelar(atualizada);
      await this.carregarVistorias();
      this.vistoriaAtivaId.set(atualizada.id);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  async removerFotoAmbiente(ambienteId: string, index: number): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovel = this.imovelEmEdicao();
    if (!vistoria || !imovel) return;

    const imoveisAtualizados = vistoria.imoveis.map(im => {
      if (im.id !== imovel.id) return im;
      const ambientesAtualizados = im.ambientes.map(amb =>
        amb.id === ambienteId ? { ...amb, fotos: amb.fotos.filter((_, i) => i !== index) } : amb
      );
      return { ...im, ambientes: ambientesAtualizados };
    });
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: imoveisAtualizados,
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
  }

  ambientesSemFotoDoImovel(imovel: LaudoImovelVizinho): string[] {
    return imovel.ambientes
      .filter(a => a.fotos.length === 0)
      .map(a => a.nome);
  }

  ambienteTemFotoObrigatoria(ambiente: AmbienteCautelar): boolean {
    return ambiente.fotos.length > 0;
  }

  contadorAmbientesCompletos(): string {
    const ambientes = this.ambientesDoImovel();
    const completos = ambientes.filter(a => this.ambienteTemFotoObrigatoria(a)).length;
    return `${completos} de ${ambientes.length} ambientes com foto registrada`;
  }

  abrirModalNovaOcorrencia(ambienteId: string): void {
    this.ambienteDaOcorrenciaId.set(ambienteId);
    this.ocorrenciaEmEdicaoId.set(null);
    this.edOcElementoConstrutivo.set('Paredes');
    this.edOcTipoConstatacao.set('ANOMALIA');
    this.edOcUsaFamiliaAbertura.set(true);
    this.edOcAberturaMm.set('');
    this.edOcOutraManifestacao.set('INFILTRACAO');
    this.edOcOutraManifestacaoDescricao.set('');
    this.edOcDescricao.set('');
    this.edOcLocalizacaoNoAmbiente.set('');
    this.edOcFotos.set([]);
    this.edOcTestemunhoInstalado.set(false);
    this.edOcFotoTestemunho.set(null);
    this.sugestaoIAPendente.set(null);
    this.sugestaoIAAplicadaNestaSessao = null;
    this.modalOcorrenciaAberto.set(true);
  }

  fecharModalOcorrencia(): void {
    this.modalOcorrenciaAberto.set(false);
  }

  async onFotoOcorrenciaChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const compressed = await this.comprimirImagem(dataUrl, 900, 0.78);
      this.edOcFotos.update(arr => [...arr, compressed]);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removerFotoOcorrencia(index: number): void {
    this.edOcFotos.update(arr => arr.filter((_, i) => i !== index));
  }

  async onFotoTestemunhoChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const compressed = await this.comprimirImagem(dataUrl, 900, 0.78);
      this.edOcFotoTestemunho.set(compressed);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  podeSalvarOcorrencia(): boolean {
    const temDescricaoOutro = this.edOcOutraManifestacao() !== 'OUTRO' || !!this.edOcOutraManifestacaoDescricao().trim();
    return !!(this.edOcDescricao().trim() && this.edOcLocalizacaoNoAmbiente().trim()
      && this.edOcFotos().length > 0 && temDescricaoOutro);
  }

  async salvarOcorrencia(): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovel = this.imovelEmEdicao();
    const ambienteId = this.ambienteDaOcorrenciaId();
    if (!vistoria || !imovel || !ambienteId || !this.podeSalvarOcorrencia()) {
      this.toastService.show('Preencha descrição, localização e ao menos uma foto.', 'error');
      return;
    }

    const usaFamilia = this.edOcUsaFamiliaAbertura();
    const mm = usaFamilia && this.edOcAberturaMm() ? parseFloat(this.edOcAberturaMm()) : undefined;

    const novaOcorrencia: OcorrenciaCautelar = {
      id: this.ocorrenciaEmEdicaoId() ?? crypto.randomUUID(),
      elementoConstrutivo: this.edOcElementoConstrutivo(),
      tipoConstatacao: this.edOcTipoConstatacao(),
      familiaAbertura: usaFamilia && mm != null ? classificarAbertura(mm) : undefined,
      aberturaMm: usaFamilia && mm != null ? mm : undefined,
      outraManifestacao: !usaFamilia ? this.edOcOutraManifestacao() : undefined,
      outraManifestacaoDescricao: !usaFamilia && this.edOcOutraManifestacao() === 'OUTRO'
        ? this.edOcOutraManifestacaoDescricao() : undefined,
      descricao: this.edOcDescricao(),
      fotos: this.edOcFotos(),
      localizacaoNoAmbiente: this.edOcLocalizacaoNoAmbiente(),
      testemunhoInstalado: this.edOcTestemunhoInstalado(),
      fotoTestemunho: this.edOcTestemunhoInstalado() ? (this.edOcFotoTestemunho() ?? undefined) : undefined,
      sugestaoIA: this.sugestaoIAAplicadaNestaSessao ? {
        elementoConstrutivo: this.sugestaoIAAplicadaNestaSessao.elementoConstrutivo,
        tipoConstatacao: this.sugestaoIAAplicadaNestaSessao.tipoConstatacao,
        descricaoSugerida: this.sugestaoIAAplicadaNestaSessao.descricaoSugerida,
        confirmadaPeloUsuario: true,
      } : undefined,
    };

    const imoveisAtualizados = vistoria.imoveis.map(im => {
      if (im.id !== imovel.id) return im;
      const ambientesAtualizados = im.ambientes.map(amb => {
        if (amb.id !== ambienteId) return amb;
        const idEditando = this.ocorrenciaEmEdicaoId();
        const ocorrenciasAtualizadas = idEditando
          ? amb.ocorrencias.map(o => o.id === idEditando ? novaOcorrencia : o)
          : [...amb.ocorrencias, novaOcorrencia];
        return { ...amb, ocorrencias: ocorrenciasAtualizadas };
      });
      return { ...im, ambientes: ambientesAtualizados };
    });
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: imoveisAtualizados,
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
    this.modalOcorrenciaAberto.set(false);
    this.toastService.show('Ocorrência registrada.', 'success');
  }

  async iniciarGravacaoAudio(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        await this.transcreverAudio(audioBlob);
      };
      this.mediaRecorder.start();
      this.gravandoAudio.set(true);
    } catch (err) {
      console.warn('Erro ao acessar microfone:', err);
      this.toastService.show('Não foi possível acessar o microfone. Verifique as permissões do navegador.', 'error');
    }
  }

  pararGravacaoAudio(): void {
    if (this.mediaRecorder && this.gravandoAudio()) {
      this.mediaRecorder.stop();
      this.gravandoAudio.set(false);
    }
  }

  private blobParaBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // remove o prefixo "data:audio/webm;base64,"
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async transcreverAudio(audioBlob: Blob): Promise<void> {
    this.transcrevendoAudio.set(true);
    try {
      const base64 = await this.blobParaBase64(audioBlob);
      const texto = await this.geminiService.generateTextWithImages(
        'Transcreva fielmente o áudio a seguir, em português. Retorne apenas o texto transcrito, sem comentários adicionais.',
        [{ base64, mimeType: 'audio/webm' }]
      );
      const transcricaoLimpa = this.geminiService.sanitizeAiText(texto);
      this.edOcDescricao.update(atual => atual ? `${atual}\n${transcricaoLimpa}` : transcricaoLimpa);
      this.toastService.show('Áudio transcrito e adicionado à descrição.', 'success');
    } catch (err) {
      console.warn('Erro ao transcrever áudio:', err);
      this.toastService.show('Não foi possível transcrever o áudio. Você pode digitar a descrição manualmente.', 'info', 6000);
    } finally {
      this.transcrevendoAudio.set(false);
    }
  }

  async sugerirComIA(): Promise<void> {
    const fotos = this.edOcFotos();
    if (fotos.length === 0) {
      this.toastService.show('Adicione ao menos uma foto antes de pedir sugestão por IA.', 'info');
      return;
    }
    this.sugerindoIA.set(true);
    try {
      const prompt = `Você é um vistoriador técnico realizando uma Vistoria Cautelar de Vizinhança,
conforme a Norma de Vistoria Cautelar de Vizinhança do IBAPE/SP (2025) e a ABNT NBR 13752:2024,
item 7.3.3.2 — Vistoria de Constatação.

REGRA ABSOLUTA: este é um registro de CONSTATAÇÃO, não um diagnóstico. Você deve descrever
exclusivamente o que é visível na foto — tipo de elemento, aparência, localização, extensão
aparente. É TERMINANTEMENTE PROIBIDO mencionar, sugerir ou insinuar: causa da ocorrência,
responsabilidade de qualquer parte, origem da manifestação (ex.: não diga se uma infiltração
vem "de cima" ou "de baixo", não diga se uma fissura está "ativa" ou "estabilizada"),
estimativa de idade, tempo de existência ou época de surgimento da ocorrência, ou
qualquer recomendação de reparo ou solução técnica.

Analise a foto anexada e responda:
- elementoConstrutivo: qual dos seguintes elementos está mais evidente na foto — Piso, Paredes,
  Forros, Portas, Janelas, Pinturas, Cobertas, Instalações Elétricas, Instalações Sanitárias,
  Instalações Especiais.
- tipoConstatacao: classifique como ANOMALIA (irregularidade/exceção ao padrão), FALHA
  (ocorrência que prejudica a utilização do elemento, com desempenho inferior ao requerido) ou
  MANIFESTACAO_PATOLOGICA (irregularidade visível decorrente de falha em projeto, execução, uso
  ou manutenção) — classifique pela NATUREZA do que é visto, nunca pela causa.
- descricaoSugerida: um parágrafo curto e objetivo (2-3 frases) descrevendo apenas o que é
  visível na foto — aparência, localização aproximada, extensão — em linguagem técnica de
  constatação. Não inclua nenhuma palavra sobre causa, responsabilidade ou solução.
- caracteristicasObservadas: lista das características físicas efetivamente visíveis na imagem, entre as opções do enum. Registre apenas o que a fotografia permite constatar. NÃO conclua, NÃO estime e NÃO mencione se a ocorrência parece recente ou antiga — a idade da ocorrência está fora do escopo desta modalidade de vistoria. Se a imagem não permitir constatar nenhuma característica com segurança, devolva lista vazia.

Se a foto não permitir uma constatação clara (desfocada, mal enquadrada, sem elemento
identificável), deixe descricaoSugerida em branco e explique isso não é possível determinar,
sem inventar conteúdo.`;

      const primeiraFoto = fotos[0];
      const base64 = primeiraFoto.split(',')[1] ?? primeiraFoto;

      const schema = {
        type: 'object',
        properties: {
          elementoConstrutivo: { type: 'string' },
          tipoConstatacao: { type: 'string', enum: ['ANOMALIA', 'FALHA', 'MANIFESTACAO_PATOLOGICA'] },
          descricaoSugerida: { type: 'string' },
          caracteristicasObservadas: {
            type: 'array',
            items: {
              type: 'string',
              enum: [...CARACTERISTICAS_OBSERVADAS],
            },
          },
        },
        required: ['elementoConstrutivo', 'tipoConstatacao', 'descricaoSugerida'],
      };

      const textPart = { text: prompt };
      const imagePart = { inlineData: { data: base64, mimeType: 'image/jpeg' } };
      const contents = { parts: [textPart, imagePart] };

      const resultado = await this.geminiService.generateStructured<{
        elementoConstrutivo: string;
        tipoConstatacao: TipoConstatacaoCautelar;
        descricaoSugerida: string;
      }>(contents, schema);

      const elementoValido = ELEMENTOS_CONSTRUTIVOS.includes(resultado.elementoConstrutivo as ElementoConstrutivo)
        ? (resultado.elementoConstrutivo as ElementoConstrutivo)
        : undefined;

      this.sugestaoIAPendente.set({
        elementoConstrutivo: elementoValido,
        tipoConstatacao: resultado.tipoConstatacao,
        descricaoSugerida: resultado.descricaoSugerida,
      });
    } catch (err) {
      console.warn('Erro ao obter sugestão por IA:', err);
      this.toastService.show('Sugestão por IA indisponível no momento. Você pode preencher manualmente.', 'info', 6000);
    } finally {
      this.sugerindoIA.set(false);
    }
  }

  aceitarSugestaoIA(): void {
    const sugestao = this.sugestaoIAPendente();
    if (!sugestao) return;
    this.sugestaoIAAplicadaNestaSessao = sugestao;
    if (sugestao.elementoConstrutivo) {
      this.edOcElementoConstrutivo.set(sugestao.elementoConstrutivo);
      this.onElementoConstrutivoChange();
    }
    if (sugestao.tipoConstatacao) this.edOcTipoConstatacao.set(sugestao.tipoConstatacao);
    if (sugestao.descricaoSugerida) {
      this.edOcDescricao.update(atual => atual ? atual : sugestao.descricaoSugerida!);
    }
    this.sugestaoIAPendente.set(null);
    this.toastService.show('Sugestão aplicada. Revise antes de salvar.', 'success');
  }

  descartarSugestaoIA(): void {
    this.sugestaoIAPendente.set(null);
  }

  async excluirOcorrencia(ambienteId: string, ocorrenciaId: string): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovel = this.imovelEmEdicao();
    if (!vistoria || !imovel) return;
    const imoveisAtualizados = vistoria.imoveis.map(im => {
      if (im.id !== imovel.id) return im;
      const ambientesAtualizados = im.ambientes.map(amb =>
        amb.id === ambienteId ? { ...amb, ocorrencias: amb.ocorrencias.filter(o => o.id !== ocorrenciaId) } : amb
      );
      return { ...im, ambientes: ambientesAtualizados };
    });
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: imoveisAtualizados,
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
    this.toastService.show('Ocorrência removida.', 'info');
  }

  labelFamiliaAbertura(f: FamiliaAbertura | null): string {
    switch (f) {
      case 'FISSURA': return 'Fissura (≤ 0,50 mm)';
      case 'TRINCA': return 'Trinca (0,50 a 1,00 mm)';
      case 'RACHADURA': return 'Rachadura (1,00 a 5,00 mm)';
      case 'FENDA': return 'Fenda (5,00 a 10,00 mm)';
      case 'BRECHA': return 'Brecha (acima de 10,00 mm)';
      default: return '—';
    }
  }

  labelOutraManifestacao(m: OutraManifestacao): string {
    switch (m) {
      case 'INFILTRACAO': return 'Infiltração';
      case 'UMIDADE': return 'Umidade';
      case 'MOFO_BOLOR': return 'Mofo/Bolor';
      case 'DESCOLAMENTO': return 'Descolamento';
      case 'EFLORESCENCIA': return 'Eflorescência';
      case 'CORROSAO_OXIDACAO': return 'Corrosão/Oxidação';
      case 'DESGASTE_DETERIORACAO': return 'Desgaste/Deterioração superficial';
      case 'EMPENAMENTO_DEFORMACAO': return 'Empenamento/Deformação';
      case 'DESPLACAMENTO': return 'Desplacamento';
      case 'MAU_FUNCIONAMENTO': return 'Mau funcionamento';
      case 'OBSTRUCAO': return 'Obstrução';
      case 'OUTRO': return 'Outro';
    }
  }

  /** Lista de manifestações cabíveis para o elemento construtivo selecionado no momento. */
  manifestacoesDisponiveis(): OutraManifestacao[] {
    return MANIFESTACOES_POR_ELEMENTO[this.edOcElementoConstrutivo()] ?? [];
  }

  onElementoConstrutivoChange(): void {
    const disponiveis = this.manifestacoesDisponiveis();
    if (!disponiveis.includes(this.edOcOutraManifestacao())) {
      this.edOcOutraManifestacao.set(disponiveis[0] ?? 'OUTRO');
    }
  }

  async excluirAmbiente(ambienteId: string): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovel = this.imovelEmEdicao();
    if (!vistoria || !imovel) return;
    const imoveisAtualizados = vistoria.imoveis.map(im =>
      im.id === imovel.id ? { ...im, ambientes: im.ambientes.filter(a => a.id !== ambienteId) } : im
    );
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: imoveisAtualizados,
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
    this.toastService.show('Ambiente removido do checklist.', 'info');
  }

  async marcarImovelConcluido(): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovelId = this.imovelEmEdicaoId();
    if (!vistoria || !imovelId) return;

    const imovel = vistoria.imoveis.find(im => im.id === imovelId);
    if (!imovel) return;
    const pendentes = this.ambientesSemFotoDoImovel(imovel);
    if (pendentes.length > 0) {
      this.toastService.show(
        `Não é possível concluir: ${pendentes.length} ambiente(s) sem foto — ${pendentes.join(', ')}.`,
        'error'
      );
      return;
    }

    const imoveisAtualizados = vistoria.imoveis.map(im =>
      im.id === imovelId && im.status === 'EM_ANDAMENTO' ? { ...im, status: 'CONCLUIDO' as const } : im
    );
    const atualizada: VistoriaCautelar = {
      ...vistoria,
      imoveis: imoveisAtualizados,
      dateUpdated: new Date().toISOString(),
    };
    await this.dbService.salvarVistoriaCautelar(atualizada);
    await this.carregarVistorias();
    this.vistoriaAtivaId.set(atualizada.id);
    this.toastService.show('Imóvel marcado como concluído.', 'success');
    this.fecharDetalheImovel();
  }

  abrirModalConsolidacao(): void {
    if (!this.imoveisProntosParaConsolidar()) return;
    this.modalConsolidacaoAberto.set(true);
  }

  fecharModalConsolidacao(): void {
    this.modalConsolidacaoAberto.set(false);
  }

  private detectarCamposCurtos(vistoria: VistoriaCautelar): string[] {
    const camposCurtos: string[] = [];
    if (vistoria.obraGeradora.nome.trim().length < 4) camposCurtos.push('Nome da obra geradora');
    if (vistoria.solicitante.nome.trim().length < 4) camposCurtos.push('Nome do solicitante');
    vistoria.imoveis.forEach(im => {
      im.ambientes.forEach(amb => {
        amb.ocorrencias.forEach(oc => {
          if (oc.descricao.trim().length < 10) {
            camposCurtos.push(`Descrição de ocorrência em "${amb.nome}" (${im.endereco})`);
          }
        });
      });
    });
    return camposCurtos;
  }

  obterImpedimentosEmissaoCautelar(vistoria: VistoriaCautelar | null): string[] {
    if (!vistoria) return [];
    const impedimentos: string[] = [];

    if (!vistoria.obraGeradora.logisticaCanteiro?.trim()) {
      impedimentos.push('Seção 7.0 — Logística do canteiro não preenchida.');
    }
    if (!vistoria.obraGeradora.impactosVizinhanca?.trim()) {
      impedimentos.push('Seção 7.0 — Impactos previstos à vizinhança não preenchidos.');
    }
    if (!vistoria.areaInfluencia?.memorialJustificativo?.trim()) {
      impedimentos.push('Seção 8.0 — Memorial justificativo do raio de influência não preenchido.');
    }
    const temFotoCanteiro =
      !!(vistoria.canteiroObras?.fotosExternas?.length || vistoria.canteiroObras?.fotosInternas?.length);
    if (!temFotoCanteiro) {
      impedimentos.push('Seção 9.0 — Nenhuma foto do canteiro registrada (item 6.4.2 da Norma IBAPE/SP 2025).');
    }

    vistoria.imoveis.forEach(im => {
      const ref = im.endereco || 'imóvel sem endereço';
      const acessoNegado = im.autorizacaoAcesso?.status === 'NEGADO';

      if (!acessoNegado) {
        if (!im.dataVistoria?.trim()) {
          impedimentos.push(`${ref}: data da vistoria não informada.`);
        }
      }

      im.ambientes.forEach(amb => {
        if (amb.fotos.length > 0 && amb.ocorrencias.length === 0) {
          impedimentos.push(
            `${ref}, ambiente "${amb.nome}": possui ${amb.fotos.length} foto(s) sem nenhuma ficha de constatação vinculada.`
          );
        }
      });
    });

    return impedimentos;
  }

  iniciarGeracaoPDF(): void {
    if (!this.profile || !registroValido(this.profile.professionalId)) {
      this.toastService.show('Emissão bloqueada. É necessário possuir um registro profissional (CAU/CREA) válido cadastrado no seu perfil para emitir documentos técnicos.', 'error');
      return;
    }

    const vistoria = this.vistoriaAtiva();
    if (!vistoria) return;
    if (!this.imoveisProntosParaConsolidar()) {
      this.toastService.show('Todos os imóveis precisam estar concluídos ou com acesso negado antes de gerar o PDF.', 'error');
      return;
    }

    const impedimentos = this.obterImpedimentosEmissaoCautelar(vistoria);
    if (impedimentos.length > 0) {
      this.impedimentosCautelar.set(impedimentos);
      this.modalImpedimentosCautelarAberto.set(true);
      return;
    }
    this.impedimentosCautelar.set([]);

    const camposCurtos = this.detectarCamposCurtos(vistoria);
    if (camposCurtos.length > 0) {
      this.camposCurtosParaRevisao.set(camposCurtos);
      this.modalRevisaoCamposAberto.set(true);
      return;
    }

    void this.gerarConsolidacaoPDF();
  }

  confirmarGeracaoComRessalvas(): void {
    this.modalRevisaoCamposAberto.set(false);
    void this.gerarConsolidacaoPDF();
  }

  cancelarRevisaoCampos(): void {
    this.modalRevisaoCamposAberto.set(false);
  }

  fecharModalImpedimentosCautelar(): void {
    this.modalImpedimentosCautelarAberto.set(false);
  }

  async gerarConsolidacaoPDF(): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    if (!vistoria) return;

    const impedimentos = this.obterImpedimentosEmissaoCautelar(vistoria);
    if (impedimentos.length > 0) {
      this.impedimentosCautelar.set(impedimentos);
      this.modalImpedimentosCautelarAberto.set(true);
      return;
    }

    this.carregandoPreviewPdf.set(true);

    const dataFormatada = new Date().toLocaleDateString('pt-BR');

    // Registro imutável da emissão — snapshot congelado, nunca editado depois.
    // Mesmo padrão do módulo de Inspeção Predial (exportarRelatorioPDF).
    // Sem cálculo de taxa — decisão já tomada, mesmo padrão dos dois módulos.
    let numeroDocumentoFormatado = '';
    const anoAtual = new Date().getFullYear();
    let numeroEmissao = 1;
    try {
      numeroEmissao = (await this.dbService.countLaudosCautelaresEmitidosNoAno(anoAtual)) + 1;
      numeroDocumentoFormatado = `P4-VCV-nº${String(numeroEmissao).padStart(3, '0')}/${anoAtual}`;
      const novoLaudo: LaudoCautelarEmitido = {
        id: crypto.randomUUID(),
        numeroEmissao,
        snapshotVistoria: JSON.parse(JSON.stringify(vistoria)),
        snapshotProfile: this.profile ? JSON.parse(JSON.stringify(this.profile)) : null,
        taxaCalculada: 0,
        dataEmissao: new Date().toISOString(),
      };
      await this.dbService.salvarLaudoCautelarEmitido(novoLaudo);
      void this.syncService.salvarLaudoCautelarNaNuvem(novoLaudo);
    } catch (e) {
      console.warn('Falha ao registrar emissão do laudo (o PDF ainda será gerado normalmente):', e);
      // Falha no registro NÃO deve impedir a geração do PDF em si.
    }

    if (!numeroDocumentoFormatado) {
      numeroDocumentoFormatado = `P4-VCV-nº${String(numeroEmissao).padStart(3, '0')}/${anoAtual}`;
    }

    // Documento só recebe número oficial se o RT tem registro completo —
    // mesma regra do Check-up. Verifica no primeiro imóvel (mesmo
    // vistoriador em toda a obra, via de regra).
    const vistoriadorRef = vistoria.imoveis[0]?.assinaturas.vistoriador;
    const documentoRegistrado = !!(
      vistoriadorRef?.registro?.trim() &&
      vistoriadorRef?.artRrt?.trim() &&
      (vistoriadorRef as any)?.anexoArtRrt
    );
    const numeroOuProvisorio = documentoRegistrado ? numeroDocumentoFormatado : '⚠ Documento Provisório';

    // ─── CAPA ───
    const p = this.profile;
    const capaHtml = `
      <div class="capa">
        <div>
          ${p?.companyLogoBase64
            ? `<img src="${p.companyLogoBase64}" style="max-height: 16mm; max-width: 65mm; object-fit: contain; margin-bottom: 2mm;" alt="Logo">`
            : `<div class="capa-logo">${this.formatarLogoMarca(p?.companyName)}</div>
               <div class="capa-logo-sub">${p?.companyName ? (p.companyCnpj ? `CNPJ ${p.companyCnpj}` : '') : 'Ecossistema 4.0'}</div>`
          }
          <div class="capa-rule"></div>
        </div>
        <div>
          <div class="capa-kicker">Predial 4.0 · Módulo Cautelar</div>
          <div class="capa-titulo">Laudo de Vistoria<br>Cautelar de Vizinhança</div>
          <div class="capa-norma">
            Elaborado em conformidade com a <b>Norma de Vistoria Cautelar de Vizinhança do
            IBAPE/SP — 2025</b> (Procedimentos Básicos Executivos), vigente desde 09/04/2025,
            e com a <b>ABNT NBR 13752:2024</b> — Perícias de engenharia na construção civil,
            item 7.3.3.2 (Vistoria Cautelar de Vizinhança).
          </div>
        </div>
        <div>
          <div style="margin-bottom:4mm;font-size:8.4pt;font-weight:700;color:${documentoRegistrado ? 'var(--p4-copper)' : '#C75D45'}">
            ${numeroOuProvisorio}
          </div>
          <div class="capa-meta">
            <div><b>Obra Geradora</b>${vistoria.obraGeradora.nome}</div>
            <div><b>Nível de Vistoria</b>Nível ${vistoria.nivelVistoriaCautelar}</div>
            <div><b>Endereço da Obra</b>${vistoria.obraGeradora.endereco}</div>
            <div><b>Nº de Imóveis</b>${vistoria.imoveis.length}</div>
            <div><b>Solicitante</b>${vistoria.solicitante.nome}</div>
            <div><b>Data de Consolidação</b>${dataFormatada}</div>
          </div>
        </div>
        ${!documentoRegistrado ? `
          <div class="box box-alert" style="margin-top:6mm">
            <b>Documento provisório.</b> Este laudo ainda não possui registro
            completo do responsável técnico (registro profissional, número de
            ART/RRT e comprovante anexado) em ao menos um dos imóveis. Adquire
            numeração oficial e validade técnica plena assim que o responsável
            técnico completar esses dados na Seção "Assinaturas" de cada
            imóvel.
          </div>` : ''}
      </div>`;

    // ─── SUMÁRIO ───
    const sumarioItens: [string, string, string][] = [
      ['1.0', 'Identificação do Solicitante', 'sec-1'],
      ['2.0', 'Identificação do Objeto da Vistoria', 'sec-2'],
      ['3.0', 'Objetivo e Finalidade', 'sec-3'],
      ['4.0', 'Nível de Vistoria', 'sec-4'],
      ['5.0', 'Instruções e Recomendações de Uso do Laudo', 'sec-5'],
      ['6.0', 'Pressupostos, Ressalvas e Condições Limitantes', 'sec-6'],
      ['7.0', 'Identificação da Obra Geradora', 'sec-7'],
      ['8.0', 'Área de Influência', 'sec-8'],
      ['9.0', 'Registro Fotográfico do Canteiro de Obras', 'sec-9'],
    ];
    vistoria.imoveis.forEach((im, i) => {
      sumarioItens.push([`10.${i + 1}`, `Imóvel — ${im.endereco}`, `sec-10-${i + 1}`]);
    });
    const numeroSecaoEncerramento = 10 + vistoria.imoveis.length;
    sumarioItens.push([`${numeroSecaoEncerramento}.0`, 'Local, Data e Assinaturas', 'sec-12']);
    const temAnexoArt = vistoria.imoveis.some(im => (im.assinaturas.vistoriador as any).anexoArtRrt);
    if (temAnexoArt) {
      sumarioItens.push(['A-I', 'Anexo — Comprovantes de ART/RRT', 'sec-anexo-art']);
    }
    const sumarioHtml = `
      <h2 class="sec-h">§ Sumário</h2>
      ${sumarioItens.map(([n, t, href]) => `
        <div class="toc-row">
          <a href="#${href}" style="display:flex;justify-content:space-between;align-items:baseline;width:100%;text-decoration:none;color:inherit">
            <span><span class="toc-num">${n}</span>${t}</span>
            <span style="color:var(--p4-copper);font-size:8pt">→</span>
          </a>
        </div>`).join('')}
      <div class="box">
        <b>Estrutura normativa.</b> As seções deste laudo seguem os 14 itens mínimos
        estabelecidos no item 7 da Norma IBAPE/SP 2025.
      </div>`;

    // ─── SEÇÕES 1-9 (DA OBRA, UMA VEZ) ───
    const momentoLabel = vistoria.momentoVistoria === 'PRE_DEMOLICAO'
      ? 'Período prévio à demolição dos imóveis no futuro canteiro de obras'
      : 'Período prévio à movimentação de terra, execução de fundação e contenção';

    const secoesObraHtml = `
      <h2 class="sec-h" id="sec-1"><span class="sn">1.0</span>Identificação do Solicitante</h2>
      <table class="dt">
        <tr><td class="lbl">Nome / Razão Social</td><td>${vistoria.solicitante.nome}</td></tr>
        <tr><td class="lbl">CNPJ/CPF</td><td>${vistoria.solicitante.cnpjCpf}</td></tr>
        <tr><td class="lbl">Endereço</td><td>${vistoria.solicitante.endereco || '—'}</td></tr>
        <tr><td class="lbl">Responsável Legal</td><td>${vistoria.solicitante.responsavelLegal || '—'}</td></tr>
      </table>

      <h2 class="sec-h" id="sec-2"><span class="sn">2.0</span>Identificação do Objeto da Vistoria</h2>
      <p>${vistoria.imoveis.length === 1
        ? 'O objeto da presente vistoria compreende o imóvel identificado na área de influência da obra geradora, detalhado individualmente na seção 10.1 deste laudo.'
        : `O objeto da presente vistoria compreende os ${vistoria.imoveis.length} imóveis identificados na área de influência da obra geradora, detalhados individualmente nas seções 10.1 a 10.${vistoria.imoveis.length} deste laudo.`}</p>

      <h2 class="sec-h" id="sec-3"><span class="sn">3.0</span>Objetivo e Finalidade</h2>
      <p>A presente Vistoria Cautelar de Vizinhança tem por objetivo perpetuar a memória do estado
      de conservação dos imóveis situados na área de influência da obra geradora, nos termos do
      item 4 da Norma IBAPE/SP 2025.</p>
      <p>Este instrumento tem, ainda, a finalidade de apurar e registrar o estado de conservação
      dos imóveis lindeiros e do entorno previamente ao início das atividades construtivas,
      constituindo prova testemunhal de constatação inicial apta a subsidiar, se necessário,
      eventual esclarecimento sobre reclamações de danos formuladas por terceiros no decorrer ou
      após a execução da obra.</p>
      <div class="box box-alert">
        <b>Delimitação de escopo — item 7.3.3.2 da ABNT NBR 13752:2024.</b> Por se tratar de
        modalidade de Vistoria de Constatação, este laudo registra exclusivamente o estado
        existente na data da vistoria. Não há determinação de causas, atribuição de
        responsabilidades ou indicação de soluções para as ocorrências registradas.
      </div>

      <h2 class="sec-h" id="sec-4"><span class="sn">4.0</span>Nível de Vistoria</h2>
      <p>Adotou-se o <b>Nível ${vistoria.nivelVistoriaCautelar}</b>, conforme item 5 da
      Norma IBAPE/SP 2025.</p>

      ${this.gerarInstrucoesUsoHtml()}

      <h2 class="sec-h" id="sec-6"><span class="sn">6.0</span>Pressupostos, Ressalvas e Condições Limitantes</h2>
      <ul>
        <li>A vistoria foi realizada por constatação visual desarmada, sem ensaios
        destrutivos, prospecções ou aberturas de revestimento.</li>
        <li>A definição dos imóveis vistoriados decorre de escolha baseada em risco,
        que pode ser minimizado, porém nunca anulado (item 6.2 da Norma IBAPE/SP 2025).</li>
        <li>Os dados pessoais dos ocupantes foram tratados observando-se a Lei
        nº 13.709/2018 (LGPD).</li>
        <li>O marco temporal das constatações é estabelecido por
        ${vistoria.marcoTemporal === 'ASSINATURA_DIGITAL' ? 'assinatura digital' : 'registro em cartório'}.</li>
      </ul>

      <h2 class="sec-h" id="sec-7"><span class="sn">7.0</span>Identificação da Obra Geradora</h2>
      <table class="dt">
        <tr><td class="lbl">Denominação</td><td>${vistoria.obraGeradora.nome}</td></tr>
        <tr><td class="lbl">Endereço</td><td>${vistoria.obraGeradora.endereco}</td></tr>
        <tr><td class="lbl">Momento da vistoria</td><td>${momentoLabel}</td></tr>
        <tr><td class="lbl">Sistema de fundação</td><td>${vistoria.obraGeradora.fundacao || '—'}</td></tr>
        <tr><td class="lbl">Sistema estrutural</td><td>${vistoria.obraGeradora.estrutura || '—'}</td></tr>
        <tr><td class="lbl">Logística do canteiro</td><td>${vistoria.obraGeradora.logisticaCanteiro || '—'}</td></tr>
        <tr><td class="lbl">Impactos previstos à vizinhança</td><td>${vistoria.obraGeradora.impactosVizinhanca || '—'}</td></tr>
      </table>

      <h2 class="sec-h" id="sec-8"><span class="sn">8.0</span>Área de Influência</h2>
      <table class="dt">
        <tr><td class="lbl">Raio considerado</td><td>${vistoria.areaInfluencia.raio || '—'}</td></tr>
        <tr><td class="lbl">Memorial justificativo</td><td>${vistoria.areaInfluencia.memorialJustificativo || '—'}</td></tr>
        <tr><td class="lbl">Estudos prévios considerados</td><td>${vistoria.areaInfluencia.estudosPreviosConsiderados || '—'}</td></tr>
      </table>

      <h2 class="sec-h" id="sec-9"><span class="sn">9.0</span>Registro Fotográfico do Canteiro de Obras</h2>
      <p>Registro realizado a partir da via pública, nos termos do item 6.4.2 da Norma
      IBAPE/SP 2025.</p>
      ${vistoria.canteiroObras.fotosExternas.length > 0 || vistoria.canteiroObras.fotosInternas.length > 0 ? `
        <div class="foto-grid">
          ${vistoria.canteiroObras.fotosExternas.map((f, i) => `
            <figure><img src="${f}"><figcaption><b>Externa ${i + 1}</b> — Vista do canteiro a partir da via pública.</figcaption></figure>
          `).join('')}
          ${vistoria.canteiroObras.fotosInternas.map((f, i) => `
            <figure><img src="${f}"><figcaption><b>Interna ${i + 1}</b> — Registro interno do canteiro.</figcaption></figure>
          `).join('')}
        </div>` : '<p class="text-slate-400">Nenhuma foto do canteiro registrada.</p>'}
    `;

    // ─── BLOCO POR IMÓVEL (10.1 a 10.N) ───
    const blocosImoveisHtml = vistoria.imoveis.map((im, idx) => {
      const numSecao = `10.${idx + 1}`;
      const auth = im.autorizacaoAcesso;
      const statusAcessoLabel = auth.status === 'AUTORIZADO' ? 'Autorizado'
        : auth.status === 'AUTORIZADO_PARCIAL' ? 'Autorizado com restrições' : 'Negado';

      // Regra: ambiente só entra no PDF se tiver ao menos 1 foto
      const ambientesComFoto = im.ambientes.filter(a => a.fotos.length > 0);

      const fichasHtml = ambientesComFoto.map(amb => {
        const ocorrenciasHtml = amb.ocorrencias.length > 0
          ? amb.ocorrencias.map(oc => {
              const natureza = oc.tipoConstatacao === 'ANOMALIA' ? 'Anomalia'
                : oc.tipoConstatacao === 'FALHA' ? 'Falha' : 'Manifestação patológica';
              const familiaLabel = oc.familiaAbertura
                ? this.labelFamiliaAbertura(oc.familiaAbertura).replace(/\s*\(.*\)$/, '')
                : '';
              const manifestacaoTexto = oc.familiaAbertura
                ? `${familiaLabel} — abertura de ${oc.aberturaMm} mm`
                : (oc.outraManifestacao === 'OUTRO'
                    ? oc.outraManifestacaoDescricao
                    : this.labelOutraManifestacao(oc.outraManifestacao!));
              return `
                <div class="nc-card">
                  <div class="nc-header">
                    <span class="chip chip-${oc.tipoConstatacao === 'ANOMALIA' ? 'anom' : oc.tipoConstatacao === 'FALHA' ? 'falha' : 'mp'}">${natureza}</span>
                    <span class="s9-title">${oc.elementoConstrutivo} — ${manifestacaoTexto}</span>
                  </div>
                  <p>${oc.descricao}</p>
                  <p class="text-xs"><b>Localização:</b> ${oc.localizacaoNoAmbiente}</p>
                  ${oc.testemunhoInstalado ? '<p class="text-xs"><b>Testemunho/selo instalado.</b></p>' : ''}
                  ${oc.fotos.length > 0 ? `<div class="foto-grid">${oc.fotos.map(f => `<figure><img src="${f}"></figure>`).join('')}</div>` : ''}
                </div>`;
            }).join('')
          : (amb.fotos.length > 0
              ? '<p class="text-xs" style="color:#B45309;font-style:italic;">Registro fotográfico do ambiente sem apontamento pericial vinculado.</p>'
              : '<p class="text-xs text-slate-400">Ambiente vistoriado sem ocorrências constatadas.</p>');

        return `
          <div class="f-card">
            <div class="f-head"><span class="f-id">${amb.nome}</span></div>
            <div class="f-body">
              <div class="foto-grid tri">
                ${amb.fotos.map(f => `<figure><img src="${f}"></figure>`).join('')}
              </div>
              ${ocorrenciasHtml}
            </div>
          </div>`;
      }).join('');

      const elementosNivel3Html = im.elementosNivel3 ? `
        <div class="box">
          <b>Elementos do Nível 3 caracterizados:</b>
          ${[
            im.elementosNivel3.fachadas && 'Fachadas',
            im.elementosNivel3.coberturas && 'Coberturas',
            im.elementosNivel3.telhados && 'Telhados',
            im.elementosNivel3.captacaoAguasPluviais && 'Captação de águas pluviais',
            im.elementosNivel3.pisosExternos && 'Pisos externos',
            im.elementosNivel3.vegetacaoCursosDagua && "Vegetação e cursos d'água",
          ].filter(Boolean).join(' · ') || 'Nenhum elemento marcado'}
          ${im.elementosNivel3.observacoes ? `<br>${im.elementosNivel3.observacoes}` : ''}
        </div>` : '';

      return `
        <div class="pg"></div>
        <h2 class="sec-h" id="sec-10-${idx + 1}"><span class="sn">${numSecao}</span>Imóvel — ${im.endereco}</h2>

        <table class="dt">
          <tr><td class="lbl">Status da autorização de acesso</td><td>${statusAcessoLabel}</td></tr>
          ${auth.status === 'AUTORIZADO_PARCIAL' ? `<tr><td class="lbl">Ambientes restritos</td><td>${auth.ambientesRestritos || '—'}</td></tr>` : ''}
          ${auth.status === 'NEGADO' ? `<tr><td class="lbl">Data da recusa</td><td>${auth.recusa?.data || '—'}</td></tr>
          <tr><td class="lbl">Forma de notificação</td><td>${auth.recusa?.formaNotificacao === 'CORREIOS' ? 'Correios' : 'Cartório'}</td></tr>` : ''}
          <tr><td class="lbl">Tipologia</td><td>${im.dadosImovel.tipologia}</td></tr>
          <tr><td class="lbl">Ocupante</td><td>${im.dadosImovel.ocupante || '—'}</td></tr>
          <tr><td class="lbl">Idade estimada</td><td>${im.dadosImovel.idadeEstimada || '—'}</td></tr>
          <tr><td class="lbl">Posição relativa à obra</td><td>${this.labelPosicaoRelativa(im.posicaoRelativaObra || '')}</td></tr>
          <tr><td class="lbl">Afastamento da divisa</td><td>${im.afastamentoDivisaMetros != null ? im.afastamentoDivisaMetros + ' m' : '—'}</td></tr>
          <tr><td class="lbl">Data da vistoria</td><td>${im.dataVistoria ? new Date(im.dataVistoria + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td></tr>
        </table>

        ${auth.status === 'NEGADO' && auth.recusa?.fotoFachadaExterna ? `
          <div class="box-alert box">
            <b>Acesso negado — registro externo.</b>
            <figure><img src="${auth.recusa.fotoFachadaExterna}"><figcaption>Fachada externa, vista da via pública.</figcaption></figure>
          </div>` : ''}

        ${auth.status !== 'NEGADO' ? `
          <div class="ec-bar">
            ${['OTIMO', 'BOM', 'REGULAR', 'MAL_CONSERVADO'].map(e => `
              <div class="ec-cell ${im.estadoConservacao.classificacao === e ? 'on' : ''}">${
                e === 'OTIMO' ? 'Ótimo' : e === 'BOM' ? 'Bom' : e === 'REGULAR' ? 'Regular' : 'Mal Conservado'
              }</div>`).join('')}
          </div>
          ${elementosNivel3Html}
          <div class="sub-h">Fichas de Constatação por Ambiente</div>
          ${fichasHtml || '<p class="text-slate-400 text-sm">Nenhum ambiente com foto registrada.</p>'}
        ` : ''}

        <div class="ass-grid">
          <div class="ass">
            <div class="ass-line"></div>
            <div class="ass-nome">${im.assinaturas.vistoriador.nome || '&nbsp;'}</div>
            <div class="ass-reg">${
              im.assinaturas.vistoriador.registro || im.assinaturas.vistoriador.artRrt
                ? `${im.assinaturas.vistoriador.registro}${im.assinaturas.vistoriador.artRrt ? ` · ART/RRT ${im.assinaturas.vistoriador.artRrt}` : ''}`
                : '&nbsp;'
            }</div>
            <div class="ass-papel">Responsável Técnico pela Vistoria</div>
          </div>
          ${im.assinaturas.ocupante ? `
          <div class="ass">
            <div class="ass-line"></div>
            <div class="ass-nome">${im.assinaturas.ocupante.nome}</div>
            <div class="ass-reg">${im.assinaturas.ocupante.documento}</div>
            <div class="ass-papel">Ocupante do Imóvel</div>
          </div>` : ''}
          ${im.assinaturas.corresponsavelTecnico ? `
          <div class="ass">
            <div class="ass-line"></div>
            <div class="ass-nome">${im.assinaturas.corresponsavelTecnico.nome}</div>
            <div class="ass-reg">${im.assinaturas.corresponsavelTecnico.registro} · ART/RRT ${im.assinaturas.corresponsavelTecnico.artRrt}</div>
            <div class="ass-papel">Corresponsável Técnico</div>
          </div>` : ''}
        </div>
      `;
    }).join('');

    const anexoArtHtml = vistoria.imoveis.some(im => (im.assinaturas.vistoriador as any).anexoArtRrt) ? `
      <div class="pg"></div>
      <h2 class="sec-h" id="sec-anexo-art"><span class="sn">A-I</span>Anexo — Comprovantes de ART/RRT</h2>
      ${vistoria.imoveis
        .filter(im => (im.assinaturas.vistoriador as any).anexoArtRrt)
        .map(im => `
          <div class="box">
            <b>${im.endereco}</b> — ART/RRT nº ${im.assinaturas.vistoriador.artRrt || '—'}
          </div>
          <figure><img src="${(im.assinaturas.vistoriador as any).anexoArtRrt}"></figure>
        `).join('')}
    ` : '';

    const encerramentoHtml = `
      <div class="pg"></div>
      <h2 class="sec-h" id="sec-12"><span class="sn">${10 + vistoria.imoveis.length}.0</span>Local, Data e Assinaturas</h2>
      <p>Nada mais havendo a consignar, encerra-se o presente Laudo de Vistoria
      Cautelar de Vizinhança, composto pela obra geradora e ${vistoria.imoveis.length}
      imóvel(is) vistoriado(s), elaborado em conformidade com a Norma de Vistoria
      Cautelar de Vizinhança do IBAPE/SP — 2025 e com a ABNT NBR 13752:2024.</p>
      <p style="margin-top:5mm"><b>Recife/PE, ${dataFormatada}.</b></p>
      <div class="ass-grid">
        <div class="ass">
          <div class="ass-line"></div>
          <div class="ass-nome">${vistoria.imoveis[0]?.assinaturas.vistoriador.nome || '&nbsp;'}</div>
          <div class="ass-reg">${
            vistoria.imoveis[0]?.assinaturas.vistoriador.registro
              ? `${vistoria.imoveis[0].assinaturas.vistoriador.registro}${vistoria.imoveis[0].assinaturas.vistoriador.artRrt ? ` · ART/RRT ${vistoria.imoveis[0].assinaturas.vistoriador.artRrt}` : ''}`
              : '&nbsp;'
          }</div>
          <div class="ass-papel">Responsável Técnico pela Vistoria</div>
        </div>
      </div>
      <div class="box" style="margin-top:10mm">
        <b>Marco temporal.</b> O presente documento é ${
          vistoria.marcoTemporal === 'ASSINATURA_DIGITAL'
            ? 'assinado digitalmente, estabelecendo o marco temporal das constatações nele descritas'
            : 'registrado em cartório, estabelecendo o marco temporal das constatações nele descritas'
        }, conforme item 6.7 da Norma IBAPE/SP 2025.
      </div>`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Laudo de Vistoria Cautelar de Vizinhança — ${vistoria.obraGeradora.nome}</title>
        <style>${this.cssLaudoCautelar()}</style>
      </head>
      <body>
        ${capaHtml}
        <table class="print-table">
          <thead><tr><td class="print-thead-td">${this.headerLaudoCautelar()}</td></tr></thead>
          <tfoot><tr><td class="print-tfoot-td">${this.footerLaudoCautelar(vistoria, numeroOuProvisorio)}</td></tr></tfoot>
          <tbody><tr><td class="print-tbody-td">
            ${sumarioHtml}
            <div class="pg"></div>
            ${secoesObraHtml}
            ${blocosImoveisHtml}
            ${anexoArtHtml}
            ${encerramentoHtml}
          </td></tr></tbody>
        </table>
      </body>
      </html>
    `;

    this.pdfPreviewHtmlContent.set(htmlContent);
    this.pdfPreviewNumeroDocumento.set(numeroOuProvisorio);
    this.pdfPreviewDocumentoRegistrado.set(documentoRegistrado);
    this.modalConsolidacaoAberto.set(false);
    this.modalPreviewPdfAberto.set(true);
    this.carregandoPreviewPdf.set(false);
  }

  private formatarLogoMarca(nome: string | undefined): string {
    if (!nome || nome === 'AmorimTech') return 'Amorim<span>Tech</span>';
    return nome;
  }

  private headerLaudoCautelar(): string {
    const p = this.profile;
    const rtNome = p?.fullName || '';
    const rtRegistro = p?.professionalId || '';
    let empresa = p?.companyName || '';
    if (p?.companyCnpj) empresa += ` · CNPJ: ${p.companyCnpj}`;

    const logoHtml = p?.companyLogoBase64
      ? `<img src="${p.companyLogoBase64}" style="max-height: 13mm; max-width: 60mm; object-fit: contain;" alt="Logo">`
      : `<span class="rh-brand">${this.formatarLogoMarca(p?.companyName)}</span>`;

    const blocoRT = rtNome
      ? `<div class="rh-right">
           <div class="rh-rt">${rtNome}${rtRegistro ? ` — ${rtRegistro}` : ''}</div>
           <div class="rh-company">${empresa}</div>
         </div>`
      : '';

    return `<div class="rh-wrap">
      <div class="rh-left">
        ${logoHtml}
      </div>
      ${blocoRT}
    </div>`;
  }

  private footerLaudoCautelar(vistoria: VistoriaCautelar, numeroOuProvisorio: string): string {
    return `<div class="rf-wrap">
      <span class="rf-doc">${numeroOuProvisorio}</span>
      <span>${vistoria.obraGeradora.nome}</span>
    </div>`;
  }

  private cssLaudoCautelar(): string {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap');
      :root{
        --p4-navy:#132A41; --p4-copper:#B5642A; --p4-copper-l:#E8B27E;
        --p4-bg:#FFFFFF; --p4-ink:#1A2A38; --p4-soft:#4A5A66; --p4-faint:#8A949C;
        --p4-rule:#D8D0C6; --p4-green:#2E7D5B; --p4-green-l:#E8F5EE;
        --p4-red:#C75D45; --p4-red-l:#FDECEA; --p4-blue:#2C5AA0; --p4-blue-l:#EBF0FA;
        --p4-amber:#E07B39; --p4-amber-l:#FDF0E6; --p4-pend-l:#F5F2EC;
      }
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:9.5pt;line-height:1.5;
           color:var(--p4-ink);background:#fff;
           -webkit-print-color-adjust:exact;print-color-adjust:exact}
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{size:A4 portrait;margin:8mm 16mm 12mm 16mm;
        @bottom-right{content:"Pág. " counter(page) " / " counter(pages);
          font-family:'Inter',sans-serif;font-size:7pt;color:#8A949C}}
      .no-break{break-inside:avoid;page-break-inside:avoid}
      tr{page-break-inside:avoid}
      thead{display:table-header-group}
      .print-table{width:100%;border-collapse:collapse;table-layout:fixed}
      .print-thead-td{height:13mm;padding:0;background:#fff}
      .print-tfoot-td{height:9mm;padding:0;background:#fff}
      .print-tbody-td{padding:0;vertical-align:top}
      .rh-wrap{display:flex;justify-content:space-between;align-items:flex-end;
        border-bottom:1.6pt solid var(--p4-copper);padding-bottom:1.6mm;margin-bottom:3mm}
      .rh-brand{font-family:'Poppins',sans-serif;font-weight:700;font-size:10.5pt;
        color:var(--p4-navy);letter-spacing:-.02em}
      .rh-brand span{color:var(--p4-copper)}
      .rh-sub{font-size:6.4pt;letter-spacing:.19em;text-transform:uppercase;color:var(--p4-faint);margin-top:.4mm}
      .rh-right{text-align:right}
      .rh-rt{font-size:7.4pt;font-weight:600;color:var(--p4-navy)}
      .rh-company{font-size:6.6pt;color:var(--p4-faint)}
      .rf-wrap{display:flex;justify-content:space-between;align-items:center;
        border-top:.6pt solid var(--p4-rule);padding-top:1.5mm;margin-top:4mm;
        font-size:6.6pt;color:var(--p4-faint)}
      .rf-doc{font-weight:600;color:var(--p4-soft)}
      .capa{height:246mm;display:flex;flex-direction:column;justify-content:space-between;
        page-break-after:always;padding:6mm 0 0}
      .capa-logo{font-family:'Poppins',sans-serif;font-weight:700;font-size:19pt;
        color:var(--p4-navy);letter-spacing:-.02em;line-height:1}
      .capa-logo span{color:var(--p4-copper)}
      .capa-logo-sub{font-size:7pt;letter-spacing:.28em;text-transform:uppercase;
        color:var(--p4-faint);margin-top:1.6mm}
      .capa-rule{height:2.6pt;background:var(--p4-copper);width:34mm;margin:7mm 0 0}
      .capa-kicker{font-size:8pt;letter-spacing:.2em;text-transform:uppercase;
        color:var(--p4-copper);font-weight:700;margin-bottom:3mm}
      .capa-titulo{font-family:'Poppins',sans-serif;font-weight:700;font-size:27pt;
        line-height:1.14;color:var(--p4-navy);letter-spacing:-.02em}
      .capa-norma{margin-top:6mm;font-size:8.4pt;color:var(--p4-soft);line-height:1.65;
        max-width:132mm;border-left:2.4pt solid var(--p4-copper-l);padding-left:5mm}
      .capa-meta{border-top:.8pt solid var(--p4-rule);padding-top:5mm;
        display:grid;grid-template-columns:1fr 1fr;gap:3.4mm 9mm}
      .capa-meta div{font-size:8.4pt}
      .capa-meta b{display:block;font-size:6.6pt;letter-spacing:.15em;text-transform:uppercase;
        color:var(--p4-faint);font-weight:600;margin-bottom:.7mm}
      .sec-h{font-family:'Poppins',sans-serif;font-weight:700;font-size:12pt;color:var(--p4-navy);
        border-bottom:1.1pt solid var(--p4-copper);padding-bottom:1.6mm;margin:9mm 0 4mm;
        display:flex;align-items:baseline;gap:3mm;break-after:avoid}
      .sec-h .sn{background:var(--p4-navy);color:#fff;font-size:8pt;padding:.8mm 2.4mm;
        border-radius:1.4mm;font-weight:700;letter-spacing:.02em}
      .sub-h{font-family:'Poppins',sans-serif;font-weight:600;font-size:9.6pt;color:var(--p4-navy);
        margin:5mm 0 2.2mm;break-after:avoid}
      p{margin-bottom:2.6mm;text-align:justify}
      ul{margin:0 0 3mm 5mm}
      li{margin-bottom:1.2mm}
      .toc-row{display:flex;align-items:baseline;gap:2.4mm;padding:1.5mm 0;
        border-bottom:.4pt dotted var(--p4-rule);font-size:9pt}
      .toc-num{font-weight:700;color:var(--p4-copper);min-width:11mm}
      table.dt{width:100%;border-collapse:collapse;margin:2.5mm 0 4mm;font-size:8.4pt}
      table.dt th{background:var(--p4-navy);color:#fff;text-align:left;padding:2mm 2.6mm;
        font-size:7.2pt;letter-spacing:.09em;text-transform:uppercase;font-weight:600}
      table.dt td{padding:2mm 2.6mm;border-bottom:.5pt solid var(--p4-rule);vertical-align:top}
      table.dt tr:nth-child(even) td{background:#FAF8F4}
      table.dt td.lbl{font-weight:600;color:var(--p4-soft);width:38%}
      .f-card{border:.8pt solid var(--p4-rule);border-radius:2mm;margin:0 0 5mm;
        overflow:hidden;break-inside:avoid}
      .f-head{background:var(--p4-navy);color:#fff;padding:2.4mm 3.4mm}
      .f-id{font-family:'Poppins',sans-serif;font-weight:700;font-size:9pt;letter-spacing:.03em}
      .f-body{padding:3.4mm}
      .chip{display:inline-block;font-size:6.8pt;font-weight:700;letter-spacing:.08em;
        text-transform:uppercase;padding:.7mm 2.2mm;border-radius:1.2mm;margin-right:1.4mm}
      .chip-anom{background:var(--p4-amber-l);color:var(--p4-amber)}
      .chip-falha{background:var(--p4-blue-l);color:var(--p4-blue)}
      .chip-mp{background:var(--p4-red-l);color:var(--p4-red)}
      .foto-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:2mm 0}
      .foto-grid.tri{grid-template-columns:1fr 1fr 1fr}
      figure{border:.6pt solid var(--p4-rule);border-radius:1.6mm;overflow:hidden;break-inside:avoid}
      figure img{width:100%;height:40mm;object-fit:cover;display:block}
      figcaption{font-size:6.8pt;color:var(--p4-soft);padding:1.6mm 2.4mm;background:#FAF8F4;
        border-top:.5pt solid var(--p4-rule)}
      .ec-bar{display:flex;gap:1.4mm;margin:2mm 0 3mm}
      .ec-cell{flex:1;text-align:center;font-size:7pt;font-weight:600;padding:1.8mm .5mm;
        border-radius:1.2mm;background:#F2EFE9;color:var(--p4-faint);letter-spacing:.04em}
      .ec-cell.on{background:var(--p4-copper);color:#fff}
      .box{border:.8pt solid var(--p4-rule);border-left:2.6pt solid var(--p4-copper);
        background:#FAF8F4;padding:3mm 4mm;margin:3mm 0;font-size:8.4pt;color:var(--p4-soft)}
      .box b{color:var(--p4-navy)}
      .box-alert{border-left-color:var(--p4-red);background:var(--p4-red-l)}
      .nc-card{border:.6pt solid var(--p4-rule);border-radius:1.6mm;padding:2.6mm;margin-bottom:2.4mm}
      .nc-header{display:flex;align-items:center;gap:2mm;margin-bottom:1.2mm}
      .s9-title{font-weight:600;font-size:8.6pt;color:var(--p4-ink)}
      .ass-grid{display:grid;grid-template-columns:1fr 1fr;gap:8mm 10mm;margin-top:10mm}
      .ass{text-align:center;break-inside:avoid}
      .ass-line{border-top:.8pt solid var(--p4-ink);margin-bottom:1.6mm}
      .ass-nome{font-size:8.6pt;font-weight:600;color:var(--p4-navy)}
      .ass-reg{font-size:7.4pt;color:var(--p4-soft)}
      .ass-papel{font-size:6.6pt;letter-spacing:.14em;text-transform:uppercase;
        color:var(--p4-faint);margin-top:.8mm}
      .pg{page-break-before:always}
    `;
  }
}
