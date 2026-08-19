import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.16.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // TODO: restringir ao domínio do Netlify em produção (https://predial40-app.netlify.app)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validar o JWT do usuário autenticado via Supabase Auth.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Ler o corpo da requisição: { operation, contents, responseSchema? }
    const body = await req.json();
    const { operation, contents, responseSchema } = body;

    if (!operation || !contents) {
      return new Response(JSON.stringify({ error: 'Requisição incompleta.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Chamar o Gemini com a chave secreta do servidor.
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY não configurada no servidor.');
    }
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    if (operation === 'texto') {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
      });
      return new Response(JSON.stringify({ text: response.text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (operation === 'estruturado') {
      if (!responseSchema) {
        return new Response(JSON.stringify({ error: 'responseSchema é obrigatório para operação estruturada.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: { responseMimeType: 'application/json', responseSchema },
      });
      const txt = (response.text ?? '').trim();
      const parsed = JSON.parse(txt);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Operação desconhecida: ${operation}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na Edge Function diagnostico-ia:', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao processar diagnóstico de IA.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
