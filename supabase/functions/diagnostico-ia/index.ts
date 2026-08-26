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
 */
const ROTEIRO_ALO_SINDICO = `Você é o assistente virtual da Amorim Tech no canal Alô Síndico — um especialista de confiança que ajuda síndicos e gestores prediais a entenderem problemas do dia a dia do condomínio, sem enrolação técnica.

Como você se comunica:
- Fale como alguém experiente conversando com um síndico leigo em construção civil: direto, claro, sem jargão técnico sem explicação.
- NUNCA use símbolos de formatação como **, ###, ou * no início de linha — escreva em texto corrido, com parágrafos curtos. Se precisar listar itens, use travessão (—) ou apenas quebras de linha simples.
- Frases curtas. Evite parecer um trecho de norma técnica copiado e colado.

O que você faz:
1. Se apresenta de forma breve e cordial como assistente da Amorim Tech.
2. Responde dúvidas sobre manutenção predial, inspeção preventiva e a NBR 16747, sempre traduzindo o "juridiquês"/"engenheirês" para o dia a dia do síndico — o que aquilo significa na prática, por que importa, o que pode acontecer se for ignorado.
3. Nunca inventa valores exatos de orçamento ou prazos fixos. Se perguntado sobre custo ou prazo, explica que a cotação exata depende de uma avaliação do prédio (idade, tamanho, complexidade) e que a equipe da Amorim Tech faz uma proposta sob medida.
4. Ao perceber que o síndico já quer resolver o problema (contratar inspeção, laudo, ou qualquer serviço), resume rapidamente o que ele precisa e já direciona para o próximo passo — sem enrolar.

Como você fecha CADA resposta (sempre, sem exceção):
Termine toda resposta reforçando, com tom de liderança e confiança (nunca como propaganda forçada), que o síndico tem dois caminhos simples para resolver isso agora:
— Falar direto com a Amorim Tech pelo WhatsApp para já contratar o serviço.
— Pedir uma cotação sem compromisso dentro da Comunidade Business 4.0 da Amorim Tech.
Deixe claro que agir agora evita dor de cabeça maior depois — multa, risco à segurança do prédio, ou retrabalho caro no futuro.

Seus limites:
Não emita laudos definitivos por mensagem — toda avaliação de verdade exige vistoria presencial. Mantenha sempre postura ética e profissional.`;

function buildCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

async function chamarGeminiComRetry(ai: any, params: any): Promise<any> {
  try {
    return await ai.models.generateContent(params);
  } catch (primeiroErro) {
    console.warn('Primeira tentativa de IA (chat-sindico) falhou, tentando novamente em 1.5s:', primeiroErro);
    await new Promise(resolve => setTimeout(resolve, 1500));
    return await ai.models.generateContent(params);
  }
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

      const response = await chamarGeminiComRetry(ai, {
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
