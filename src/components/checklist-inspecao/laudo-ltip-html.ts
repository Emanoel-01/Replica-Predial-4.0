// Funções de geração de HTML do Laudo Técnico de Inspeção Predial (LTIP).
// Extraídas de checklist-inspecao.component.ts sem alteração de conteúdo.

import type { Vistoria, ChecklistItem, FichaDano } from './checklist-inspecao.component';
import { UserProfile } from '../../models/user-profile.model';

export function gerarQualificacaoHtml(profile: UserProfile): string {
    const catLower = (profile.categoriaProfissional || 'arquiteto').toLowerCase();
    const nome = profile.fullName;
    const registro = profile.professionalId || '';
    const empresa = profile.companyName || '';
    const cnpj = profile.companyCnpj || '';

    let baseLegal = '';
    if (catLower.includes('arquiteto') || catLower.includes('cau')) {
      baseLegal = `no gozo das atribuições que lhe são conferidas pela Lei Federal nº 12.378, de 31 de dezembro de 2010, e pela Resolução CAU/BR nº 21, de 25 de abril de 2012, que tipifica os serviços de vistoria, perícia, avaliação, monitoramento e laudo técnico para efeito de registro de responsabilidade técnica`;
    } else if (catLower.includes('engenheiro') || catLower.includes('crea')) {
      baseLegal = `no gozo das atribuições que lhe são conferidas pela Lei Federal nº 5.194, de 24 de dezembro de 1966, que regula o exercício da profissão de Engenheiro, e pela Resolução CONFEA nº 218, de 29 de junho de 1973, que discrimina as atividades das diferentes modalidades profissionais, including vistoria, perícia, avaliação, laudo e parecer técnico`;
    } else {
      baseLegal = `no gozo das atribuições que lhe são conferidas pelas Resoluções CFT nº 058, de 2019, e nº 108, de 2020, do Conselho Federal dos Técnicos Industriais, observados os limites de área construída e tipologia construtiva estabelecidos nos normativos de habilitação da categoria`;
    }

    return `
      <h2 class="sec-h" id="sec-2"><span class="sn">2.0</span>Qualificação do Responsável Técnico</h2>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">O presente Laudo Técnico de Inspeção Predial foi elaborado por <b>${nome}</b>, inscrito(a) sob o registro <b>${registro}</b>, atuando pela empresa <b>${empresa}</b>${cnpj ? ` (CNPJ ${cnpj})` : ''}, ${baseLegal}.</p>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">Este documento observa ainda a habilitação técnica na área de conhecimento específica do objeto da perícia, nos termos do art. 156 do Código de Processo Civil (Lei nº 13.105, de 16 de março de 2015), que reconhece as atividades de vistoria, perícia e emissão de laudos técnicos como privativas de profissionais de nível superior ou técnico legalmente habilitados.</p>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">O profissional assume integral responsabilidade técnica pelas análises, diagnósticos e recomendações constantes deste documento, mediante emissão do respectivo Registro/Anotação de Responsabilidade Técnica (RRT/ART/TRT), constante no Anexo IV.</p>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">A responsabilidade técnica aqui assumida está circunscrita ao escopo, à metodologia e ao nível de inspeção declarados nas Seções 6.0 e 7.0 deste laudo, não se estendendo a sistemas, elementos ou condições não abrangidos pela inspeção visual realizada na data informada.</p>
    `;
  }

export function gerarGlossarioHtml(exibir: boolean): string {
    if (exibir === false) return '';

    const termos: { termo: string; def: string }[] = [
      { termo: '3.1 Agentes de Degradação', def: 'Tudo aquilo que, ao agir sobre um sistema, contribui para reduzir seu desempenho.' },
      { termo: '3.2 Anamnese', def: 'Etapa da inspeção predial que consiste em uma ou mais entrevistas para coleta de dados e obtenção de informações sobre o histórico da edificação, realizada com representante qualificado para tanto.' },
      { termo: '3.3 Anomalia', def: 'Irregularidade, anormalidade e exceção à regra que ocasionam a perda de desempenho da edificação ou suas partes, oriundas da fase de projeto, execução ou final de vida útil, além de fatores externos, podendo ser classificada como anomalia endógena, funcional ou exógena.' },
      { termo: '3.4 Avaliação do Comportamento em Uso na Inspeção Predial', def: 'Constatação e avaliação sensorial do comportamento em uso dos sistemas construtivos na fase de uso, operação e manutenção, considerando os requisitos dos usuários e o desempenho esperado.' },
      { termo: '3.5 Avaliação Sensorial', def: 'Avaliação dos atributos de um produto pelos órgãos dos sentidos para evocar, medir, analisar e interpretar reações às características dos materiais, percebidos pelos cinco sentidos.' },
      { termo: '3.6 Condições de Exposição', def: 'Conjunto de ações atuantes sobre a edificação, incluindo cargas gravitacionais, ações externas e ações resultantes da ocupação.' },
      { termo: '3.7 Conformidade', def: 'Atendimento a um ou mais requisitos estabelecidos em normas técnicas ou na legislação aplicável.' },
      { termo: '3.8 Conservação', def: 'Conjunto de operações que visa reparar, preservar ou manter em bom estado a edificação existente, conforme ABNT NBR 16280.' },
      { termo: '3.9 Desempenho', def: 'Comportamento em uso de uma edificação e de seus sistemas, quando submetidos às condições de exposição e de uso a que estão sujeitos ao longo de sua vida útil e mediante as operações de manutenção previstas.' },
      { termo: '3.10 Deterioração', def: 'Degradação antes do final da vida útil dos materiais e/ou componentes das edificações, em decorrência de anomalias e/ou falhas de uso, operação e manutenção.' },
      { termo: '3.11 Durabilidade', def: 'Capacidade da edificação ou de seus sistemas de desempenhar suas funções ao longo do tempo e sob condições de exposição, uso e manutenção previstas em projeto e construção.' },
      { termo: '3.12 Falha (de uso, operação ou manutenção)', def: 'Irregularidade ou anormalidade que implica no término da capacidade da edificação de cumprir suas funções como requerido, decorrente de uso e/ou operação inadequados, e/ou de inadequação do plano de manutenção.' },
      { termo: '3.13 Inspeção Predial', def: 'Processo de avaliação das condições técnicas, de uso, operação, manutenção e funcionalidade da edificação e de seus sistemas, de forma sistêmica e predominantemente sensorial, considerando os requisitos dos usuários.' },
      { termo: '3.14 Inspeção Predial Especializada', def: 'Processo que visa avaliar as condições técnicas de um sistema ou subsistema específico, normalmente desencadeado pela inspeção predial, complementando ou aprofundando o diagnóstico.' },
      { termo: '3.15 Inspetor Predial', def: 'Profissional habilitado responsável pela inspeção predial.' },
      { termo: '3.16 Laudo Técnico de Inspeção Predial', def: 'Documento escrito, emitido pelo inspetor predial, que registra os resultados da inspeção predial.' },
      { termo: '3.17 Manifestação Patológica', def: 'Ocorrência resultante de um mecanismo de degradação; sinais ou sintomas decorrentes de mecanismos de degradação de materiais, componentes ou sistemas, que reduzem seu desempenho.' },
      { termo: '3.18 Manutenibilidade', def: 'Grau de facilidade de um sistema, elemento ou componente de ser mantido ou recolocado no estado em que possa executar suas funções requeridas sob condições de uso especificadas.' },
      { termo: '3.19 Patamares de Prioridades', def: 'Organização das prioridades, em patamares de urgência, necessárias para restaurar ou preservar o desempenho dos sistemas afetados por falhas, anomalias ou manifestações patológicas.' },
      { termo: '3.20 Profissional Habilitado', def: 'Profissional com formação nas áreas de engenharia ou arquitetura e urbanismo, com registro no respectivo conselho de classe (CREA ou CAU) e consideradas suas atribuições profissionais.' },
      { termo: '3.21 Plano de Manutenção', def: 'Programa para determinação das atividades essenciais de manutenção, sua periodicidade, responsáveis, documentos de referência e recursos necessários, conforme ABNT NBR 5674.' },
      { termo: '3.22 Requisitos de Desempenho', def: 'Condições que expressam qualitativamente os atributos que a edificação e seus sistemas necessitam possuir para atender aos requisitos do usuário.' },
      { termo: '3.23 Sistema', def: 'Conjunto de elementos e componentes destinados a atender a uma macrofunção que o define, sendo a maior parte funcional do edifício.' },
      { termo: '3.24 Vida Útil (VU)', def: 'Período em que um edifício ou seus sistemas se prestam às atividades para as quais foram projetados e construídos, com atendimento dos níveis de desempenho esperados, considerando a correta execução dos processos de manutenção.' },
      { termo: '3.25 Vistoria', def: 'Processo de constatação, no local, predominantemente sensorial, do comportamento em uso da edificação, por ocasião da data da vistoria (diligência).' },
    ];

    const linhas = termos.map((t, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#F7F5F0';
      return `<tr style="background:${bg};"><td style="padding:2mm 3mm;font-weight:600;color:#132A41;vertical-align:top;width:30%;border:1px solid #D8D0C6;">${t.termo}</td><td style="padding:2mm 3mm;vertical-align:top;border:1px solid #D8D0C6;">${t.def}</td></tr>`;
    }).join('');

    return `
      <h2 class="sec-h" id="sec-3"><span class="sn">3.0</span>Glossário</h2>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">Para os efeitos deste Laudo Técnico de Inspeção Predial, aplicam-se os termos e definições abaixo
      denominados, configurando e facilitando a leitura por leigos:</p>
      <table class="t-std">
        <thead><tr><th style="width:30%">Termo</th><th>Definição</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>`;
  }

