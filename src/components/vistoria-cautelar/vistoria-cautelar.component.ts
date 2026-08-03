import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VistoriaDbService } from '../../services/vistoria-db.service';
import { ToastService } from '../../services/toast.service';

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

export type OutraManifestacao = 'INFILTRACAO' | 'UMIDADE' | 'MOFO' | 'DESCOLAMENTO' | 'OUTRO';

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
  private dbService = inject(VistoriaDbService);
  private toastService = inject(ToastService);

  modoExibicao = signal<'LISTA' | 'CRIACAO' | 'DETALHE'>('LISTA');
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
}
