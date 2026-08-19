import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  effect,
  HostListener,
  ElementRef,
  output,
} from '@angular/core';
import { TourService } from '../../services/tour.service';
import { TourStep } from '../../models/tour.model';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tourService.isTourAtivo() && tourService.passoAtual(); as passo) {
      <div class="fixed inset-0 z-50 pointer-events-auto select-none overflow-hidden font-sans">
        
        <!-- Backdrop Backdrop Overlay -->
        @if (targetRect(); as rect) {
          <!-- SVG Cutout Mask or Box-shadow Spotlight -->
          <div class="absolute inset-0 bg-slate-950/70 transition-all duration-300 backdrop-blur-[1.5px]"
               (click)="pular()">
          </div>

          <!-- Highlight Box around target element -->
          <div 
            class="absolute pointer-events-none rounded-2xl border-2 border-sky-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.75),0_0_25px_rgba(56,189,248,0.45)] transition-all duration-300 ease-out z-10 animate-pulse"
            [style.top.px]="rect.top - 6"
            [style.left.px]="rect.left - 6"
            [style.width.px]="rect.width + 12"
            [style.height.px]="rect.height + 12">
          </div>
        } @else {
          <!-- Full dark backdrop when no specific target is selected -->
          <div class="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] transition-opacity duration-300"
               (click)="pular()">
          </div>
        }

        <!-- Tooltip Card -->
        <div 
          class="fixed z-20 transition-all duration-300 ease-out"
          [style.top]="cardPosition().top"
          [style.left]="cardPosition().left"
          [style.transform]="cardPosition().transform"
          [style.max-width.px]="420"
          [style.width]="'calc(100vw - 32px)'">
          
          <div class="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col justify-between animate-fade-in text-slate-800">
            
            <!-- Header -->
            <div class="bg-gradient-to-r from-slate-900 to-sky-950 text-white p-5 sm:p-6 relative">
              <div class="flex items-center justify-between gap-2">
                <span class="bg-sky-500 text-slate-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Passo {{ tourService.indiceAtual() + 1 }} de {{ tourService.totalPassos() }}
                </span>
                <button 
                  type="button"
                  (click)="pular()" 
                  class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Pular Tour">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <h4 class="text-lg sm:text-xl font-black mt-2 text-white leading-tight">
                {{ passo.titulo }}
              </h4>
            </div>

            <!-- Body Content -->
            <div class="p-5 sm:p-6 space-y-4">
              <p class="text-slate-600 text-xs sm:text-sm leading-relaxed">
                {{ passo.descricao }}
              </p>
            </div>

            <!-- Footer Actions -->
            <div class="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <button 
                type="button"
                (click)="pular()" 
                class="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                Pular tour
              </button>

              <div class="flex items-center gap-2">
                <button 
                  type="button"
                  (click)="anterior()" 
                  [disabled]="tourService.indiceAtual() === 0"
                  class="px-3.5 py-2 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors">
                  Anterior
                </button>
                <button 
                  type="button"
                  (click)="proximo()" 
                  class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-md shadow-sky-600/20">
                  {{ tourService.indiceAtual() === tourService.totalPassos() - 1 ? 'Concluir' : 'Próximo' }}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    }
  `
})
export class TourOverlayComponent {
  public tourService = inject(TourService);
  private el = inject(ElementRef);

  tourEnded = output<void>();

  targetRect = signal<SpotlightRect | null>(null);
  cardPosition = signal<{ top: string; left: string; transform: string }>({
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  });

  private retryTimeoutId: any = null;

  constructor() {
    effect(() => {
      const isAtivo = this.tourService.isTourAtivo();
      const passo = this.tourService.passoAtual();

      if (!isAtivo || !passo) {
        this.targetRect.set(null);
        return;
      }

      this.atualizarPosicao(passo);
    });
  }

  @HostListener('window:resize')
  @HostListener('window:scroll', ['$event'])
  onWindowChange(): void {
    const passo = this.tourService.passoAtual();
    if (this.tourService.isTourAtivo() && passo) {
      this.atualizarPosicao(passo, false);
    }
  }

  private atualizarPosicao(passo: TourStep, shouldScroll: boolean = true): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    if (!passo.targetSelector) {
      this.targetRect.set(null);
      this.cardPosition.set({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      });
      return;
    }

    const elemento = document.querySelector(passo.targetSelector) as HTMLElement | null;

    if (!elemento) {
      // Tenta novamente após 200ms
      this.retryTimeoutId = setTimeout(() => {
        const elementoRetry = document.querySelector(passo.targetSelector!) as HTMLElement | null;
        if (elementoRetry) {
          this.posicionarComElemento(elementoRetry, passo, shouldScroll);
        } else {
          console.warn(`TourOverlay: elemento alvo não encontrado: ${passo.targetSelector}`);
          this.targetRect.set(null);
          this.cardPosition.set({
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          });
        }
      }, 250);
      return;
    }

    this.posicionarComElemento(elemento, passo, shouldScroll);
  }

  private posicionarComElemento(elemento: HTMLElement, passo: TourStep, shouldScroll: boolean): void {
    if (shouldScroll) {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    const rect = elemento.getBoundingClientRect();
    const spotlight: SpotlightRect = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
    this.targetRect.set(spotlight);

    // Calcular posição do Card
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const cardWidth = Math.min(420, windowWidth - 32);
    const cardHeightEst = 260; // estimativa de altura

    let posicaoDesejada = passo.posicaoBalao ?? 'bottom';

    // Determina melhor posição se extrapolar tela
    if (posicaoDesejada === 'bottom' && rect.bottom + cardHeightEst + 20 > windowHeight) {
      if (rect.top - cardHeightEst - 20 > 0) {
        posicaoDesejada = 'top';
      }
    } else if (posicaoDesejada === 'top' && rect.top - cardHeightEst - 20 < 0) {
      if (rect.bottom + cardHeightEst + 20 < windowHeight) {
        posicaoDesejada = 'bottom';
      }
    }

    if (posicaoDesejada === 'top') {
      let left = rect.left + rect.width / 2;
      // Clamp para ficar dentro da tela
      left = Math.max(cardWidth / 2 + 16, Math.min(windowWidth - cardWidth / 2 - 16, left));
      const top = Math.max(16, rect.top - 16);
      this.cardPosition.set({
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translate(-50%, -100%)',
      });
    } else if (posicaoDesejada === 'right') {
      let top = rect.top + rect.height / 2;
      top = Math.max(cardHeightEst / 2 + 16, Math.min(windowHeight - cardHeightEst / 2 - 16, top));
      const left = Math.min(windowWidth - cardWidth - 16, rect.right + 16);
      this.cardPosition.set({
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translate(0, -50%)',
      });
    } else if (posicaoDesejada === 'left') {
      let top = rect.top + rect.height / 2;
      top = Math.max(cardHeightEst / 2 + 16, Math.min(windowHeight - cardHeightEst / 2 - 16, top));
      const left = Math.max(16, rect.left - cardWidth - 16);
      this.cardPosition.set({
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translate(0, -50%)',
      });
    } else if (posicaoDesejada === 'center') {
      this.cardPosition.set({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      });
    } else {
      // bottom
      let left = rect.left + rect.width / 2;
      left = Math.max(cardWidth / 2 + 16, Math.min(windowWidth - cardWidth / 2 - 16, left));
      const top = Math.min(windowHeight - cardHeightEst - 16, rect.bottom + 16);
      this.cardPosition.set({
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translate(-50%, 0)',
      });
    }
  }

  proximo(): void {
    this.tourService.proximo();
    if (!this.tourService.isTourAtivo()) {
      this.tourEnded.emit();
    }
  }

  anterior(): void {
    this.tourService.anterior();
  }

  pular(): void {
    this.tourService.encerrar();
    this.tourEnded.emit();
  }
}