export function gerarRessalvasHtml(): string {
    return `
      <h2 class="sec-h" id="sec-5"><span class="sn">5.0</span>Ressalvas e Princípios</h2>
      <div class="callout legal">
        <p style="margin-bottom:2.5mm"><b>5.1.</b> A presente inspeção fundamenta-se em vistoria técnica visual, não destrutiva, não sendo empregados ensaios laboratoriais ou procedures destrutivos, salvo indicação expressa em contrário nas seções específicas deste laudo.</p>
        <p style="margin-bottom:2.5mm"><b>5.2.</b> As conclusões e recomendações refletem exclusivamente as condições observadas na data da vistoria, não sendo possível ao Responsável Técnico garantir a inexistência de anomalias ocultas, não detectáveis por inspeção visual, ou supervenientes à data de emissão deste documento.</p>
        <p style="margin-bottom:2.5mm"><b>5.3.</b> A guarda, atualização e disponibilização dos documentos norteadores relacionados no Anexo I são de responsabilidade do contratante/responsável legal pela edificação, nos termos das ABNT NBR 5674 e NBR 14037. A ausência de documentação não impede a emissão do laudo, mas limita o alcance das conclusões às evidências sensoriais e documentais efetivamente disponibilizadas.</p>
        <p style="margin-bottom:2.5mm"><b>5.4.</b> Este documento não substitui, e tampouco dispensa, laudos, vistorias ou pareceres técnicos específicos exigidos por legislação municipal, estadual ou federal aplicável (Corpo de Bombeiros, vigilância sanitária, órgãos ambientais, entre outros).</p>
        <p style="margin-bottom:0"><b>5.5.</b> O presente laudo é considerado <b>documento provisório</b> até a efetiva assinatura, física ou digital, do Responsável Técnico e a correspondente emissão do RRT/ART/TRT, momento em que passa a produzir plenos efeitos técnicos e legais.</p>
      </div>
    `;
  }

export function gerarMetodologiaHtml(): string {
    return `
      <h2 class="sec-h" id="sec-6"><span class="sn">6.0</span>Metodologia Aplicada</h2>
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">A inspeção segue as sete etapas metodológicas estabelecidas pela ABNT NBR 16747:2020, descritas a
      seguir e correlacionadas com as seções deste laudo:</p>
      <table class="t-std">
        <thead><tr><th style="width:10%">Etapa</th><th style="width:48%">Descrição</th><th>Seção correspondente</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Caracterização do objeto da inspeção</td><td>7.0</td></tr>
          <tr style="background:#F7F5F0;"><td>2</td><td>Levantamento e análise dos documentos norteadores</td><td>Anexo I</td></tr>
          <tr><td>3</td><td>Vistoria no objeto da inspeção, incluindo anamnese</td><td>Síntese / Sistemas Inspecionados / Anamnese</td></tr>
          <tr style="background:#F7F5F0;"><td>4</td><td>Diagnóstico do objeto da inspeção</td><td>Anexo III</td></tr>
          <tr><td>5</td><td>Avaliação da manutenção e uso</td><td>11.0</td></tr>
          <tr style="background:#F7F5F0;"><td>6</td><td>Avaliação do grau de criticidade</td><td>12.0</td></tr>
          <tr><td>7</td><td>Conclusões e considerações finais</td><td>13.0</td></tr>
        </tbody>
      </table>

      <p style="margin-top:5mm;font-size:9.5pt;font-weight:bold;color:#132A41;margin-bottom:2mm;">Classificação das irregularidades identificadas:</p>
      <table class="t-std">
        <thead><tr><th style="width:16%">Categoria</th><th style="width:20%">Subtipo</th><th>Descrição</th></tr></thead>
        <tbody>
          <tr><td rowspan="4"><b>Anomalia</b><br><span style="font-size:7.5pt;color:#8A949C">origem em projeto, execução, materiais ou fatores externos</span></td><td>Endógena</td><td>Origem na própria edificação (projeto, materiais, execução).</td></tr>
          <tr style="background:#F7F5F0;"><td>Exógena</td><td>Fatores externos, provocados por terceiros.</td></tr>
          <tr><td>Natural</td><td>Fenômenos naturais e desgaste esperado dos materiais.</td></tr>
          <tr style="background:#F7F5F0;"><td>Funcional</td><td>Envelhecimento natural / término da vida útil do componente.</td></tr>
          <tr><td rowspan="4"><b>Falha</b><br><span style="font-size:7.5pt;color:#8A949C">origem no uso, operação ou manutenção</span></td><td>Planejamento</td><td>Procedimentos e especificações de manutenção inadequados.</td></tr>
          <tr style="background:#F7F5F0;"><td>Execução</td><td>Manutenção executada de forma inadequada.</td></tr>
          <tr><td>Operacional</td><td>Registros, controles e rondas de manutenção inadequados.</td></tr>
          <tr style="background:#F7F5F0;"><td>Gerencial</td><td>Falta de controle de qualidade e acompanhamento de custos da manutenção.</td></tr>
        </tbody>
      </table>

      <p style="margin-top:5mm;font-size:9.5pt;font-weight:bold;color:#132A41;margin-bottom:2mm;">Grau de risco — ABNT NBR 16747</p>
      <table class="t-std">
        <thead><tr><th style="width:16%">Nível</th><th>Definição</th></tr></thead>
        <tbody>
          <tr><td><span class="badge p1">CRÍTICO</span></td><td>Ações necessárias quando a perda de desempenho compromete a saúde e/ou a segurança dos usuários, e/ou a funcionalidade dos sistemas construtivos, com possíveis paralisações; comprometimento de durabilidade (vida útil) e/ou aumento expressivo de custo de manutenção e de recuperação. Também devem ser classificadas no patamar "Prioridade 1" as ações necessárias quando a perda de desempenho, real ou potencial, pode gerar riscos ao meio ambiente.</td></tr>
          <tr style="background:#F7F5F0;"><td><span class="badge p2">REGULAR</span></td><td>Ações necessárias quando a perda parcial de desempenho (real ou potencial) tem impacto sobre a funcionalidade da edificação, sem prejuízo à operação direta de sistemas e sem comprometer a saúde e segurança dos usuários.</td></tr>
          <tr><td><span class="badge p3">MÍNIMO</span></td><td>Ações necessárias quando a perda de desempenho (real ou potencial) pode ocasionar pequenos prejuízos à estética ou quando as ações necessárias são atividades programáveis e passíveis de planejamento, além de baixo ou nenhum comprometimento do valor da edificação. Neste caso, as ações podem ser feitas sem urgência porque a perda parcial de desempenho não tem impacto sobre a funcionalidade da edificação, não causa prejuízo à operação direta de sistemas e não compromete a saúde e segurança do usuário.</td></tr>
        </tbody>
      </table>
      <p style="font-size:8pt;color:#8A949C;margin-top:2mm;line-height:1.5;">A priorização operacional das ações corretivas é apresentada na Seção 13.3 em patamares P1, P2 e P3, organizados a partir do grau de risco acima e das diretrizes de gestão de manutenção da ABNT NBR 5674. Os patamares são instrumento de planejamento e não constam da ABNT NBR 16747.</p>
      <p style="font-size:8pt;color:#8A949C;margin-top:2mm;line-height:1.5;">Matriz GUT (Gravidade × Urgência × Tendência): disponível como camada complementar de priorização, aplicada
      de forma opcional a fichas específicas quando indicado pelo Responsável Técnico (ver Anexo III).</p>`;
  }

