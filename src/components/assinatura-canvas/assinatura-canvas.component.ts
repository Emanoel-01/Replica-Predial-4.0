import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'app-assinatura-canvas',
  template: `
    <div class="relative w-full">
      <canvas
        #canvasEl
        class="w-full h-[180px] bg-white rounded-xl border border-slate-200 block touch-none select-none"
        [class.cursor-not-allowed]="disabled"
        [class.opacity-60]="disabled"
        [class.cursor-crosshair]="!disabled"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointerleave)="onPointerLeave($event)">
      </canvas>
      <div class="mt-2 flex justify-end">
        <button
          type="button"
          (click)="limpar()"
          [disabled]="disabled || estaVazio()"
          class="text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs">
          Limpar
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssinaturaCanvasComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() disabled = false;
  @Input() valorInicial?: string;
  @Output() assinaturaAlterada = new EventEmitter<string | null>();

  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private hasDrawing = false;
  private resizeObserver?: ResizeObserver;
  private lastX = 0;
  private lastY = 0;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.ajustarDimensoes();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.ajustarDimensoes();
      });
      this.resizeObserver.observe(canvas);
    }

    if (this.valorInicial) {
      this.carregarImagem(this.valorInicial);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['valorInicial'] && !changes['valorInicial'].firstChange) {
      if (this.valorInicial) {
        this.carregarImagem(this.valorInicial);
      } else {
        this.limpar();
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  estaVazio(): boolean {
    return !this.hasDrawing;
  }

  public limpar(): void {
    if (!this.ctx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;

    this.ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    this.hasDrawing = false;
    this.desenharLinhaGuia();
    this.assinaturaAlterada.emit(null);
  }

  private ajustarDimensoes(): void {
    if (!this.canvasRef || !this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width);
    const h = 180;

    if (canvas.width === Math.round(w * dpr) && canvas.height === Math.round(h * dpr)) {
      return;
    }

    const backup = this.hasDrawing ? canvas.toDataURL('image/png') : null;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.configurarEstiloPincel();

    if (backup) {
      this.carregarImagem(backup);
    } else {
      this.desenharLinhaGuia();
    }
  }

  private desenharLinhaGuia(): void {
    if (!this.ctx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = 180;
    const y = h * 0.75;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#CBD5E1';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.moveTo(16, y);
    this.ctx.lineTo(w - 16, y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private configurarEstiloPincel(): void {
    if (!this.ctx) return;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  private carregarImagem(dataUrl: string): void {
    if (!this.ctx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const img = new Image();
    img.onload = () => {
      if (!this.ctx) return;
      this.ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      this.desenharLinhaGuia();
      const rect = canvas.getBoundingClientRect();
      this.ctx.drawImage(img, 0, 0, rect.width, 180);
      this.hasDrawing = true;
    };
    img.src = dataUrl;
  }

  onPointerDown(event: PointerEvent): void {
    if (this.disabled || !this.ctx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    canvas.setPointerCapture?.(event.pointerId);

    this.isDrawing = true;
    this.hasDrawing = true;

    const rect = canvas.getBoundingClientRect();
    this.lastX = event.clientX - rect.left;
    this.lastY = event.clientY - rect.top;

    this.configurarEstiloPincel();
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(this.lastX, this.lastY);
    this.ctx.stroke();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDrawing || this.disabled || !this.ctx || !this.canvasRef) return;
    event.preventDefault();

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    this.lastX = x;
    this.lastY = y;
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    try {
      this.canvasRef?.nativeElement.releasePointerCapture?.(event.pointerId);
    } catch {}

    if (this.hasDrawing && this.canvasRef) {
      const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
      this.assinaturaAlterada.emit(dataUrl);
    }
  }

  onPointerLeave(event: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.hasDrawing && this.canvasRef) {
      const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
      this.assinaturaAlterada.emit(dataUrl);
    }
  }
}
