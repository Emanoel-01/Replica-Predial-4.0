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
  startGuestTour = output<void>();

  email = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);
  redefinindoSenha = signal(false);

  private toastService = inject(ToastService);
  private supabaseService = inject(SupabaseService);

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  async handleEsqueciSenha(): Promise<void> {
    const emailVal = this.email().trim();

    if (!emailVal || !emailVal.includes('@')) {
      this.toastService.show('Por favor, informe seu e-mail no campo acima para recuperar a senha.', 'info');
      return;
    }

    this.redefinindoSenha.set(true);
    try {
      const { error } = await this.supabaseService.resetPasswordForEmail(emailVal);
      if (error) {
        this.toastService.show('Não foi possível enviar o e-mail de recuperação: ' + error.message, 'error');
      } else {
        this.toastService.show('E-mail de recuperação enviado! Verifique sua caixa de entrada.', 'success');
      }
    } catch {
      this.toastService.show('Ocorreu um erro ao solicitar a recuperação de senha.', 'error');
    } finally {
      this.redefinindoSenha.set(false);
    }
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
          'E-mail ou senha incorretos. Se precisar, clique em "Esqueci minha senha" para redefinir sua senha.',
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
