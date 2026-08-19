import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, inject, ElementRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import * as fabric from 'fabric';
import html2canvas from 'html2canvas';

import { DadosCaracterizacao, FotoObra } from '../../models/caracterizacao.model';
import { DataService } from '../../services/data.service';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';

type FerramentaDesenho = 'select' | 'pen' | 'line' | 'arrow' | 'rect' | 'box_fill' | 'text';

@Component({
  selector: 'app-gerador-caracterizacao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gerador-caracterizacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeradorCaracterizacaoComponent implements OnInit, OnDestroy {
  @Input() modo: 'ltip' | 'cautelar' = 'ltip';
  @Input() dadosIniciais?: Partial<DadosCaracterizacao>;
  @Output() fechar = new EventEmitter<void>();
  @Output() dadosGerados = new EventEmitter<DadosCaracterizacao>();

  @ViewChild('mapContainer') mapContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('canvasElement') canvasElementRef?: ElementRef<HTMLCanvasElement>;

  private dataService = inject(DataService);
  private geminiService = inject(GeminiService);
  private toastService = inject(ToastService);

  // ── Etapas (1: dados/fotos, 2: mapa, 3: anotar/memorial) ────────────────────
  etapaAtual = signal<1 | 2 | 3>(1);

  // ── Sinais de dados do formulário ───────────────────────────────────────────
  denominacao = signal<string>('');
  endereco = signal<string>('');
  tipoUso = signal<string>('Residencial multifamiliar');
  areaConstruida = signal<string>('');
  numeroPavimentos = signal<string>('');
  anoConstrucao = signal<string>('');
  sistemaEstrutural = signal<string>('');
  sistemaFundacao = signal<string>('');
  observacoes = signal<string>('');

  // ── Sinais de geolocalização e fotos ─────────────────────────────────────────
  lat = signal<number | null>(null);
  lng = signal<number | null>(null);
  perimetroMetros = signal<number | null>(null);
  buscandoEndereco = signal<boolean>(false);
  fotos = signal<FotoObra[]>([]);

  // ── Saídas geradas ──────────────────────────────────────────────────────────
  mapaBase64 = signal<string | null>(null);
  capturandoMapa = signal<boolean>(false);
  memorialGerado = signal<string>('');
  gerandoMemorial = signal<boolean>(false);
  memorialCopiado = signal<boolean>(false);

  // ── Opções dinâmicas do DataService ─────────────────────────────────────────
  opcoesSistemasEstruturais: string[] = [];
  opcoesSistemasFundacao: string[] = [];

  readonly TIPOS_USO = [
    'Residencial multifamiliar',
    'Residencial unifamiliar',
    'Comercial / Escritórios',
    'Comercial / Serviços',
    'Misto (Residencial e Comercial)',
    'Institucional / Educacional',
    'Industrial / Logístico',
    'Hospitalar / Saúde',
    'Outro'
  ];

  // ── Leaflet & Fabric State ───────────────────────────────────────────────────
  private mapInstance: L.Map | null = null;
  private markerInstance: L.Marker | null = null;
  private circleInstance: L.Circle | null = null;
  private fabricCanvas: fabric.Canvas | null = null;
  private historyStack: string[] = [];
  private isDrawingArrow = false;
  private arrowStartPoint: { x: number; y: number } | null = null;

  // ── Ferramentas de desenho Fabric ────────────────────────────────────────────
  ferramentaAtiva = signal<FerramentaDesenho>('select');
  corAtiva = signal<string>('#ef4444'); // Vermelho padrão
  espessuraAtiva = signal<number>(3);
  objetoSelecionado = signal<boolean>(false);

  readonly CORES_PALETA = [
    { label: 'Vermelho', hex: '#ef4444' },
    { label: 'Laranja', hex: '#f97316' },
    { label: 'Amarelo', hex: '#eab308' },
    { label: 'Verde', hex: '#22c55e' },
    { label: 'Azul', hex: '#3b82f6' },
    { label: 'Branco', hex: '#ffffff' },
    { label: 'Preto', hex: '#0f172a' },
  ];

  ngOnInit(): void {
    this.carregarOpcoesDataService();
    this.aplicarDadosIniciais();

    // Se for modo cautelar, etapa é única (mapa)
    if (this.modo === 'cautelar') {
      this.etapaAtual.set(2);
      if (!this.perimetroMetros()) {
        this.perimetroMetros.set(50);
      }
      setTimeout(() => this.inicializarMapa(), 150);
    }
  }

  ngOnDestroy(): void {
    this.destruirMapa();
    this.destruirFabric();
  }

  private carregarOpcoesDataService(): void {
    this.opcoesSistemasEstruturais = this.dataService.getTipologiasEstruturais();
    this.opcoesSistemasFundacao = this.dataService.getTipologiasFundacoes();

    if (!this.sistemaEstrutural() && this.opcoesSistemasEstruturais.length > 0) {
      this.sistemaEstrutural.set(this.opcoesSistemasEstruturais[0]);
    }
    if (!this.sistemaFundacao() && this.opcoesSistemasFundacao.length > 0) {
      this.sistemaFundacao.set(this.opcoesSistemasFundacao[0]);
    }
  }

  private aplicarDadosIniciais(): void {
    if (!this.dadosIniciais) return;
    const d = this.dadosIniciais;
    if (d.denominacao) this.denominacao.set(d.denominacao);
    if (d.endereco) this.endereco.set(d.endereco);
    if (d.tipoUso) this.tipoUso.set(d.tipoUso);
    if (d.areaConstruida) this.areaConstruida.set(d.areaConstruida);
    if (d.numeroPavimentos) this.numeroPavimentos.set(d.numeroPavimentos);
    if (d.anoConstrucao) this.anoConstrucao.set(d.anoConstrucao);
    if (d.sistemaEstrutural) this.sistemaEstrutural.set(d.sistemaEstrutural);
    if (d.sistemaFundacao) this.sistemaFundacao.set(d.sistemaFundacao);
    if (d.observacoes) this.observacoes.set(d.observacoes);
    if (d.lat !== undefined && d.lat !== null) this.lat.set(d.lat);
    if (d.lng !== undefined && d.lng !== null) this.lng.set(d.lng);
    if (d.perimetroMetros) this.perimetroMetros.set(d.perimetroMetros);
    if (d.memorialDescritivo) this.memorialGerado.set(d.memorialDescritivo);
    if (d.mapaBase64) this.mapaBase64.set(d.mapaBase64);
    if (d.fotos && d.fotos.length > 0) this.fotos.set([...d.fotos]);
  }

  // ── Compressão de fotos (padrão nativo do app) ───────────────────────────────
  async onFotosChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const limite = 6;
    const vagas = Math.max(0, limite - this.fotos().length);

    if (vagas === 0) {
      this.toastService.show(`Limite de ${limite} fotos atingido.`, 'info');
      input.value = '';
      return;
    }

    const selecionados = files.slice(0, vagas);

    for (const file of selecionados) {
      try {
        const compressed = await this.comprimirImagem(file);
        const novaFoto: FotoObra = {
          dataUrl: compressed,
          timestamp: new Date().toISOString(),
          legenda: file.name.replace(/\.[^/.]+$/, ''),
        };
        this.fotos.update(arr => [...arr, novaFoto]);
      } catch (err) {
        console.warn('Erro ao processar imagem:', err);
      }
    }

    input.value = '';
  }

  removerFoto(index: number): void {
    this.fotos.update(arr => arr.filter((_, i) => i !== index));
  }

  atualizarLegendaFoto(index: number, legenda: string): void {
    this.fotos.update(arr =>
      arr.map((f, i) => i === index ? { ...f, legenda } : f)
    );
  }

  private comprimirImagem(file: File, maxDim = 1280, qualidade = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', qualidade));
        };
        img.onerror = () => reject(new Error('Falha ao decodificar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  // ── Navegação de Etapas ─────────────────────────────────────────────────────
  irParaEtapa(etapa: 1 | 2 | 3): void {
    if (etapa === 2) {
      this.etapaAtual.set(2);
      setTimeout(() => {
        this.inicializarMapa();
        if (this.endereco().trim() && (!this.lat() || !this.lng())) {
          this.geocodificarEndereco();
        }
      }, 150);
    } else if (etapa === 3) {
      if (this.modo === 'cautelar') return;
      this.etapaAtual.set(3);
      setTimeout(() => {
        this.capturarMapaParaFabric();
      }, 200);
    } else {
      this.etapaAtual.set(1);
    }
  }

  // ── Leaflet Map Setup ───────────────────────────────────────────────────────
  private inicializarMapa(): void {
    const el = this.mapContainerRef?.nativeElement || document.getElementById('mapa-leaflet-container');
    if (!el) return;

    if (this.mapInstance) {
      this.mapInstance.invalidateSize();
      return;
    }

    const defaultLat = this.lat() ?? -23.55052;
    const defaultLng = this.lng() ?? -46.633308;

    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    this.mapInstance = L.map(el, {
      center: [defaultLat, defaultLng],
      zoom: 17,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true
    }).addTo(this.mapInstance);

    this.markerInstance = L.marker([defaultLat, defaultLng], {
      draggable: true,
      icon: defaultIcon
    }).addTo(this.mapInstance);

    this.markerInstance.on('dragend', () => {
      const pos = this.markerInstance?.getLatLng();
      if (pos) {
        this.lat.set(Number(pos.lat.toFixed(6)));
        this.lng.set(Number(pos.lng.toFixed(6)));
        this.atualizarCirculoPerimetro();
      }
    });

    if (this.modo === 'cautelar') {
      this.atualizarCirculoPerimetro();
    }

    setTimeout(() => {
      this.mapInstance?.invalidateSize();
    }, 200);
  }

  atualizarCirculoPerimetro(): void {
    if (!this.mapInstance) return;
    const curLat = this.lat() ?? -23.55052;
    const curLng = this.lng() ?? -46.633308;
    const raio = Number(this.perimetroMetros()) || 50;

    if (this.circleInstance) {
      this.circleInstance.setLatLng([curLat, curLng]);
      this.circleInstance.setRadius(raio);
    } else {
      this.circleInstance = L.circle([curLat, curLng], {
        radius: raio,
        color: '#e27832',
        fillColor: '#f3ae83',
        fillOpacity: 0.35,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(this.mapInstance);
    }
  }

  onPerimetroChange(novoRaio: number | string): void {
    const r = Number(novoRaio);
    this.perimetroMetros.set(r > 0 ? r : null);
    this.atualizarCirculoPerimetro();
  }

  async geocodificarEndereco(): Promise<void> {
    const query = this.endereco().trim();
    if (!query) {
      this.toastService.show('Digite um endereço para localizar.', 'info');
      return;
    }

    this.buscandoEndereco.set(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
      const data = await res.json();

      if (data && data.length > 0) {
        const item = data[0];
        const newLat = parseFloat(item.lat);
        const newLng = parseFloat(item.lon);

        this.lat.set(Number(newLat.toFixed(6)));
        this.lng.set(Number(newLng.toFixed(6)));

        if (this.mapInstance) {
          this.mapInstance.setView([newLat, newLng], 17);
          if (this.markerInstance) {
            this.markerInstance.setLatLng([newLat, newLng]);
          }
          this.atualizarCirculoPerimetro();
        }
        this.toastService.show('Localização encontrada no mapa!', 'success');
      } else {
        this.toastService.show('Endereço não encontrado automaticamente. Arraste o pino no mapa.', 'info');
      }
    } catch {
      this.toastService.show('Não foi possível geocodificar. Posicione o pino no mapa.', 'info');
    } finally {
      this.buscandoEndereco.set(false);
    }
  }

  private destruirMapa(): void {
    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
      this.markerInstance = null;
      this.circleInstance = null;
    }
  }

  // ── Captura Direta no Modo Cautelar ─────────────────────────────────────────
  async capturarMapaCautelar(): Promise<void> {
    const el = this.mapContainerRef?.nativeElement || document.getElementById('mapa-leaflet-container');
    if (!el) return;

    this.capturandoMapa.set(true);
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/png');
      this.mapaBase64.set(dataUrl);
      this.toastService.show('Mapa de situação da Obra Geradora capturado com sucesso!', 'success');
    } catch (err) {
      console.warn('Erro ao capturar mapa:', err);
      this.toastService.show('Erro ao capturar imagem do mapa.', 'error');
    } finally {
      this.capturandoMapa.set(false);
    }
  }

  // ── Fabric.js Anotações (Modo LTIP - Etapa 3) ────────────────────────────────
  private async capturarMapaParaFabric(): Promise<void> {
    const el = this.mapContainerRef?.nativeElement || document.getElementById('mapa-leaflet-container');
    if (!el) return;

    this.capturandoMapa.set(true);
    try {
      const capturedCanvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        logging: false
      });
      const mapPng = capturedCanvas.toDataURL('image/png');
      await this.inicializarFabric(mapPng, capturedCanvas.width, capturedCanvas.height);
    } catch (err) {
      console.warn('Erro ao capturar mapa para edição:', err);
      this.toastService.show('Erro ao inicializar editor gráfico.', 'error');
    } finally {
      this.capturandoMapa.set(false);
    }
  }

  private async inicializarFabric(bgDataUrl: string, origWidth: number, origHeight: number): Promise<void> {
    this.destruirFabric();

    const canvasEl = this.canvasElementRef?.nativeElement || document.getElementById('editor-fabric-canvas') as HTMLCanvasElement;
    if (!canvasEl) return;

    const containerWidth = canvasEl.parentElement?.clientWidth || 720;
    const targetWidth = Math.min(containerWidth, 800);
    const aspectRatio = origHeight / (origWidth || 1);
    const targetHeight = Math.round(targetWidth * (aspectRatio || 0.65));

    canvasEl.width = targetWidth;
    canvasEl.height = targetHeight;

    this.fabricCanvas = new fabric.Canvas(canvasEl, {
      selection: true,
      preserveObjectStacking: true,
      width: targetWidth,
      height: targetHeight
    });

    try {
      const bgImg = await fabric.FabricImage.fromURL(bgDataUrl, { crossOrigin: 'anonymous' });
      bgImg.scaleToWidth(targetWidth);
      bgImg.scaleToHeight(targetHeight);
      this.fabricCanvas.backgroundImage = bgImg;
      this.fabricCanvas.renderAll();
    } catch {
      // Fallback
    }

    this.fabricCanvas.on('selection:created', () => this.objetoSelecionado.set(true));
    this.fabricCanvas.on('selection:updated', () => this.objetoSelecionado.set(true));
    this.fabricCanvas.on('selection:cleared', () => this.objetoSelecionado.set(false));

    this.aplicarFerramentaFabric('select');
    this.salvarEstadoHistorico();
  }

  selecionarFerramenta(ferramenta: FerramentaDesenho): void {
    this.ferramentaAtiva.set(ferramenta);
    this.aplicarFerramentaFabric(ferramenta);
  }

  selecionarCor(hex: string): void {
    this.corAtiva.set(hex);
    if (this.fabricCanvas) {
      if (this.fabricCanvas.freeDrawingBrush) {
        this.fabricCanvas.freeDrawingBrush.color = hex;
      }
      const active = this.fabricCanvas.getActiveObject();
      if (active) {
        if (active.type === 'i-text' || active.type === 'text') {
          active.set('fill', hex);
        } else if (active.type === 'line' || active.type === 'path') {
          active.set('stroke', hex);
        } else if (active.type === 'rect') {
          active.set('stroke', hex);
        }
        this.fabricCanvas.renderAll();
        this.salvarEstadoHistorico();
      }
    }
  }

  selecionarEspessura(espessura: number): void {
    this.espessuraAtiva.set(espessura);
    if (this.fabricCanvas?.freeDrawingBrush) {
      this.fabricCanvas.freeDrawingBrush.width = espessura;
    }
    const active = this.fabricCanvas?.getActiveObject();
    if (active && (active.type === 'line' || active.type === 'rect')) {
      active.set('strokeWidth', espessura);
      this.fabricCanvas?.renderAll();
      this.salvarEstadoHistorico();
    }
  }

  private aplicarFerramentaFabric(ferramenta: FerramentaDesenho): void {
    if (!this.fabricCanvas) return;

    this.fabricCanvas.isDrawingMode = false;
    this.fabricCanvas.defaultCursor = 'default';

    const cor = this.corAtiva();
    const espessura = this.espessuraAtiva();
    const center = this.fabricCanvas.getCenterPoint();

    if (ferramenta === 'pen') {
      this.fabricCanvas.isDrawingMode = true;
      if (this.fabricCanvas.freeDrawingBrush) {
        this.fabricCanvas.freeDrawingBrush.color = cor;
        this.fabricCanvas.freeDrawingBrush.width = espessura;
      }
    } else if (ferramenta === 'line') {
      const line = new fabric.Line([center.x - 60, center.y, center.x + 60, center.y], {
        stroke: cor,
        strokeWidth: espessura,
        strokeLineCap: 'round',
        selectable: true
      });
      this.fabricCanvas.add(line);
      this.fabricCanvas.setActiveObject(line);
      this.fabricCanvas.renderAll();
      this.salvarEstadoHistorico();
      this.ferramentaAtiva.set('select');
    } else if (ferramenta === 'arrow') {
      const line = new fabric.Line([0, 0, 80, 0], {
        stroke: cor,
        strokeWidth: espessura,
        originX: 'center',
        originY: 'center'
      });
      const triangle = new fabric.Triangle({
        width: 14 + espessura * 2,
        height: 16 + espessura * 2,
        fill: cor,
        left: 80,
        top: 0,
        angle: 90,
        originX: 'center',
        originY: 'center'
      });
      const arrow = new fabric.Group([line, triangle], {
        left: center.x - 40,
        top: center.y - 10,
        selectable: true
      });
      this.fabricCanvas.add(arrow);
      this.fabricCanvas.setActiveObject(arrow);
      this.fabricCanvas.renderAll();
      this.salvarEstadoHistorico();
      this.ferramentaAtiva.set('select');
    } else if (ferramenta === 'rect') {
      const rect = new fabric.Rect({
        left: center.x - 50,
        top: center.y - 35,
        width: 100,
        height: 70,
        fill: 'transparent',
        stroke: cor,
        strokeWidth: espessura,
        rx: 4,
        ry: 4,
        selectable: true
      });
      this.fabricCanvas.add(rect);
      this.fabricCanvas.setActiveObject(rect);
      this.fabricCanvas.renderAll();
      this.salvarEstadoHistorico();
      this.ferramentaAtiva.set('select');
    } else if (ferramenta === 'box_fill') {
      const fillRect = new fabric.Rect({
        left: center.x - 60,
        top: center.y - 45,
        width: 120,
        height: 90,
        fill: this.hexParaRgba(cor, 0.3),
        stroke: cor,
        strokeWidth: espessura,
        rx: 4,
        ry: 4,
        selectable: true
      });
      this.fabricCanvas.add(fillRect);
      this.fabricCanvas.setActiveObject(fillRect);
      this.fabricCanvas.renderAll();
      this.salvarEstadoHistorico();
      this.ferramentaAtiva.set('select');
    } else if (ferramenta === 'text') {
      const text = new fabric.IText('Edificação Principal', {
        left: center.x - 70,
        top: center.y - 15,
        fontSize: 16,
        fill: cor,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'bold',
        selectable: true
      });
      this.fabricCanvas.add(text);
      this.fabricCanvas.setActiveObject(text);
      this.fabricCanvas.renderAll();
      this.salvarEstadoHistorico();
      this.ferramentaAtiva.set('select');
    }
  }

  private hexParaRgba(hex: string, alpha: number): string {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  excluirObjetoSelecionado(): void {
    if (!this.fabricCanvas) return;
    const activeObjects = this.fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => this.fabricCanvas?.remove(obj));
      this.fabricCanvas.discardActiveObject();
      this.fabricCanvas.renderAll();
      this.salvarEstadoHistorico();
    }
  }

  desfazerUltimaAcao(): void {
    if (!this.fabricCanvas || this.historyStack.length <= 1) return;
    this.historyStack.pop(); // Remove estado atual
    const prevState = this.historyStack[this.historyStack.length - 1];
    if (prevState) {
      this.fabricCanvas.loadFromJSON(JSON.parse(prevState)).then(() => {
        this.fabricCanvas?.renderAll();
      });
    }
  }

  limparAnotacoes(): void {
    if (!this.fabricCanvas) return;
    const objects = this.fabricCanvas.getObjects();
    objects.forEach(obj => this.fabricCanvas?.remove(obj));
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.renderAll();
    this.salvarEstadoHistorico();
  }

  private salvarEstadoHistorico(): void {
    if (!this.fabricCanvas) return;
    const json = JSON.stringify(this.fabricCanvas.toJSON());
    this.historyStack.push(json);
    if (this.historyStack.length > 15) {
      this.historyStack.shift();
    }
  }

  // ── "Usar este mapa": Carimbo de Rodapé e Exportação ─────────────────────────
  salvarMapaEditado(): void {
    if (!this.fabricCanvas) return;

    // Criar faixa inferior com informações técnicas padronizadas
    const w = this.fabricCanvas.getWidth();
    const h = this.fabricCanvas.getHeight();
    const footerHeight = 44;

    const bgFooter = new fabric.Rect({
      left: 0,
      top: h - footerHeight,
      width: w,
      height: footerHeight,
      fill: '#132a41',
      selectable: false,
      evented: false
    });

    const infoTexto = [
      this.denominacao() ? `Edificação: ${this.denominacao()}` : '',
      this.areaConstruida() ? `Área: ${this.areaConstruida()} m²` : '',
      this.numeroPavimentos() ? `Pav: ${this.numeroPavimentos()}` : '',
      this.lat() && this.lng() ? `Coord: ${this.lat()}, ${this.lng()}` : ''
    ].filter(Boolean).join('  |  ');

    const labelHeader = new fabric.Text('PREDIAL 4.0 · MAPA DE SITUAÇÃO E LOCALIZAÇÃO', {
      left: 12,
      top: h - footerHeight + 6,
      fontSize: 10,
      fill: '#f3ae83',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 'bold',
      selectable: false,
      evented: false
    });

    const labelSub = new fabric.Text(infoTexto || (this.endereco() ? `End: ${this.endereco()}` : 'Inspeção Predial LTIP'), {
      left: 12,
      top: h - footerHeight + 22,
      fontSize: 9,
      fill: '#ffffff',
      fontFamily: 'Inter, sans-serif',
      selectable: false,
      evented: false
    });

    this.fabricCanvas.add(bgFooter, labelHeader, labelSub);
    this.fabricCanvas.renderAll();

    const dataUrl = this.fabricCanvas.toDataURL({
      format: 'png',
      multiplier: 2
    });

    this.mapaBase64.set(dataUrl);
    this.toastService.show('Mapa de localização salvo com sucesso!', 'success');
  }

  private destruirFabric(): void {
    if (this.fabricCanvas) {
      this.fabricCanvas.dispose();
      this.fabricCanvas = null;
      this.historyStack = [];
    }
  }

  // ── Geração de Memorial Descritivo com Gemini AI ─────────────────────────────
  async gerarMemorialComIA(): Promise<void> {
    const dados = {
      denominacao: this.denominacao().trim(),
      endereco: this.endereco().trim(),
      tipoUso: this.tipoUso(),
      areaConstruida: this.areaConstruida().trim(),
      numeroPavimentos: this.numeroPavimentos().trim(),
      anoConstrucao: this.anoConstrucao().trim(),
      sistemaEstrutural: this.sistemaEstrutural().trim(),
      sistemaFundacao: this.sistemaFundacao().trim(),
      observacoes: this.observacoes().trim()
    };

    if (!dados.endereco && !dados.denominacao) {
      this.toastService.show('Preencha ao menos o endereço ou denominação da edificação.', 'info');
      return;
    }

    this.gerandoMemorial.set(true);

    const prompt = `Você é um Engenheiro Diagnóstico Especialista em Inspeção Predial (normas ABNT NBR 16747 e diretrizes do IBAPE).
Elabore o "Memorial Descritivo e Caracterização da Edificação" para a Seção 4 do Laudo Técnico de Inspeção Predial (LTIP).

DADOS DA EDIFICAÇÃO:
- Denominação: ${dados.denominacao || 'Não informada'}
- Endereço / Localização: ${dados.endereco || 'Não informado'}
- Tipologia de Uso: ${dados.tipoUso}
- Área Construída Estimada: ${dados.areaConstruida ? dados.areaConstruida + ' m²' : 'Não informada'}
- Número de Pavimentos: ${dados.numeroPavimentos || 'Não informado'}
- Ano / Idade Estimada da Construção: ${dados.anoConstrucao || 'Não informado'}
- Sistema Estrutural Predominante: ${dados.sistemaEstrutural || 'Concreto armado convencional'}
- Sistema de Fundação: ${dados.sistemaFundacao || 'Fundações profundas/superficiais'}
- Observações de Campo: ${dados.observacoes || 'Nenhuma observação complementar'}

REGRAS TÉCNICAS MANDATÓRIAS:
1. Redija um texto técnico, fluido, formal e objetivo, com 3 a 5 parágrafos coesos.
2. Descreva a inserção urbana da edificação, características construtivas, tipologia arquitetônica e funcionalidade dos pavimentos.
3. Se houver fotos anexadas, analise-as cuidadosamente para enriquecer a descrição da fachada, padrão de acabamento aparente, esquadrias e envoltória.
4. Por se tratar de Vistoria de Constatação / Inspeção Predial, é TERMINANTEMENTE PROIBIDO adicionar qualquer menção a causas de danos, culpabilidade, responsabilidades ou soluções de reparo. Concentre-se exclusivamente na caracterização e estado aparente.
5. Retorne APENAS o texto do Memorial Descritivo, sem introduções de chat, títulos externos ou markdown excessivo.`;

    try {
      let textoResultado = '';

      if (this.fotos().length > 0) {
        // Envio multimodal com fotos convertidas para inlineData
        const imagensPayload = this.fotos().map(f => {
          const parts = f.dataUrl.split(',');
          const mimeMatch = parts[0]?.match(/:(.*?);/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const base64 = parts[1] || '';
          return { base64, mimeType };
        }).filter(img => Boolean(img.base64));

        textoResultado = await this.geminiService.generateTextWithImages(prompt, imagensPayload);
      } else {
        textoResultado = await this.geminiService.generateText(prompt);
      }

      const sanitizado = this.geminiService.sanitizeAiText(textoResultado);
      this.memorialGerado.set(sanitizado);
      this.toastService.show('Memorial Descritivo gerado com sucesso!', 'success');
    } catch (err: any) {
      console.warn('Erro ao gerar memorial com IA:', err);
      this.toastService.show('Não foi possível gerar com IA. Você pode digitar ou editar o memorial manualmente.', 'info', 6000);
    } finally {
      this.gerandoMemorial.set(false);
    }
  }

  copiarMemorial(): void {
    const txt = this.memorialGerado().trim();
    if (!txt) return;
    navigator.clipboard.writeText(txt).then(() => {
      this.memorialCopiado.set(true);
      setTimeout(() => this.memorialCopiado.set(false), 2000);
    });
  }

  // ── Concluir e Emitir Dados ──────────────────────────────────────────────────
  concluir(): void {
    const dados: DadosCaracterizacao = {
      denominacao: this.denominacao().trim(),
      endereco: this.endereco().trim(),
      tipoUso: this.tipoUso(),
      areaConstruida: this.areaConstruida().trim(),
      numeroPavimentos: this.numeroPavimentos().trim(),
      anoConstrucao: this.anoConstrucao().trim(),
      sistemaEstrutural: this.sistemaEstrutural(),
      sistemaFundacao: this.sistemaFundacao(),
      observacoes: this.observacoes().trim(),
      lat: this.lat() ?? undefined,
      lng: this.lng() ?? undefined,
      perimetroMetros: this.perimetroMetros() ?? undefined,
      mapaBase64: this.mapaBase64() ?? undefined,
      memorialDescritivo: this.memorialGerado().trim() || undefined,
      fotos: this.fotos().length > 0 ? this.fotos() : undefined
    };

    this.dadosGerados.emit(dados);
  }
}
