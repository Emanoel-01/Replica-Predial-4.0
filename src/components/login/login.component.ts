import { Component, ChangeDetectionStrategy, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class LoginComponent {
  loginAsGuest = output<void>();

  email = signal('');
  loading = signal(false);
  linkEnviado = signal(false);

  private toastService = inject(ToastService);
  private supabaseService = inject(SupabaseService);

  async handleLogin(): Promise<void> {
    const emailVal = this.email().trim();
    if (!emailVal) {
      this.toastService.show('Por favor, informe um e-mail válido.', 'error');
      return;
    }

    this.loading.set(true);
    try {
      const { error } = await this.supabaseService.signInWithOtp(emailVal);
      if (error) {
        this.toastService.show(`Erro ao enviar link: ${error.message}`, 'error');
      } else {
        this.linkEnviado.set(true);
        this.toastService.show('Link mágico de acesso enviado para seu e-mail!', 'success');
      }
    } catch (err: any) {
      this.toastService.show('Ocorreu um erro ao conectar com o serviço de autenticação.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  handleGuestAccess(): void {
    this.loginAsGuest.emit();
  }

  resetForm(): void {
    this.linkEnviado.set(false);
    this.email.set('');
  }
}