export function gerarDiagnosticoHtml(itens: ChecklistItem[]): string {
    const todasFichas: { item: ChecklistItem; ficha: FichaDano }[] = [];
    itens.forEach(item => {
      (item.ocorrencias ?? []).forEach(ficha => {
        todasFichas.push({ item, ficha });
      });
    });
    todasFichas.sort((a, b) => (a.ficha.numeroFicha ?? 0) - (b.ficha.numeroFicha ?? 0));

    const titulo = `<h2 class="sec-h" id="sec-10"><span class="sn">10.0</span>Diagnóstico do Objeto da Inspeção</h2>`;

    if (todasFichas.length === 0) {
      return `${titulo}
        <p style="font-size:9pt;color:#6B7280;font-style:italic;margin-bottom:6mm;">
          Não foram identificadas ocorrências, anomalias ou falhas nesta vistoria até o momento.
        </p>`;
    }

    const linhas = todasFichas.map(({ item, ficha }, idx) => {
      const seqStr = String(ficha.numeroFicha ?? 0).padStart(3, '0');
      const bg = idx % 2 === 0 ? '#fff' : '#F7F5F0';

      let badgeClass = 'na';
      let critLabel = 'Pendente';
      if (ficha.criticidade === 'P1') { badgeClass = 'p1'; critLabel = 'P1'; }
      else if (ficha.criticidade === 'P2') { badgeClass = 'p2'; critLabel = 'P2'; }
      else if (ficha.criticidade === 'P3') { badgeClass = 'p3'; critLabel = 'P3'; }

      const classificacaoTexto = ficha.classificacao?.tipo && ficha.classificacao.tipo !== 'INDETERMINADO'
        ? `${ficha.classificacao.tipo === 'ANOMALIA' ? 'Anomalia' : 'Falha'}${ficha.classificacao.subtipo ? ' — ' + ficha.classificacao.subtipo : ''}`
        : 'Não classificada';

      const manifestacaoResumo = ficha.manifestacao
        ? (ficha.manifestacao.length > 90 ? ficha.manifestacao.slice(0, 87) + '…' : ficha.manifestacao)
        : '<span style="color:#8A949C;font-style:italic;">Ficha sem diagnóstico preenchido.</span>';

      return `<tr style="background:${bg};">
        <td><a href="#ficha-${seqStr}" style="color:#185fa5;text-decoration:none;font-weight:600;">${seqStr}</a></td>
        <td>${item.systemTitle ?? ''}</td>
        <td>${classificacaoTexto}</td>
        <td>${manifestacaoResumo}</td>
        <td style="text-align:center;"><span class="badge ${badgeClass}">${critLabel}</span></td>
      </tr>`;
    }).join('');

    return `${titulo}
      <p style="font-size:9pt;line-height:1.7;text-align:justify;margin-bottom:4mm;">Das ${itens.length} tipologias inspecionadas, foram registradas ${todasFichas.length} ocorrência(s),
      detalhadas individualmente no Anexo III (Mapeamento de Danos). O quadro-síntese abaixo consolida as
      ocorrências para leitura executiva:</p>
      <table class="t-std">
        <thead>
          <tr>
            <th style="width:10%">Ficha</th>
            <th style="width:20%">Sistema</th>
            <th style="width:18%">Classificação</th>
            <th style="width:38%">Manifestação (síntese)</th>
            <th style="width:14%;text-align:center">Criticidade</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <p style="font-size:8pt;color:#8A949C;margin-top:2mm;line-height:1.5;">Detalhamento completo de cada ocorrência — localização, causa
      provável, recomendação técnica, normas aplicáveis e registro fotográfico — disponível na ficha individual
      correspondente, no Anexo III.</p>`;
  }

export function gerarAnexoIVHtml(ativa: Vistoria): string {
    const anexo = ativa.anexoArtRrt;
    return `
      <h2 class="anexo-h" id="anexo-4"><span class="an">Anexo IV</span>ART / RRT</h2>
      ${anexo
        ? `<div class="callout norm">📎 <b>${anexo.nome}</b> — Registro/Anotação de Responsabilidade Técnica anexado pelo Responsável Técnico. <span style="color:#8A949C">(visualização do arquivo não disponível no PDF; documento entregue em meio eletrônico junto ao laudo)</span></div>`
        : `<p style="font-size:9pt;color:#6B7280;font-style:italic;">Nenhum ART/RRT anexado até o momento da emissão deste laudo.</p>`
      }`;
  }

export function gerarEncerramentoHtml(ativa: Vistoria, profile: UserProfile): string {
    return `
      <h2 class="sec-h" id="sec-15"><span class="sn">15.0</span>Encerramento e Assinatura</h2>
      <p>Dá-se por encerrado o presente Laudo Técnico de Inspeção Predial, elaborado com base na vistoria técnica
      realizada em ${new Date(ativa.dateCreated).toLocaleDateString('pt-BR')} na edificação
      <b>${ativa.buildingName}</b>, situada em ${ativa.address}.</p>
      <p>Este documento é considerado provisório até a assinatura física ou digital do Responsável Técnico
      abaixo identificado, momento em que passa a produzir plenos efeitos técnicos, mediante a correspondente
      Anotação/Registro de Responsabilidade Técnica (RRT/ART/TRT), constante no Anexo IV.</p>

      <div style="margin-top:16mm; border-top:1px solid #D8D0C6; padding-top:6mm;">
        <p style="margin-bottom:1mm">${(profile.companyAddress || '').split(',').pop()?.trim() || 'Local não informado'}, ${new Date().toLocaleDateString('pt-BR')}.</p>
        <div style="margin-top:14mm; width:80mm; border-top:1px solid #2b2b2b; padding-top:2mm; font-size:9pt;">
          <b>${profile.fullName}</b><br>
          ${profile.professionalTitle || ''}${profile.professionalId ? ` — ${profile.professionalId}` : ''}<br>
          ${profile.companyName || ''}
        </div>
      </div>

      <div class="selo-amorimtech">
        <div class="badge-circ">A</div>
        <div class="txt"><b>Gerado pela plataforma Predial 4.0</b><br>AmorimTech Ecossistema 4.0 — tecnologia de inspeção predial</div>
      </div>`;
  }

