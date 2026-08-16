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
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);

  private toastService = inject(ToastService);
  private supabaseService = inject(SupabaseService);

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  async handleLogin(): Promise<void> {
    const emailVal = this.email().trim();
    const passVal = this.password();

    if (!emailVal || !emailVal.includes('@')) {
      this.toastService.show('Por favor, informe um e-mail válido.', 'error');
      return;
    }

    if (!passVal) {
      this.toastService.show('Por favor, informe sua senha.', 'error');
      return;
    }

    this.loading.set(true);
    try {
      const { error } = await this.supabaseService.signInWithPassword(emailVal, passVal);
      if (error) {
        this.toastService.show(
          'E-mail ou senha incorretos. Se você usava o login por link antes desta atualização, clique em "Esqueceu a senha?" para definir sua senha na Comunidade.',
          'error'
        );
      } else {
        this.toastService.show('Login realizado com sucesso!', 'success');
      }
    } catch {
      this.toastService.show('Ocorreu um erro ao conectar com o serviço de autenticação.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  handleGuestAccess(): void {
    this.loginAsGuest.emit();
  }
}
