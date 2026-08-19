export interface FotoObra {
  dataUrl: string;
  timestamp: string;
  legenda?: string; // ex: "Fachada principal", "Planta baixa do pavimento térreo", "Vista do canteiro — acesso norte"
}

export interface DadosCaracterizacao {
  // Campos comuns aos dois produtos (LTIP completo e Cautelar simplificado)
  endereco: string;
  latitude?: number;
  longitude?: number;
  perimetroMetros?: number; // usado especificamente pelo modo Cautelar

  // Campos exclusivos do modo LTIP completo (opcionais no modo Cautelar)
  denominacao?: string;
  tipoUso?: string;
  areaConstruida?: string;
  numeroPavimentos?: string;
  anoConstucao?: string;
  sistemaEstrutural?: string;
  sistemaFundacao?: string;
  observacoesAdicionais?: string;

  // Compartilhado pelos dois: fotos/projetos do canteiro ou da edificação
  fotos: FotoObra[];

  // Saída gerada
  mapaBase64?: string; // PNG do mapa anotado, gerado no canvas da própria tela
  memorialDescritivo?: string; // texto gerado pela IA via Edge Function
}