export function gerarSecao4Html(ativa: Vistoria): string {
    const tdL = 'background:#F7F5F0;padding:1.5mm 3mm;font-size:8pt;font-weight:600;color:#4A5A66;border:1px solid #D8D0C6;width:40%;white-space:nowrap;';
    const tdV = 'padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;width:60%;';

    // 1) MEMORIAL DESCRITIVO — aparece por último na seção
    const memoriaHtml = (ativa.memoriaDescritivo || ativa.objetoNatureza) ? `
      <div style="margin:4mm 0;border-left:3px solid #B5642A;padding:3mm 4mm;background:#FAFAF8;border-radius:0 4px 4px 0;page-break-inside:avoid;">
        <div style="font-size:7.5pt;font-weight:700;color:#4A5A66;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2mm;">Memorial Descritivo da Edificação</div>
        <p style="font-size:8.5pt;line-height:1.65;text-align:justify;color:#2b2b2b;margin:0;">${ativa.memoriaDescritivo || ativa.objetoNatureza}</p>
      </div>
    ` : '';

    // 2) MAPA DE LOCALIZAÇÃO — aparece no meio
    const mapaHtml = ativa.mapaImagemBase64 ? `
      <div style="margin:3mm 0;border:1px solid #D8D0C6;border-radius:4px;overflow:hidden;page-break-inside:avoid;">
        <div style="background:#F7F5F0;padding:1.5mm 3mm;font-size:7.5pt;font-weight:600;color:#4A5A66;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #D8D0C6;">Mapa de Localização</div>
        <img src="${ativa.mapaImagemBase64}" alt="Mapa de localização" style="width:100%;aspect-ratio:16/9;max-height:85mm;object-fit:cover;display:block;">
      </div>
      <p style="font-size:7.5pt;color:#6B7280;font-style:italic;margin-bottom:3mm;">Imagem do mapa de localização gerada externamente e anexada pelo Responsável Técnico.</p>
    ` : (ativa.lat && ativa.lng) ? `
      <p style="font-size:8pt;color:#6B7280;margin-bottom:3mm;">
        Georreferenciamento capturado em campo: ${ativa.lat.toFixed(6)}, ${ativa.lng.toFixed(6)}${ativa.gpsAccuracy ? ` · ±${Math.round(ativa.gpsAccuracy)} m` : ''}.
        <a href="https://www.openstreetmap.org/?mlat=${ativa.lat}&mlon=${ativa.lng}&zoom=17" style="color:#185fa5;">Ver no OpenStreetMap</a>.
      </p>
    ` : '';

    // 3) TABELA DE DADOS — pares de 1 coluna para sidebar
    const campos: { l: string; v: string }[] = [];
    if (ativa.tipoUso) campos.push({ l: 'Tipo de Uso / Tipologia', v: ativa.tipoUso });
    if (ativa.areaConstruida) campos.push({ l: 'Área Construída', v: ativa.areaConstruida });
    if (ativa.idadeEdificacao) campos.push({ l: 'Idade da Edificação', v: ativa.idadeEdificacao });
    if (ativa.artRrtNumero) campos.push({ l: 'ART / RRT', v: ativa.artRrtNumero });
    
    // Novos campos do Bloco 2a
    if (ativa.solicitanteEndereco) campos.push({ l: 'Endereço Solicitante', v: ativa.solicitanteEndereco });
    if (ativa.responsavelLegalNome) campos.push({ l: 'Responsável Legal', v: ativa.responsavelLegalNome });
    if (ativa.responsavelLegalDocumento) campos.push({ l: 'Doc. Resp. Legal', v: ativa.responsavelLegalDocumento });
    if (ativa.padraoAcabamento) campos.push({ l: 'Padrão de Acabamento', v: ativa.padraoAcabamento });
    if (ativa.numeroPavimentos) campos.push({ l: 'N° de Pavimentos', v: ativa.numeroPavimentos });
    if (ativa.sistemaEstruturalPredominante) campos.push({ l: 'Sistema Estrutural', v: ativa.sistemaEstruturalPredominante });
    if (ativa.sistemaFundacao) campos.push({ l: 'Sistema de Fundação', v: ativa.sistemaFundacao });
    if (ativa.horarioFuncionamento) campos.push({ l: 'Horário de Func.', v: ativa.horarioFuncionamento });
    if (ativa.nivelInspecao) campos.push({ l: 'Nível de Inspeção', v: `Nível ${ativa.nivelInspecao}` });
    if (ativa.nivelInspecaoMetodologia) campos.push({ l: 'Metodologia Nível', v: ativa.nivelInspecaoMetodologia });
    if (ativa.nivelInspecaoJustificativa) campos.push({ l: 'Justificativa Nível', v: ativa.nivelInspecaoJustificativa });

    if (ativa.lat && ativa.lng) {
      campos.push({ l: 'Coordenadas GPS', v: `${ativa.lat.toFixed(5)}, ${ativa.lng.toFixed(5)}${ativa.gpsAccuracy ? ` · ±${Math.round(ativa.gpsAccuracy)}m` : ''}` });
    }

    let tabelaHtml = '';
    if (campos.length > 0) {
      tabelaHtml = `<table style="width:100%;border-collapse:collapse;font-size:8.5pt;">`;
      for (const c of campos) {
        tabelaHtml += `<tr>
          <td style="${tdL}">${c.l}</td><td style="${tdV}">${c.v}</td>
        </tr>`;
      }
      tabelaHtml += `</table>`;
    }

    let perfilHtml = '';
    if (ativa.fotosGerais && ativa.fotosGerais.length > 0) {
      perfilHtml = `
        <div style="display:flex; gap:5mm; align-items:flex-start; margin-bottom:4mm; page-break-inside:avoid;">
          <!-- Coluna da Esquerda: Fotos da Fachada -->
          <div style="flex:1.2; min-width:0;">
            <div style="font-size:7.5pt;font-weight:700;color:#4A5A66;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2mm;">
              Fotos da Fachada / Aspectos Gerais
              <span style="font-size:6.5pt;background:#F7F5F0;border:1px solid #D8D0C6;border-radius:3px;padding:1px 5px;font-weight:600;margin-left:2mm;">${ativa.fotosGerais.length} foto(s)</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;">
              ${ativa.fotosGerais.map((f: any, i: number) => `
                <div style="border:1px solid #D8D0C6;border-radius:4px;overflow:hidden;background:#F7F5F0;">
                  <img src="${f.dataUrl}" alt="Foto ${i+1}" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;">
                  <div style="padding:1mm 1.5mm;font-size:6.5pt;color:#4A5A66;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Foto ${String(i+1).padStart(2,'0')}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Coluna da Direita: Dados Técnicos -->
          <div style="flex:1; flex-shrink:0;">
            <div style="font-size:7.5pt;font-weight:700;color:#4A5A66;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2mm;">Dados Técnicos da Edificação</div>
            ${tabelaHtml}
          </div>
        </div>
      `;
    } else {
      perfilHtml = `
        <div style="margin-bottom:4mm; page-break-inside:avoid;">
          <div style="font-size:7.5pt;font-weight:700;color:#4A5A66;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2mm;">Dados Técnicos da Edificação</div>
          ${tabelaHtml}
        </div>
      `;
    }

    return `
      <h2 class="sec-h" id="sec-7"><span class="sn">7.0</span>Caracterização do Objeto da Inspeção</h2>
      ${perfilHtml}
      ${mapaHtml}
      ${memoriaHtml}
    `;
  }



export function gerarSecao9Html(itens: ChecklistItem[]): string {
    const todasFichas: { item: ChecklistItem; ficha: FichaDano }[] = [];
    itens.forEach(item => {
      (item.ocorrencias ?? []).forEach(ficha => {
        todasFichas.push({ item, ficha });
      });
    });
    todasFichas.sort((a, b) => (a.ficha.numeroFicha ?? 0) - (b.ficha.numeroFicha ?? 0));

    if (todasFichas.length === 0) {
      return `
        <h2 class="anexo-h" id="anexo-3"><span class="an">Anexo III</span>Mapeamento de Danos</h2>
        <p style="font-size:9pt;color:#6B7280;font-style:italic;margin-bottom:6mm;">
          Nenhuma ocorrência registrada nesta vistoria.
        </p>`;
    }

    let html = `<h2 class="anexo-h" id="anexo-3"><span class="an">Anexo III</span>Mapeamento de Danos</h2>`;

    for (const { item, ficha } of todasFichas) {
      const seqStr = String(ficha.numeroFicha ?? 0).padStart(3, '0');

      let sevClass = 's9-sev-pend';
      let sevLabel = 'Classificação Pendente';
      if (ficha.criticidade === 'P1') { sevClass = 's9-sev-cri'; sevLabel = 'Prioridade 1 — Crítico'; }
      else if (ficha.criticidade === 'P2') { sevClass = 's9-sev-reg'; sevLabel = 'Prioridade 2 — Médio'; }
      else if (ficha.criticidade === 'P3') { sevClass = 's9-sev-min'; sevLabel = 'Prioridade 3 — Mínimo'; }

      const localizacao = (ficha.pavimento || ficha.ambiente)
        ? `${ficha.pavimento ?? ''}${ficha.pavimento && ficha.ambiente ? ' · ' : ''}${ficha.ambiente ?? ''}`
        : 'Localização não informada';

      const classificacaoTexto = ficha.classificacao?.tipo && ficha.classificacao.tipo !== 'INDETERMINADO'
        ? `${ficha.classificacao.tipo === 'ANOMALIA' ? 'Anomalia' : 'Falha'}${ficha.classificacao.subtipo ? ' — ' + ficha.classificacao.subtipo : ''}`
        : 'Não classificada';

      const normasHtml = (ficha.normasAplicaveis ?? []).length
        ? `<div class="s9-normas">${ficha.normasAplicaveis.map(n => `<span class="s9-chip">${n.codigo}</span>`).join(' ')}</div>`
        : '';

      const temCamposEstruturados = ficha.manifestacao || ficha.causaProvavel || ficha.recomendacaoTecnica;
      let corpoHtml = '';
      if (temCamposEstruturados) {
        corpoHtml = `
          ${ficha.manifestacao ? `<p><strong>Manifestação:</strong> ${ficha.manifestacao}</p>` : ''}
          ${ficha.causaProvavel ? `<p><strong>Causa provável:</strong> ${ficha.causaProvavel}</p>` : ''}
          ${ficha.recomendacaoTecnica ? `<p><strong>Recomendação técnica:</strong> ${ficha.recomendacaoTecnica}</p>` : ''}
        `;
      } else if (ficha.memorialDescritivo?.trim()) {
        corpoHtml = markdownParaHtmlPdf(ficha.memorialDescritivo);
      } else {
        corpoHtml = `<p style="color:#6B7280;font-style:italic;">Ficha registrada sem diagnóstico preenchido.</p>`;
      }

      const quantDisplay = ficha.quantitativo?.trim()
        ? `<div class="s9-quant"><strong>Quantitativo de campo:</strong> ${ficha.quantitativo.trim()}</div>`
        : '';

      const corCriticidade = { P1: '#B23A48', P2: '#B77D1A', P3: '#6B7280' }[ficha.criticidade || ''] || '#D8D0C6';

      html += `
        <div class="s9-card no-break" id="ficha-${seqStr}" style="border-left: 8mm solid ${corCriticidade};">
          <div class="s9-header">
            <span class="s9-id">FICHA Nº ${seqStr}</span>
            <div class="s9-chips">
              <span class="s9-chip">${item.systemTitle ?? ''}</span>
              <span class="s9-chip">${item.typologyTitle ?? ''}</span>
              <span class="s9-chip">${localizacao}</span>
            </div>
            <span class="s9-severity ${sevClass}">${sevLabel}</span>
          </div>
          <div class="s9-title">${item.title ?? ''} <span style="font-weight:400;color:#6B7280;">— ${classificacaoTexto}</span></div>
          <div class="s9-body">${corpoHtml}</div>
          ${normasHtml}
          ${quantDisplay}
        </div>`;
    }

    return html;
  }

export function markdownParaHtmlPdf(text: string): string {
    if (!text) return '';

    const pStyle = 'margin:1.5mm 0 2mm;line-height:1.6;text-align:justify;font-size:8.5pt;color:#2b2b2b;';
    const h3Style = 'font-size:9pt;font-weight:800;color:#132A41;padding:1mm 0 1.5mm 3mm;margin:4mm 0 2mm;border-left:3px solid #B5642A;letter-spacing:.02em;border-bottom:1px solid #D8D0C6;';
    const liStyle = 'margin-bottom:1.5mm;color:#2b2b2b;line-height:1.55;';
    const ulStyle = 'margin:1.5mm 0 2.5mm 4mm;padding-left:4mm;list-style:disc;';

    // 0) Pré-processar tabelas Markdown (| col | col |) → <table> HTML
    const processarTabelasMd = (src: string): string => {
      const linhas = src.split('\n');
      const out: string[] = [];
      let bloco: string[] = [];

      const thS = 'background:#2C5AA0;color:#fff;padding:1.5mm 3mm;font-size:7.5pt;font-weight:700;text-align:left;border:1px solid #1a3f70;';
      const tdS = 'padding:1.5mm 3mm;font-size:8pt;border:1px solid #D8D0C6;vertical-align:top;';
      const td1S = 'padding:1.5mm 3mm;font-size:8pt;border:1px solid #D8D0C6;vertical-align:top;width:22%;font-weight:600;color:#B5642A;';

      const flush = () => {
        if (!bloco.length) return;
        // remove linha separadora (|---|---|)
        const rows = bloco.filter(l => !/^\|[\s\-:|]+\|/.test(l));
        let t = `<table style="width:100%;border-collapse:collapse;margin:3mm 0 4mm;font-size:8pt;page-break-inside:avoid;">`;
        rows.forEach((row, ri) => {
          const cells = row.split('|')
            .slice(1, -1)           // remove primeiro e último vazios
            .map(c => c.trim());
          if (ri === 0) {
            t += `<thead><tr>${cells.map(c => `<th style="${thS}">${c}</th>`).join('')}</tr></thead><tbody>`;
          } else {
            const bg = ri % 2 === 0 ? '' : 'background:#F7F5F0;';
            t += `<tr style="${bg}">${cells.map((c, ci) => `<td style="${ci === 0 ? td1S : tdS}">${c}</td>`).join('')}</tr>`;
          }
        });
        t += `</tbody></table>`;
        out.push(t);
        bloco = [];
      };

      for (const linha of linhas) {
        if (linha.trim().startsWith('|')) {
          bloco.push(linha);
        } else {
          flush();
          out.push(linha);
        }
      }
      flush();
      return out.join('\n');
    };

    text = processarTabelasMd(text);

    let html = text
      // 1) Títulos de bloco: linha inteira que é **N. TEXTO** → heading de seção
      .replace(/^\*\*(\d+[\.\s]+[^\*\n]+)\*\*\s*$/gim,
        `<h3 style="${h3Style}">$1</h3>`)
      // 2) Separador markdown --- → <hr>
      .replace(/^-{3,}\s*$/gm,
        '<hr style="border:none;border-top:1px solid #D8D0C6;margin:3mm 0;">')
      // 3) Bold inline (após headings já processados)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // 4) Code inline
      .replace(/`([^`]+)`/g,
        '<code style="background:#F0EDE7;padding:1px 4px;border-radius:3px;font-size:7.5pt;">$1</code>')
      // 5) Headings markdown #
      .replace(/^### (.*$)/gim,
        '<h4 style="font-size:9pt;font-weight:700;color:#132A41;margin:3mm 0 1mm;">$1</h4>')
      .replace(/^## (.*$)/gim,
        '<h3 style="font-size:10pt;font-weight:700;color:#132A41;margin:4mm 0 1.5mm;">$1</h3>')
      // 6) Itens de lista
      .replace(/^[\*\-] (.*$)/gim, `<li style="${liStyle}">$1</li>`);

    // 7) Agrupa <li> consecutivos em <ul>
    html = html.replace(/(<li[^>]*>[\s\S]*?<\/li>(\s*<li[^>]*>[\s\S]*?<\/li>)*)/g,
      `<ul style="${ulStyle}">$1</ul>`);
    html = html.replace(/<\/ul>\s*<ul[^>]*>/g, '');

    // 8) Parágrafos: quebras duplas de linha
    html = html.replace(/\n{2,}/g, `</p><p style="${pStyle}">`);

    return `<p style="${pStyle}">${html}</p>`;
  }

export function gerarSecao8DocumentosNorteadoresHtml(ativa: Vistoria): string {
    const docs = ativa.documentosNorteadores ?? [];

    if (docs.length === 0) {
      return `
        <h2 class="sec-h" id="sec-8"><span class="sn">8.0</span>Levantamento e Análise dos Documentos Norteadores</h2>
        <p style="font-size:9pt;color:#6B7280;font-style:italic;margin-bottom:6mm;">
          Nenhum documento norteador foi registrado para análise nesta vistoria. Ver detalhamento no Anexo I.
        </p>`;
    }

    const total = docs.length;
    const naoAplica        = docs.filter(d => d.disponibilidade === 'NA').length;
    const aAvaliar         = docs.filter(d => d.disponibilidade === 'A_AVALIAR').length;
    const disponibilizados = docs.filter(d => d.disponibilidade === 'DD').length;
    const naoDisponib      = docs.filter(d => d.disponibilidade === 'DND').length;
    const conformes        = docs.filter(d => d.disponibilidade === 'DD' && d.conformidade === 'EC').length;
    const naoConformes     = docs.filter(d => d.disponibilidade === 'DD' && d.conformidade === 'NC').length;
    const aplicaveis       = total - naoAplica;

    let veredito: string;
    let vereditoCor = '#6B7280';
    if (aplicaveis === 0) {
      veredito = 'não se aplica (nenhum documento norteador aplicável à edificação)';
    } else if (disponibilizados === aplicaveis && naoConformes === 0 && aAvaliar === 0) {
      veredito = 'CONFORMIDADE';
      vereditoCor = '#1E7A46';
    } else if (disponibilizados === 0) {
      veredito = 'NÃO CONFORMIDADE';
      vereditoCor = '#B23A48';
    } else {
      veredito = 'NÃO CONFORMIDADE PARCIAL';
      vereditoCor = '#B23A48';
    }

    const s = (n: number, sing: string, plur: string) => (n === 1 ? sing : plur);

    const naoAplicaClausula = naoAplica > 0
      ? `, ${s(naoAplica, 'do qual', 'dos quais')} ${naoAplica} não se ${s(naoAplica, 'aplica', 'aplicam')} à edificação` : '';
    const naoDisponibClausula = naoDisponib > 0
      ? ` e ${naoDisponib} não ${s(naoDisponib, 'disponibilizado', 'disponibilizados')}` : '';
    const aAvaliarClausula = aAvaliar > 0
      ? `, com ${aAvaliar} ainda ${s(aAvaliar, 'pendente', 'pendentes')} de avaliação` : '';
    const conformidadeClausula = disponibilizados > 0
      ? `Dentre os disponibilizados, ${conformes} ${s(conformes, 'encontra-se', 'encontram-se')} em conformidade e ${naoConformes} em não conformidade. ` : '';

    const analise = `${s(total, 'Foi inventariado', 'Foram inventariados')} ${total} ${s(total, 'documento norteador', 'documentos norteadores')}${naoAplicaClausula}. ` +
      `${s(aplicaveis, 'Do', 'Dos')} ${aplicaveis} ${s(aplicaveis, 'documento aplicável', 'documentos aplicáveis')}, ${disponibilizados} ${s(disponibilizados, 'foi disponibilizado', 'foram disponibilizados')} pelo responsável legal${naoDisponibClausula}${aAvaliarClausula}. ` +
      conformidadeClausula +
      `Diante do exposto, verifica-se que a edificação encontra-se em <strong style="color:${vereditoCor};">${veredito}</strong> ` +
      `com as boas práticas de gestão documental do uso, operação e manutenção, nos termos das ABNT NBR 5674 e NBR 14037.`;

    return `
      <h2 class="sec-h" id="sec-8"><span class="sn">8.0</span>Levantamento e Análise dos Documentos Norteadores</h2>
      <p style="font-size:9.5pt;line-height:1.6;color:#1A2A38;margin-bottom:4mm;">${analise}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6mm;">
        <thead>
          <tr>
            <th style="background:#132A41;color:#fff;padding:2mm 3mm;font-size:8pt;text-align:left;">Indicador</th>
            <th style="background:#132A41;color:#fff;padding:2mm 3mm;font-size:8pt;text-align:center;">Quantidade</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;">Total de documentos inventariados</td><td style="padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;text-align:center;">${total}</td></tr>
          <tr><td style="padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;background:#F7F5F0;">Aplicáveis à edificação</td><td style="padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;background:#F7F5F0;text-align:center;">${aplicaveis}</td></tr>
          <tr><td style="padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;">Disponibilizados pelo responsável legal</td><td style="padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;text-align:center;">${disponibilizados}</td></tr>
          <tr><td style="padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;background:#F7F5F0;">Não disponibilizados</td><td style="padding:1.5mm 3mm;font-size:8.5pt;border:1px solid #D8D0C6;background:#F7F5F0;text-align:center;">${naoDisponib}</td></tr>
        </tbody>
      </table>
      <p style="font-size:8pt;color:#6B7280;font-style:italic;">Ver relação completa, documento por documento, no Anexo I.</p>`;
  }

export function gerarAnexoINorteadoresHtml(ativa: Vistoria): string {
    const docs = ativa.documentosNorteadores ?? [];
    if (docs.length === 0) {
      return `
        <h2 class="anexo-h" id="anexo-1" style="margin-top:8mm;page-break-before:always;"><span class="an">Anexo I</span>Verificação de Documentos Norteadores</h2>
        <p style="font-size:9pt;color:#6B7280;font-style:italic;margin-bottom:6mm;">Nenhum documento norteador registrado nesta vistoria.</p>
      `;
    }

    const total = docs.length;
    const naoAplica       = docs.filter(d => d.disponibilidade === 'NA').length;
    const aAvaliar        = docs.filter(d => d.disponibilidade === 'A_AVALIAR').length;
    const disponibilizados= docs.filter(d => d.disponibilidade === 'DD').length;
    const naoDisponib     = docs.filter(d => d.disponibilidade === 'DND').length;
    const conformes       = docs.filter(d => d.disponibilidade === 'DD' && d.conformidade === 'EC').length;
    const naoConformes    = docs.filter(d => d.disponibilidade === 'DD' && d.conformidade === 'NC').length;
    const aplicaveis      = total - naoAplica;

    let veredito: string;
    let vereditoCor = '#6B7280';
    if (aplicaveis === 0) {
      veredito = 'não se aplica (nenhum documento norteador aplicável à edificação)';
    } else if (disponibilizados === aplicaveis && naoConformes === 0 && aAvaliar === 0) {
      veredito = 'CONFORMIDADE';
      vereditoCor = '#1E7A46';
    } else if (disponibilizados === 0) {
      veredito = 'NÃO CONFORMIDADE';
      vereditoCor = '#B23A48';
    } else {
      veredito = 'NÃO CONFORMIDADE PARCIAL';
      vereditoCor = '#B23A48';
    }

    const s = (n: number, sing: string, plur: string) => (n === 1 ? sing : plur);

    const naoAplicaClausula = naoAplica > 0
      ? `, ${s(naoAplica, 'do qual', 'dos quais')} ${naoAplica} não se ${s(naoAplica, 'aplica', 'aplicam')} à edificação` : '';
    const naoDisponibClausula = naoDisponib > 0
      ? ` e ${naoDisponib} não ${s(naoDisponib, 'disponibilizado', 'disponibilizados')}` : '';
    const aAvaliarClausula = aAvaliar > 0
      ? `, com ${aAvaliar} ainda ${s(aAvaliar, 'pendente', 'pendentes')} de avaliação` : '';
    const conformidadeClausula = disponibilizados > 0
      ? `Dentre os disponibilizados, ${conformes} ${s(conformes, 'encontra-se', 'encontram-se')} em conformidade e ${naoConformes} em não conformidade. ` : '';

    const sintetico = `${s(total, 'Foi inventariado', 'Foram inventariados')} ${total} ${s(total, 'documento norteador', 'documentos norteadores')}${naoAplicaClausula}. ` +
      `${s(aplicaveis, 'Do', 'Dos')} ${aplicaveis} ${s(aplicaveis, 'documento aplicável', 'documentos aplicáveis')}, ${disponibilizados} ${s(disponibilizados, 'foi disponibilizado', 'foram disponibilizados')} pelo responsável legal${naoDisponibClausula}${aAvaliarClausula}. ` +
      conformidadeClausula +
      `Diante do exposto, verifica-se que a edificação encontra-se em <strong style="color:${vereditoCor};">${veredito}</strong> ` +
      `com as boas práticas de gestão documental do uso, operação e manutenção, nos termos das ABNT NBR 5674 e NBR 14037.`;

    const thS = 'background:#2C5AA0;color:#fff;padding:1.5mm 3mm;font-size:7.5pt;font-weight:700;text-align:left;border:1px solid #1a3f70;';
    const tdS = 'padding:1.5mm 3mm;font-size:8pt;border:1px solid #D8D0C6;vertical-align:top;';

    const gruposUnicos: string[] = [];
    docs.forEach(d => {
      const g = d.grupo || 'Geral';
      if (!gruposUnicos.includes(g)) {
        gruposUnicos.push(g);
      }
    });

    const labelDisp: Record<string, string> = {
      'A_AVALIAR': 'A avaliar',
      'DD': 'Disponibilizado',
      'DND': 'Não disponibilizado',
      'NA': 'Não se aplica'
    };

    const labelConf: Record<string, string> = {
      'EC': 'Em conformidade',
      'NC': 'Não conformidade'
    };

    let tabelasHtml = '';
    for (const g of gruposUnicos) {
      const itensDoGrupo = docs.filter(d => (d.grupo || 'Geral') === g);
      let linhasHtml = '';
      let isEven = false;
      for (const item of itensDoGrupo) {
        const bg = isEven ? '#F7F5F0' : '#ffffff';
        isEven = !isEven;

        let cellDispBg = '#fff';
        let cellDispFg = '#333';
        if (item.disponibilidade === 'NA') { cellDispBg = '#f1f1f1'; cellDispFg = '#777'; }
        else if (item.disponibilidade === 'A_AVALIAR') { cellDispBg = '#fdf6e2'; cellDispFg = '#b58900'; }
        else if (item.disponibilidade === 'DND') { cellDispBg = '#fdf2f2'; cellDispFg = '#c81e1e'; }
        else if (item.disponibilidade === 'DD') { cellDispBg = '#f3faf7'; cellDispFg = '#0e6251'; }

        let cellConfBg = '#fff';
        let cellConfFg = '#333';
        let confText = '—';
        if (item.disponibilidade === 'DD') {
          if (item.conformidade === 'EC') { cellConfBg = '#eafaf1'; cellConfFg = '#1e7a46'; confText = labelConf['EC']; }
          else if (item.conformidade === 'NC') { cellConfBg = '#fdf2f2'; cellConfFg = '#b23a48'; confText = labelConf['NC']; }
          else { cellConfBg = '#fdfcf0'; cellConfFg = '#b58900'; confText = 'Pendente'; }
        }

        const anexosCount = item.anexos?.length ? `${item.anexos.length} anexo(s)` : '—';

        linhasHtml += `
          <tr style="background:${bg}">
            <td style="${tdS}">
              <div style="font-weight:600;color:#1A2A38;margin-bottom:0.5mm;">${item.descricao}</div>
              ${item.observacao ? `<div style="font-size:7.5pt;color:#6B7280;line-height:1.3">${item.observacao}</div>` : ''}
            </td>
            <td style="${tdS}background:${cellDispBg};color:${cellDispFg};font-weight:600;">${labelDisp[item.disponibilidade] || item.disponibilidade}</td>
            <td style="${tdS}background:${cellConfBg};color:${cellConfFg};font-weight:600;">${confText}</td>
            <td style="${tdS}">${anexosCount}</td>
          </tr>
        `;
      }

      tabelasHtml += `
        <div style="margin-bottom:6mm;page-break-inside:avoid;">
          <h3 style="font-size:9.5pt;font-weight:700;color:#132A41;margin:4mm 0 2mm;border-bottom:1.5px solid #132A41;padding-bottom:0.5mm;">${g}</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:2mm;page-break-inside:auto;">
            <thead style="display:table-header-group;">
              <tr>
                <th style="${thS}width:45%;">Documento</th>
                <th style="${thS}width:20%;">Disponibilidade</th>
                <th style="${thS}width:20%;">Conformidade</th>
                <th style="${thS}width:15%;">Anexos</th>
              </tr>
            </thead>
            <tbody>
              ${linhasHtml}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      <div style="page-break-before:always;margin-top:8mm;">
        <h2 class="anexo-h" id="anexo-1"><span class="an">Anexo I</span>Verificação de Documentos Norteadores</h2>
        <p style="font-size:9pt;line-height:1.6;text-align:justify;color:#2b2b2b;margin:2mm 0 5mm;">
          ${sintetico}
        </p>
        ${tabelasHtml}
      </div>
    `;
  }

export function gerarAnamneseHtml(ativa: Vistoria, anexoImagensMap: Map<string, string>): string {
    const constatacoes = Array.isArray(ativa.anamnese?.constatacoes) ? ativa.anamnese!.constatacoes : [];
    const anexos = Array.isArray(ativa.anamnese?.anexos) ? ativa.anamnese!.anexos : [];

    if (constatacoes.length === 0 && anexos.length === 0) {
      return `
        <div style="page-break-before:always;margin-top:8mm;" id="sec-9-1">
          <h3 style="font-size:10pt;font-weight:700;color:#132A41;margin:4mm 0 2mm;">9.1 Anamnese — Histórico e Constatações</h3>
          <p style="font-size:9pt;color:#6B7280;font-style:italic;margin-bottom:6mm;">
            Nenhuma constatação ou anexo foi registrado na Anamnese desta vistoria.
          </p>
        </div>`;
    }

    let html = `
      <div style="page-break-before:always;margin-top:8mm;" id="sec-9-1">
        <h3 style="font-size:10pt;font-weight:700;color:#132A41;margin:4mm 0 2mm;">9.1 Anamnese — Histórico e Constatações</h3>
    `;

    const labels: Record<string, string> = {
      RELATO_OCUPANTE: 'Relato de ocupante',
      HISTORICO: 'Histórico da edificação',
      INTERVENCAO: 'Intervenção / reforma anterior',
      PATOLOGIA_RECORRENTE: 'Patologia recorrente observada',
      OUTROS: 'Outros'
    };

    if (constatacoes.length > 0) {
      html += `<div style="margin-bottom:6mm;">`;
      for (const c of constatacoes) {
        const label = labels[c.tipo] || c.tipo;
        
        let condicionalHtml = '';
        if (c.tipo === 'RELATO_OCUPANTE') {
          const idStr = c.identificacao ? ` · Vínculo/ID: ${c.identificacao}` : '';
          condicionalHtml = `<div style="font-size:8pt;color:#4A5A66;margin-top:1.5mm;font-weight:600;">Ocupante: ${c.nomeOcupante}${idStr}</div>`;
        } else if (c.tipo === 'HISTORICO' || c.tipo === 'INTERVENCAO') {
          condicionalHtml = `<div style="font-size:8pt;color:#4A5A66;margin-top:1.5mm;font-weight:600;">Data/período: ${c.data}</div>`;
        } else if (c.tipo === 'PATOLOGIA_RECORRENTE') {
          condicionalHtml = `<div style="font-size:8pt;color:#4A5A66;margin-top:1.5mm;font-weight:600;">Verificação/relato: ${c.fonteRelato}</div>`;
        }

        // Figuras vinculadas
        let imagensHtml = '';
        const imagensVinculadas = anexos.filter(a => a.constatacaoId === c.id && a.tipo.startsWith('image/'));
        for (const img of imagensVinculadas) {
          const dataUrl = anexoImagensMap.get(img.id);
          if (dataUrl) {
            imagensHtml += `
              <figure style="margin:2.5mm 0;page-break-inside:avoid;">
                <img src="${dataUrl}" style="max-width:100%;max-height:70mm;object-fit:contain;border:1px solid #D8D0C6;border-radius:4px;display:block;">
                <figcaption style="font-size:7.5pt;color:#6B7280;margin-top:1mm;">${img.legenda || img.nome}</figcaption>
              </figure>
            `;
          }
        }

        html += `
          <div style="page-break-inside:avoid;border:1px solid #E2E8F0;background:#F8FAFC;border-radius:6px;padding:3.5mm;margin-bottom:4mm;">
            <div style="display:inline-block;background:#EEF3FA;color:#2C5AA0;font-size:7pt;font-weight:700;text-transform:uppercase;padding:1mm 2.5mm;border-radius:3px;margin-bottom:1.5mm;">
              ${label}
            </div>
            <p style="font-size:9pt;line-height:1.55;color:#2b2b2b;margin:1.5mm 0;white-space:pre-line;">${c.descricao}</p>
            ${condicionalHtml}
            ${imagensHtml}
          </div>
        `;
      }
      html += `</div>`;
    }

    // Registro fotográfico complementar (imagens sem vínculo)
    const idsValidos = new Set(constatacoes.map(c => c.id));
    const imagensSemVinculo = anexos.filter(a => a.tipo.startsWith('image/') && (!a.constatacaoId || !idsValidos.has(a.constatacaoId)));
    
    if (imagensSemVinculo.length > 0) {
      let galeriaHtml = '';
      for (const img of imagensSemVinculo) {
        const dataUrl = anexoImagensMap.get(img.id);
        if (dataUrl) {
          galeriaHtml += `
            <figure style="margin:4mm 0;page-break-inside:avoid;">
              <img src="${dataUrl}" style="max-width:100%;max-height:70mm;object-fit:contain;border:1px solid #D8D0C6;border-radius:4px;display:block;">
              <figcaption style="font-size:7.5pt;color:#6B7280;margin-top:1.5mm;font-weight:500;">${img.legenda || img.nome}</figcaption>
            </figure>
          `;
        }
      }

      if (galeriaHtml) {
        html += `
          <div style="page-break-inside:avoid;margin-top:6mm;">
            <h3 style="font-size:10pt;font-weight:700;color:#132A41;margin:4mm 0 3mm;border-bottom:1.5px solid #132A41;padding-bottom:1mm;">
              Registro fotográfico complementar
            </h3>
            ${galeriaHtml}
          </div>
        `;
      }
    }

    html += `</div>`;
    return html;
  }

export function gerarSumarioHtml(entries: { href: string; num?: string; label: string }[]): string {
    const rows = entries.map(e => `
      <div class="toc-row${e.num ? '' : ' anexo'}">
        <a href="#${e.href}"><span>${e.num ? `<b>${e.num}</b> ` : ''}${e.label}</span><span class="toc-arrow">→</span></a>
      </div>`).join('');
    return `
      <div class="sumario-page">
        <div class="sumario-titulo">Sumário</div>
        <p style="font-size:8.5pt;color:#8A949C;margin-top:-4mm;margin-bottom:5mm;">Clique em qualquer item para ir direto à seção no documento.</p>
        ${rows}
      </div>`;
  }

export function gerarSecao7Html(
    itens: ChecklistItem[],
    evidenciasMap: Map<string, { dataUrl: string; geo: any; timestamp: string; tipo: string }>
  ): string {

    let html = `
      <h2 class="anexo-h" id="anexo-2"><span class="an">Anexo II</span>Relatório Fotográfico</h2>
    `;

    for (const item of itens) {
      const idx = itens.findIndex(i => i.id === item.id);
      const seqStr = String(idx + 1).padStart(2, '0');
      const oc = item.ocorrencias?.[0];

      // Determinar badge e classe de status
      const isNC = item.status === 'NAO_CONFORME' || item.status === 'FAIL';
      const isOK = item.status === 'CONFORME' || item.status === 'PASS';
      const isNA = item.status === 'NAO_APLICAVEL' || item.status === 'NA';

      let statusBadge = '';
      if (isNC) statusBadge = `<span class="nc-status-badge nc">NÃO CONFORME · ${oc?.severity ? oc.severity.toUpperCase() : 'PENDENTE'}</span>`;
      else if (isOK) statusBadge = `<span class="nc-status-badge ok">CONFORME</span>`;
      else if (isNA) statusBadge = `<span class="nc-status-badge na">N/A</span>`;
      else statusBadge = `<span class="nc-status-badge na">PENDENTE</span>`;

      // Separar evidências por tipo (até 2: contexto + detalhe)
      const ids = oc?.id_evidencias ?? [];
      const evContexto = ids.map((id: string) => evidenciasMap.get(id)).find(e => e?.tipo === 'contexto');
      const evDetalhe  = ids.map((id: string) => evidenciasMap.get(id)).find(e => e?.tipo === 'detalhe');
      // fallback: se só há uma foto, coloca em contexto
      const primeiraEv = ids.length > 0 ? evidenciasMap.get(ids[0]) : null;
      const ev1 = evContexto ?? primeiraEv ?? null;
      const ev2 = evDetalhe ?? (ids.length > 1 ? evidenciasMap.get(ids[1]) : null);

      const temFoto = ev1 || ev2;

      // Helper: renderiza um slot de foto
      const fotoSlotHtml = (ev: any, label: string) => {
        if (!ev) {
          return `
            <div class="nc-foto-item" style="display:flex;align-items:center;justify-content:center;padding:5px;">
              <div style="font-size:7pt;color:#8A949C;text-align:center;">Foto não registrada</div>
            </div>`;
        }
        const geoHtml = ev.geo
          ? `<div class="nc-geo">${ev.geo.lat.toFixed(5)}, ${ev.geo.lng.toFixed(5)}${ev.geo.accuracy ? ` · ±${Math.round(ev.geo.accuracy)}m` : ''}<br>${ev.timestamp}</div>`
          : `<div class="nc-geo">${ev.timestamp}</div>`;
        return `
          <div class="nc-foto-item">
            <div class="sec-lbl">${label} <span class="badge badge-sensor">SENSOR</span></div>
            <div class="nc-foto-slot">
              <img src="${ev.dataUrl}" alt="Evidência ${seqStr}">
            </div>
            ${geoHtml}
          </div>`;
      };

      // Diagnóstico IA — só item NÃO CONFORME, teto 600 chars
      let diagHtml = '';
      if (isNC && oc?.diagnostico_ia) {
        const diag = oc.diagnostico_ia.length > 600
          ? oc.diagnostico_ia.slice(0, 597) + '…'
          : oc.diagnostico_ia;

        let correlTag = '';
        let diagClass = 'nc-diag-full';
        if (oc.correlacaoFotoPatologia === 'CONFIRMADA') {
          correlTag = `<span class="correl-tag ok">✓ Correlação confirmada</span>`;
        } else if (oc.correlacaoFotoPatologia === 'DIVERGENTE') {
          correlTag = `<span class="correl-tag div">⚠ Foto divergente da patologia</span>`;
          diagClass = 'nc-diag-full divergente';
        } else if (oc.correlacaoFotoPatologia === 'INCONCLUSIVA') {
          correlTag = `<span class="correl-tag inc">? Inconclusiva</span>`;
        }

        const obsHtml = (oc.correlacaoFotoPatologia === 'DIVERGENTE' && oc.observacaoDivergencia)
          ? `<p style="font-style:italic;margin-top:2mm;">${oc.observacaoDivergencia}</p>`
          : '';

        diagHtml = `
          <div class="${diagClass}">
            <div class="sec-lbl">Diagnóstico assistido por IA <span class="badge badge-maquina">MÁQUINA</span> ${correlTag}</div>
            ${diag}
            ${obsHtml}
          </div>`;
      }

      // Anotação do RT — teto 500 chars
      const notesTexto = oc?.notes?.trim();
      const notesDisplay = notesTexto
        ? (notesTexto.length > 500 ? notesTexto.slice(0, 497) + '…' : notesTexto)
        : '<em style="color:#8A949C">Nenhuma anotação registrada.</em>';

      // Quantitativo
      const quantDisplay = oc?.quantitativo?.trim()
        ? `<span class="qv">${oc.quantitativo.trim()}</span>`
        : `<span class="qv" style="color:#8A949C;font-style:italic">—</span>`;

      // Bloco de fotos (omitir grid se sem foto E item não NC)
      let fotosHtml = '';
      if (temFoto) {
        fotosHtml = `
          <div class="nc-fotos-grid">
            ${fotoSlotHtml(ev1, 'Foto 1 — Contexto')}
            ${fotoSlotHtml(ev2, 'Foto 2 — Detalhe')}
          </div>`;
      } else if (isNA) {
        fotosHtml = `<div class="na-aviso">Item não aplicável à tipologia desta edificação.</div>`;
      } else {
        fotosHtml = `<div class="sem-foto-note">Nenhuma evidência fotográfica registrada para este item.</div>`;
      }

      html += `
        <div class="nc-card no-break">
          <div class="nc-header">
            <span class="nc-id">${seqStr}</span>
            <div class="nc-chips">
              <span class="chip">${item.systemTitle ?? ''}</span>
              <span class="chip">${item.typologyTitle ?? ''}</span>
            </div>
            ${statusBadge}
          </div>
          <div class="nc-title-row">${item.title ?? ''}</div>
          ${fotosHtml}
          ${diagHtml}
          <div class="nc-notes">
            <div class="sec-lbl">Anotação técnica do responsável <span class="badge badge-humano">HUMANO</span></div>
            ${notesDisplay}
          </div>
          <div class="nc-quant">
            <span class="ql">Quantitativo (campo)</span>
            ${quantDisplay}
          </div>
        </div>`;
    }

    return html;
  }

