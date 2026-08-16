import { Component, ChangeDetectionStrategy, output, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { SupabaseService } from '../../services/supabase.service';

export type LoginModo = 'login' | 'cadastro' | 'recuperar' | 'nova-senha';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class LoginComponent implements OnInit {
  loginAsGuest = output<void>();

  modo = signal<LoginModo>('login');

  // Campos do formulário
  nome = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  loading = signal(false);

  private toastService = inject(ToastService);
  private supabaseService = inject(SupabaseService);

  ngOnInit(): void {
    // Detecta se a URL contém tokens de redefinição de senha (ex: type=recovery ou /redefinir-senha)
    const isRecovery =
      window.location.hash.includes('type=recovery') ||
      window.location.search.includes('type=recovery') ||
      window.location.pathname.includes('redefinir-senha');

    if (isRecovery) {
      this.modo.set('nova-senha');
    }

    this.supabaseService.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.modo.set('nova-senha');
      }
    });
  }

  setModo(novoModo: LoginModo): void {
    this.modo.set(novoModo);
    this.password.set('');
    this.confirmPassword.set('');
    this.loading.set(false);
  }

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  // ESTADO: LOGIN (e-mail + senha)
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
        // Mensagem clara para erro de credencial ou usuários legados de magic link
        this.toastService.show(
          'E-mail ou senha incorretos. Se você usava o login por link antes desta atualização, clique em "Esqueceu a senha?" para definir uma senha nova.',
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

  // ESTADO: CADASTRO (conta nova)
  async handleCadastro(): Promise<void> {
    const nomeVal = this.nome().trim();
    const emailVal = this.email().trim();
    const passVal = this.password();
    const confirmVal = this.confirmPassword();

    if (!emailVal || !emailVal.includes('@')) {
      this.toastService.show('Por favor, informe um e-mail válido.', 'error');
      return;
    }

    if (passVal.length < 8) {
      this.toastService.show('A senha deve ter no mínimo 8 caracteres.', 'error');
      return;
    }

    if (passVal !== confirmVal) {
      this.toastService.show('As senhas digitadas não coincidem. Verifique e tente novamente.', 'error');
      return;
    }

    this.loading.set(true);
    try {
      const { error } = await this.supabaseService.signUpWithPassword(emailVal, passVal, {
        data: nomeVal ? { full_name: nomeVal } : undefined,
      });

      if (error) {
        this.toastService.show(`Erro ao criar conta: ${error.message}`, 'error');
      } else {
        this.toastService.show('Conta criada! Verifique seu e-mail para confirmar o cadastro.', 'success');
        this.setModo('login');
      }
    } catch {
      this.toastService.show('Ocorreu um erro ao processar o cadastro.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  // ESTADO: RECUPERAR SENHA (esqueci minha senha)
  async handleRecuperarSenha(): Promise<void> {
    const emailVal = this.email().trim();

    if (!emailVal || !emailVal.includes('@')) {
      this.toastService.show('Por favor, informe um e-mail válido.', 'error');
      return;
    }

    this.loading.set(true);
    try {
      const { error } = await this.supabaseService.resetPasswordForEmail(emailVal);
      if (error) {
        this.toastService.show(`Erro ao solicitar redefinição: ${error.message}`, 'error');
      } else {
        // Mensagem genérica por segurança
        this.toastService.show(
          'Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha.',
          'success'
        );
        this.setModo('login');
      }
    } catch {
      this.toastService.show('Ocorreu um erro ao solicitar a redefinição de senha.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  // ESTADO: NOVA SENHA (redefinição após clicar no link do e-mail)
  async handleSalvarNovaSenha(): Promise<void> {
    const passVal = this.password();
    const confirmVal = this.confirmPassword();

    if (passVal.length < 8) {
      this.toastService.show('A nova senha deve ter no mínimo 8 caracteres.', 'error');
      return;
    }

    if (passVal !== confirmVal) {
      this.toastService.show('As senhas digitadas não coincidem. Verifique e tente novamente.', 'error');
      return;
    }

    this.loading.set(true);
    try {
      const { error } = await this.supabaseService.updatePassword(passVal);
      if (error) {
        this.toastService.show(`Erro ao redefinir senha: ${error.message}`, 'error');
      } else {
        this.toastService.show('Senha redefinida com sucesso! Faça login com sua nova senha.', 'success');
        await this.supabaseService.signOut();
        // Limpa hash de recuperação se houver
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        this.setModo('login');
      }
    } catch {
      this.toastService.show('Ocorreu um erro ao salvar a nova senha.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  handleGuestAccess(): void {
    this.loginAsGuest.emit();
  }
}