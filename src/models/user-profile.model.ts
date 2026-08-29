export type CategoriaProfissional = string;

export interface UserProfile {
  fullName: string;
  professionalTitle: string;
  professionalId?: string;
  companyName?: string;
  position?: string;
  companyCnpj?: string;
  companyAddress?: string;
  companyLogoBase64?: string;  // data URL da logo da empresa (JPEG comprimido)
  companyPhone?: string;        // telefone institucional (com ou sem WhatsApp, texto livre)
  companyEmail?: string;        // e-mail institucional
  companySite?: string;         // site (aceitar com ou sem https:// — normalizar no uso, não aqui)
  socialNetworkLabel?: string;  // rótulo da rede social, ex.: "Instagram" ou "@amorimtech"
  socialNetworkUrl?: string;    // URL completa da rede social
  categoriaProfissional?: CategoriaProfissional;  // define a base legal usada na Seção 2.0 do laudo
  dadosDocumentaisConfirmados?: boolean; // NOVO — espelha profissionais.dados_documentais_confirmados
}
