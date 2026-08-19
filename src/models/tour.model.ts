export interface TourStep {
  id: string;                    // identificador único do passo, ex: 'visao-geral-boas-vindas'
  view: string;                  // valor de activeView necessário para este passo ('visao-geral', 'checklist', 'cautelar', 'orcamento', 'admin', ou 'perfil'/'notificacoes' para modais)
  targetSelector: string | null; // seletor CSS do elemento a destacar (via atributo data-tour-id, ex: '[data-tour-id="btn-nova-vistoria"]'). null = destaca a tela inteira, sem foco em elemento específico.
  titulo: string;
  descricao: string;
  posicaoBalao?: 'top' | 'bottom' | 'left' | 'right' | 'center'; // padrão 'bottom' se omitido
  acaoAoEntrar?: 'abrir-modal-perfil' | 'abrir-modal-notificacoes' | 'abrir-criacao-vistoria' | null;
}
