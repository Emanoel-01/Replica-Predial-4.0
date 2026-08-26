-- Migration: 20260825_alo_sindico.sql
-- Descrição: Estrutura de dados e políticas de segurança RLS para o canal "Alô Síndico"

-- 1. Tabela de Leads do Alô Síndico
CREATE TABLE IF NOT EXISTS public.alo_sindico_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL,
  email text NOT NULL,
  nome_condominio text,
  status text NOT NULL DEFAULT 'novo', -- 'novo' | 'em_atendimento' | 'concluido' | 'descartado'
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabela de Histórico de Mensagens do Chat Alô Síndico
CREATE TABLE IF NOT EXISTS public.alo_sindico_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.alo_sindico_leads(id) ON DELETE CASCADE,
  autor text NOT NULL, -- 'sindico' | 'ia'
  texto text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabela de Controle de Rate Limit (por hash de IP)
CREATE TABLE IF NOT EXISTS public.alo_sindico_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  contagem int NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alo_sindico_rate_limit_ip_janela 
  ON public.alo_sindico_rate_limit(ip_hash, janela_inicio);

-- 4. Função helper para verificação de permissão de admin da Comunidade
CREATE OR REPLACE FUNCTION public.eh_admin_comunidade()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.permissoes_acesso
    WHERE profissional_id = auth.uid()
      AND produto = 'comunidade'
      AND modulo = 'admin'
      AND liberado = true
      AND (validade IS NULL OR validade > now())
  );
END;
$$;

-- 5. Configuração de RLS (Row Level Security)

-- Tabela: alo_sindico_leads
ALTER TABLE public.alo_sindico_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção pública em alo_sindico_leads" ON public.alo_sindico_leads;
CREATE POLICY "Permitir inserção pública em alo_sindico_leads"
  ON public.alo_sindico_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin pode ler alo_sindico_leads" ON public.alo_sindico_leads;
CREATE POLICY "Admin pode ler alo_sindico_leads"
  ON public.alo_sindico_leads
  FOR SELECT
  TO authenticated
  USING (public.eh_admin_comunidade());

DROP POLICY IF EXISTS "Admin pode atualizar alo_sindico_leads" ON public.alo_sindico_leads;
CREATE POLICY "Admin pode atualizar alo_sindico_leads"
  ON public.alo_sindico_leads
  FOR UPDATE
  TO authenticated
  USING (public.eh_admin_comunidade())
  WITH CHECK (public.eh_admin_comunidade());

-- Tabela: alo_sindico_mensagens
ALTER TABLE public.alo_sindico_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir inserção pública em alo_sindico_mensagens" ON public.alo_sindico_mensagens;
CREATE POLICY "Permitir inserção pública em alo_sindico_mensagens"
  ON public.alo_sindico_mensagens
  FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin pode ler alo_sindico_mensagens" ON public.alo_sindico_mensagens;
CREATE POLICY "Admin pode ler alo_sindico_mensagens"
  ON public.alo_sindico_mensagens
  FOR SELECT
  TO authenticated
  USING (public.eh_admin_comunidade());

-- Tabela: alo_sindico_rate_limit
ALTER TABLE public.alo_sindico_rate_limit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir gerenciamento de rate limit" ON public.alo_sindico_rate_limit;
CREATE POLICY "Permitir gerenciamento de rate limit"
  ON public.alo_sindico_rate_limit
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);
