import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VistoriaDbService } from '../../services/vistoria-db.service';
import { ToastService } from '../../services/toast.service';
import { GeminiService } from '../../services/gemini.service';

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

// ─── Estruturas principais ───

export interface OcorrenciaCautelar {
  id: string;                               // crypto.randomUUID()
  elementoConstrutivo: ElementoConstrutivo;
  tipoConstatacao: TipoConstatacaoCautelar;
  familiaAbertura?: FamiliaAbertura;         // se for da família fissura→brecha
  aberturaMm?: number;                        // classifica familiaAbertura via classificarAbertura()
  outraManifestacao?: OutraManifestacao;      // se não for da família de abertura
  outraManifestacaoDescricao?: string;        // obrigatório se outraManifestacao === 'OUTRO'
  descricao: string;
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
  vistoriador: { nome: string; registro: string; artRrt: string; imagemAssinatura?: string };
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
  imports: [FormsModule],
})
export class VistoriaCautelarComponent implements OnInit {
  readonly ELEMENTOS_CONSTRUTIVOS = ELEMENTOS_CONSTRUTIVOS;
  private dbService = inject(VistoriaDbService);
  private toastService = inject(ToastService);
  private geminiService = inject(GeminiService);

  modoExibicao = signal<'LISTA' | 'CRIACAO' | 'DETALHE' | 'DETALHE_IMOVEL'>('LISTA');
  todasVistoriasCautelares = signal<VistoriaCautelar[]>([]);
  vistoriaAtivaId = signal<string | null>(null);

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

  // ─── Momento e nível ───
  novoMomentoVistoria = signal<'PRE_DEMOLICAO' | 'PRE_MOVIMENTACAO_TERRA'>('PRE_MOVIMENTACAO_TERRA');
  novoNivelVistoriaCautelar = signal<'1' | '2' | '3'>('2');

  // ─── Área de influência ───
  novaAreaRaio = signal('');
  novaAreaMemorialJustificativo = signal('');
  novaAreaEstudosPrevios = signal('');

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
  edImovelOcupante = signal('');
  edImovelIdadeEstimada = signal('');
  edImovelPadraoConstrutivo = signal('');
  edImovelPavimentos = signal('');
  edImovelUsoOcupacao = signal('');
  edImovelPosicaoRelativa = signal<PosicaoRelativaObra | ''>('');
  edImovelAfastamentoDivisa = signal('');
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

  cancelarCriacao(): void {
    this.modoExibicao.set('LISTA');
  }

  podeSalvarObra(): boolean {
    return !!(this.novoSolicitanteNome() && this.novoSolicitanteCnpjCpf()
      && this.novaObraNome() && this.novaObraEndereco());
  }

  async salvarVistoriaCautelar(): Promise<void> {
    if (!this.podeSalvarObra()) {
      this.toastService.show('Preencha ao menos Solicitante e Obra Geradora antes de salvar.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
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
      },
      momentoVistoria: this.novoMomentoVistoria(),
      areaInfluencia: {
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

  abrirDetalhe(id: string): void {
    this.vistoriaAtivaId.set(id);
    this.modoExibicao.set('DETALHE');
  }

  vistoriaAtiva(): VistoriaCautelar | undefined {
    return this.todasVistoriasCautelares().find(v => v.id === this.vistoriaAtivaId());
  }

  async excluirVistoriaCautelar(id: string): Promise<void> {
    await this.dbService.deleteVistoriaCautelar(id);
    await this.carregarVistorias();
    this.toastService.show('Vistoria Cautelar excluída.', 'info');
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
      assinaturas: { vistoriador: { nome: '', registro: '', artRrt: '' } },
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
    this.edImovelOcupante.set(imovel.dadosImovel.ocupante ?? '');
    this.edImovelIdadeEstimada.set(imovel.dadosImovel.idadeEstimada ?? '');
    this.edImovelPadraoConstrutivo.set(imovel.dadosImovel.padraoConstrutivo ?? '');
    this.edImovelPavimentos.set(imovel.dadosImovel.pavimentos != null ? String(imovel.dadosImovel.pavimentos) : '');
    this.edImovelUsoOcupacao.set(imovel.dadosImovel.usoOcupacao ?? '');
    this.edImovelPosicaoRelativa.set(imovel.posicaoRelativaObra ?? '');
    this.edImovelAfastamentoDivisa.set(imovel.afastamentoDivisaMetros != null ? String(imovel.afastamentoDivisaMetros) : '');
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

    this.garantirAmbientesPadrao();
    this.modoExibicao.set('DETALHE_IMOVEL');
  }

  fecharDetalheImovel(): void {
    this.imovelEmEdicaoId.set(null);
    this.modoExibicao.set('DETALHE');
  }

  imovelEhNivel3(): boolean {
    return this.vistoriaAtiva()?.nivelVistoriaCautelar === '3';
  }

  async salvarDadosImovel(): Promise<void> {
    const vistoria = this.vistoriaAtiva();
    const imovelId = this.imovelEmEdicaoId();
    if (!vistoria || !imovelId) return;

    const pavimentosNum = this.edImovelPavimentos() ? Number(this.edImovelPavimentos()) : undefined;
    const afastamentoNum = this.edImovelAfastamentoDivisa() ? Number(this.edImovelAfastamentoDivisa()) : undefined;

    const imoveisAtualizados = vistoria.imoveis.map(im => {
      if (im.id !== imovelId) return im;
      return {
        ...im,
        posicaoRelativaObra: this.edImovelPosicaoRelativa() || undefined,
        afastamentoDivisaMetros: afastamentoNum,
        dadosImovel: {
          ...im.dadosImovel,
          ocupante: this.edImovelOcupante() || undefined,
          idadeEstimada: this.edImovelIdadeEstimada() || undefined,
          padraoConstrutivo: this.edImovelPadraoConstrutivo() || undefined,
          pavimentos: pavimentosNum,
          usoOcupacao: this.edImovelUsoOcupacao() || undefined,
        },
        caracteristicasConstrutivas: {
          estrutura: this.edImovelEstrutura() || undefined,
          cobertura: this.edImovelCobertura() || undefined,
          contencao: this.edImovelContencao() || undefined,
          vedacoesVerticais: this.edImovelVedacoesVerticais() || undefined,
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
vem "de cima" ou "de baixo", não diga se uma fissura está "ativa" ou "estabilizada"), ou
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
}
