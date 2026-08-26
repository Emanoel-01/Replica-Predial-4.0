import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.16.0';

const ALLOWED_ORIGINS = [
  'https://app-predial.emanoelamorim.com',
  'https://emanoelamorim.com',
  'http://localhost:4200',
  'http://localhost:5173',
];

/**
 * Roteiro e instruções de sistema para o assistente Alô Síndico.
 * NOTA: Este texto é provisório e será substituído pelo roteiro definitivo que o Emanoel vai fornecer depois.
 */
const ROTEIRO_ALO_SINDICO = `Você é o assistente virtual da Amorim Tech no canal Alô Síndico.
Seu objetivo é orientar síndicos, gestores e moradores sobre manutenção predial, inspeção preventiva e a NBR 16747 de forma acolhedora, clara e tecnicamente embasada.

Diretrizes obrigatórias de atendimento:
1. Apresentação: Apresente-se cordialmente como assistente da Amorim Tech.
2. Esclarecimento técnico: Responda a dúvidas gerais e factuais sobre quando vale a pena solicitar uma inspeção predial e o que é a NBR 16747 (norma de inspeção predial, seus objetivos na identificação de anomalias, classificação de riscos e preservação da vida útil da edificação).
3. Preços e Prazos: NUNCA invente ou forneça valores exatos de orçamento, tabelas de preço fechadas ou prazos fixos de entrega. Se perguntado sobre custos ou prazos, explique com clareza que a cotação exata depende da idade do condomínio, número de pavimentos, complexidade das instalações e de uma vistoria/avaliação preliminar, informando que nossa equipe enviará uma proposta personalizada.
4. Intenção de Contratação: Ao identificar que o síndico deseja contratar uma inspeção predial, laudo técnico ou consultoria, elabore um breve resumo da necessidade e confirme que a equipe técnica entrará em contato através do telefone/WhatsApp informado no cadastro.
5. Tom e Limites: Mantenha postura ética, prestativa e profissional. Não emita laudos definitivos por mensagem de texto sem vistoria presencial.`;

function buildCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Corpo da requisição inválido (JSON esperado).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { operation } = body;
    if (!operation) {
      return new Response(JSON.stringify({ error: 'Operação não especificada.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==========================================
    // OPERAÇÃO PÚBLICA: CHAT ALÔ SÍNDICO
    // (Não exige autenticação prévia de usuário)
    // ==========================================
    if (operation === 'chat-sindico') {
      // 1. Rate Limiting por Hash de IP (Máximo 15 chamadas em janela de 10 min)
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                       req.headers.get('x-real-ip') ||
                       req.headers.get('cf-connecting-ip') ||
                       'anon-ip';

      const encoder = new TextEncoder();
      const data = encoder.encode(clientIp);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const ipHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

      const dezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      try {
        const { data: rateData, error: rateError } = await supabaseAdmin
          .from('alo_sindico_rate_limit')
          .select('id, contagem, janela_inicio')
          .eq('ip_hash', ipHash)
          .gte('janela_inicio', dezMinutosAtras)
          .order('janela_inicio', { ascending: false })
          .limit(1);

        if (!rateError && rateData && rateData.length > 0) {
          const registro = rateData[0];
          if (registro.contagem >= 15) {
            return new Response(JSON.stringify({
              error: 'Limite de mensagens atingido para este intervalo. Por favor, aguarde alguns minutos antes de continuar.',
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          await supabaseAdmin
            .from('alo_sindico_rate_limit')
            .update({ contagem: registro.contagem + 1 })
            .eq('id', registro.id);
        } else {
          await supabaseAdmin
            .from('alo_sindico_rate_limit')
            .insert({ ip_hash: ipHash, janela_inicio: new Date().toISOString(), contagem: 1 });
        }
      } catch (rateLimitErr) {
        console.warn('Aviso no controle de rate limit:', rateLimitErr);
      }

      // 2. Validação do leadId e histórico
      const { leadId, historico } = body;
      if (!leadId || typeof leadId !== 'string' || leadId.trim() === '') {
        return new Response(JSON.stringify({ error: 'leadId é obrigatório para a operação chat-sindico.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!historico || !Array.isArray(historico) || historico.length === 0) {
        return new Response(JSON.stringify({ error: 'Histórico de mensagens é obrigatório.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Execução da IA com Gemini
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY não configurada no servidor.');
      }
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: historico,
        config: {
          systemInstruction: ROTEIRO_ALO_SINDICO,
        },
      });

      const respostaTexto = (response.text ?? '').trim();

      // 4. Salvar histórico de conversa em alo_sindico_mensagens
      try {
        const ultimaMsgUser = [...historico].reverse().find((m: any) => m.role === 'user');
        const textoPergunta = ultimaMsgUser?.parts?.[0]?.text || '';

        const registros = [];
        if (textoPergunta) {
          registros.push({ lead_id: leadId, autor: 'sindico', texto: textoPergunta });
        }
        if (respostaTexto) {
          registros.push({ lead_id: leadId, autor: 'ia', texto: respostaTexto });
        }

        if (registros.length > 0) {
          await supabaseAdmin.from('alo_sindico_mensagens').insert(registros);
        }
      } catch (errGravacao) {
        console.warn('Alerta ao persistir mensagem em alo_sindico_mensagens:', errGravacao);
      }

      return new Response(JSON.stringify({ text: respostaTexto }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==========================================
    // OPERAÇÕES PRIVADAS DO PREDIAL 4.0
    // (Exigem usuário autenticado com JWT)
    // ==========================================
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

    const { contents, responseSchema } = body;
    if (!contents) {
      return new Response(JSON.stringify({ error: 'Requisição incompleta.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
