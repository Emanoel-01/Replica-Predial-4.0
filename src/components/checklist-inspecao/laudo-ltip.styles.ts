// CSS do Laudo Técnico de Inspeção Predial (LTIP).
// Extraído de checklist-inspecao.component.ts sem qualquer alteração de conteúdo.
export const LAUDO_LTIP_CSS = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap');
            /* === TOKENS P4 === */
            :root {
              --p4-navy:    #132A41;
              --p4-copper:  #B5642A;
              --p4-copper-l:#E8B27E;
              --p4-bg:      #FFFFFF;
              --p4-ink:     #1A2A38;
              --p4-soft:    #4A5A66;
              --p4-faint:   #8A949C;
              --p4-rule:    #D8D0C6;
              --p4-green:   #2E7D5B;
              --p4-green-l: #E8F5EE;
              --p4-red:     #C75D45;
              --p4-red-l:   #FDECEA;
              --p4-blue:    #2C5AA0;
              --p4-blue-l:  #EBF0FA;
              --p4-amber:   #E07B39;
              --p4-amber-l: #FDF0E6;
              --p4-pend-l:  #F5F2EC;
            }

            /* === BASE === */
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
              font-size: 9.5pt;
              line-height: 1.5;
              color: #1A2A38;
              background: #fff;
              padding: 20mm;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page {
              size: A4 portrait;
              margin: 8mm 20mm 12mm 20mm;
              @bottom-right {
                content: "Pág. " counter(page) " / " counter(pages);
                font-family: 'Inter', 'Segoe UI', sans-serif;
                font-size: 7pt;
                color: #8A949C;
              }
            }
            @media print {
              body { padding: 14mm 0 8mm 0 !important; font-size: 9pt; }
              .no-break { break-inside: avoid; page-break-inside: avoid; }
              tr { page-break-inside: avoid; }
              .print-tbody-tr, .print-tbody-td { page-break-inside: auto !important; }
              thead { display: table-header-group; }
            }

            /* === CABEÇALHO/RODAPÉ via TABLE — repete em TODAS as páginas no Chrome === */
            .print-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .print-thead-td {
              height: 13mm;
              padding: 0;
              background: #fff;
            }
            .print-tfoot-td {
              height: 7mm;
              padding: 0;
              border-top: 1px solid #D8D0C6;
              background: #fff;
            }
            .print-tbody-td { padding: 0; }
            .rh-wrap {
              display: flex;
              justify-content: space-between;
              align-items: center;
              height: 13mm;
              padding: 0 1mm;
            }
            .rh-left { display: flex; align-items: center; gap: 3mm; min-width: 40mm; }
            .rh-brand {
              font-family: 'Poppins', 'Inter', sans-serif;
              font-size: 13pt; font-weight: 700;
              color: #132A41; letter-spacing: -.02em; white-space: nowrap;
            }
            .rh-brand span { color: #B5642A; }
            .rh-right { text-align: right; font-size: 7.5pt; color: #4A5A66; line-height: 1.45; }
            .rh-rt { font-weight: 700; color: #132A41; display: block; }
            .rh-company { color: #6B7280; display: block; }
            .rf-wrap {
              display: flex;
              justify-content: space-between;
              align-items: center;
              height: 7mm;
              padding: 0 1mm;
              font-size: 7.5pt;
            }
            .rf-doc { font-weight: 600; color: #132A41; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 50%; }
            .rf-prov { color: #B5642A; font-size: 7pt; font-weight: 600; }
            .rf-page { display: none; }

            /* === FONTES: carregadas no início do <style> === */

            /* === CAPA === */
            .capa {
              page-break-after: always;
              padding-bottom: 10mm;
              border-bottom: 3px solid #B5642A;
              margin-bottom: 8mm;
            }
            .capa-titulo {
              padding: 4mm 0 10mm 0;
            }
            .capa-titulo h1 {
              font-family: 'Poppins', 'Inter', sans-serif;
              font-size: 22pt;
              font-weight: 700;
              color: #132A41;
              line-height: 1.15;
              letter-spacing: -.02em;
              margin-bottom: 2mm;
            }
            .capa-titulo .sub {
              font-size: 11pt;
              color: #B5642A;
              font-weight: 500;
            }
            .capa-meta {
              border-top: 1px solid #D8D0C6;
              padding-top: 5mm;
              font-size: 9pt;
              line-height: 2;
            }
            .capa-meta b { font-weight: 600; color: #1A2A38; }
            .prov-banner {
              margin-top: 8mm;
              background: #FDECEA;
              border: 1px solid #C75D45;
              border-radius: 3px;
              padding: 4mm 6mm;
              font-size: 8pt;
              color: #C75D45;
              font-weight: 600;
            }

            /* === HEADING DE SEÇÃO === */
            .sec-h {
              display: flex;
              align-items: baseline;
              gap: 5px;
              font-family: 'Poppins', 'Inter', sans-serif;
              font-size: 13pt;
              font-weight: 700;
              color: #132A41;
              border-bottom: 3px solid #B5642A;
              padding-bottom: 2mm;
              margin: 8mm 0 4mm 0;
            }
             .sec-h .sn { color: #B5642A; }

            /* === ANEXO HEADING === */
            .anexo-h {
              display: flex;
              align-items: baseline;
              gap: 5px;
              font-family: 'Poppins', 'Inter', sans-serif;
              font-size: 13pt;
              font-weight: 700;
              color: #132A41;
              border-bottom: 3px solid #B5642A;
              padding-bottom: 2mm;
              margin: 8mm 0 4mm 0;
            }
            .anexo-h .an {
              color: #B5642A;
              margin-right: 2mm;
              font-weight: 700;
            }

            /* === SUMÁRIO === */
            .sumario-page {
              page-break-after: always;
              padding-bottom: 10mm;
              margin-bottom: 8mm;
            }
            .sumario-titulo {
              font-family: 'Poppins', 'Inter', sans-serif;
              font-size: 18pt;
              font-weight: 700;
              color: #132A41;
              margin-bottom: 6mm;
              border-bottom: 2px solid #B5642A;
              padding-bottom: 2mm;
            }
            .toc-row {
              border-bottom: 1px dotted #D8D0C6;
              padding: 3mm 0;
            }
            .toc-row.anexo {
              margin-top: 1.5mm;
            }
            .toc-row a {
              display: flex;
              justify-content: space-between;
              align-items: center;
              text-decoration: none;
              color: #1A2A38;
              font-size: 9pt;
            }
            .toc-row a span b {
              color: #B5642A;
              font-weight: 700;
              margin-right: 1.5mm;
            }
            .toc-row a:hover {
              color: #B5642A;
            }
            .toc-arrow {
              color: #B5642A;
              font-weight: bold;
            }

            /* === CAPA LOGO === */
            .capa-logo-wrap {
              display: flex;
              align-items: center;
              gap: 4mm;
              margin-bottom: 8mm;
            }
            .capa-logo-mark {
              width: 14mm;
              height: 14mm;
              background: #132A41;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'Poppins', 'Inter', sans-serif;
              font-size: 16pt;
              font-weight: 700;
              border-radius: 4px;
              border: 1px solid #B5642A;
            }
            .capa-logo {
              font-family: 'Poppins', 'Inter', sans-serif;
              font-size: 14pt;
              font-weight: 700;
              color: #132A41;
              line-height: 1.2;
            }
            .capa-logo-sub {
              font-size: 8pt;
              color: #8A949C;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: .05em;
            }

            /* === SEÇÃO 1 — Tabela de Identificação === */
            table.t-ident {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 4mm;
            }
            table.t-ident td {
              border: 1px solid #D8D0C6;
              padding: 2.5mm 4mm;
              font-size: 9pt;
              vertical-align: top;
            }
            table.t-ident td:first-child {
              width: 40mm;
              font-weight: 600;
              color: #4A5A66;
              background: #F7F5F0;
              white-space: nowrap;
            }

            /* === SEÇÃO 5 — Síntese (KPI cards) === */
            .sintese-grid {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 3mm;
              margin: 4mm 0;
            }
            .sintese-card {
              border: 1px solid #D8D0C6;
              border-radius: 2px;
              padding: 3mm;
              text-align: center;
            }
            .sintese-card .big {
              font-family: 'Poppins', 'Inter', sans-serif;
              font-size: 18pt;
              font-weight: 700;
              color: #132A41;
              line-height: 1.1;
              display: block;
            }
            .sintese-card .big.critico { color: #C75D45; }
            .sintese-card .big.ok      { color: #2E7D5B; }
            .sintese-card .lbl {
              font-size: 6.5pt;
              text-transform: uppercase;
              letter-spacing: .08em;
              color: #8A949C;
              display: block;
              margin-top: 1mm;
            }

            /* === SEÇÃO 6 — Tabela de sistemas (zebra striping) === */
            table.t-std {
              width: 100%;
              border-collapse: collapse;
              font-size: 8.5pt;
              margin: 3mm 0;
            }
            table.t-std thead tr { background: #132A41; color: #fff; }
            table.t-std thead th {
              padding: 2.5mm 3mm;
              text-align: left;
              font-size: 7.5pt;
              font-weight: 600;
              letter-spacing: .04em;
            }
            table.t-std tbody tr:nth-child(even) { background: #F7F5F0; }
            table.t-std tbody td {
              padding: 2mm 3mm;
              border-bottom: 1px solid #D8D0C6;
              vertical-align: top;
            }
            table.t-std .sistema-row th {
              background: #E8ECF2;
              font-weight: 700;
              color: #132A41;
              font-size: 9pt;
              padding: 3mm;
              text-align: left;
            }
            .badge-status-ok  { background: #E8F5EE; color: #2E7D5B; font-size: 7.5pt; font-weight: 700; padding: 1mm 2.5mm; border-radius: 2px; display: inline-block; white-space: nowrap; }
            .badge-status-nc  { background: #FDECEA; color: #C75D45; font-size: 7.5pt; font-weight: 700; padding: 1mm 2.5mm; border-radius: 2px; display: inline-block; white-space: nowrap; }
            .badge-status-na  { background: #F5F2EC; color: #4A5A66; font-size: 7.5pt; font-weight: 700; padding: 1mm 2.5mm; border-radius: 2px; display: inline-block; white-space: nowrap; }
            .badge-status-pend{ background: #FFF8EB; color: #B77D1A; font-size: 7.5pt; font-weight: 700; padding: 1mm 2.5mm; border-radius: 2px; display: inline-block; white-space: nowrap; }

            /* === RODAPÉ PROVISÓRIO === */
            .doc-footer {
              margin-top: 10mm;
              border-top: 1px solid #D8D0C6;
              padding-top: 4mm;
              font-size: 7pt;
              color: #8A949C;
              line-height: 1.6;
            }
            .doc-footer .prov-tag {
              display: inline-block;
              background: #FDECEA;
              color: #C75D45;
              font-weight: 700;
              padding: .5mm 2mm;
              border-radius: 2px;
              font-size: 6.5pt;
              margin-right: 2mm;
              text-transform: uppercase;
            }
            .chancela-at {
              margin-top: 8mm;
              padding-top: 5mm;
              border-top: 2px solid #132A41;
              font-size: 7.5pt;
            }
            .chancela-at .at-logo {
              font-family: 'Poppins', 'Inter', sans-serif;
              font-size: 14pt;
              font-weight: 700;
              color: #132A41;
              letter-spacing: -.02em;
            }
            .chancela-at .at-logo span { color: #B5642A; }
            .chancela-at .at-txt { font-size: 7.5pt; color: #4A5A66; line-height: 1.7; }

            /* === SEÇÃO 9 — Memorial Descritivo === */
            .s9-card { border:1px solid #D8D0C6; border-radius:6px; margin-bottom:6mm; page-break-inside:avoid; overflow:hidden; }
            .s9-header { background:#132A41; color:#fff; padding:3mm 4mm; display:flex; align-items:center; gap:3mm; }
            .s9-id { font-size:9pt; font-weight:700; background:rgba(255,255,255,.15); border-radius:3px; padding:1px 5px; }
            .s9-chips { display:flex; gap:2mm; flex-wrap:wrap; }
            .s9-chip { font-size:7.5pt; background:rgba(255,255,255,.12); border-radius:3px; padding:1px 5px; }
            .s9-severity { font-size:7.5pt; margin-left:auto; padding:1.5px 6px; border-radius:3px; font-weight:700; }
            .s9-sev-min { background:#FEF3C7; color:#92400E; }
            .s9-sev-reg { background:#FFEDD5; color:#9A3412; }
            .s9-sev-cri { background:#FEE2E2; color:#991B1B; }
            .s9-sev-pend { background:#FFF8EB; color:#B77D1A; }
            .s9-title { font-size:10pt; font-weight:700; color:#132A41; padding:3mm 4mm 1.5mm; }
            .s9-body { padding:2mm 4mm 4mm; font-size:8.5pt; color:#2b2b2b; text-align:justify; }
            .s9-quant { background:#F7F5F0; border-top:1px solid #D8D0C6; padding:2mm 4mm; font-size:8pt; color:#4A5A66; }
            .s9-quant strong { color:#B5642A; }

            /* === SEÇÃO 7 (mantida intacta — não alterar estas classes) === */
            .nc-card { break-inside: avoid; border: 1px solid #B0BEC5; border-radius: 3px; margin: 5mm 0; overflow: hidden; }
            .nc-header { background: #132A41; color: #fff; padding: 2.5mm 3.5mm; display: flex; align-items: center; gap: 3mm; flex-wrap: wrap; }
            .nc-id { font-size: 9.5pt; font-weight: 700; background: rgba(255,255,255,.15); border-radius: 2px; padding: .5mm 2mm; white-space: nowrap; flex-shrink: 0; }
            .nc-chips { flex: 1; display: flex; gap: 2mm; flex-wrap: wrap; }
            .nc-chips .chip { background: rgba(255,255,255,.12); color: rgba(255,255,255,.8); }
            .chip { display: inline-block; font-size: 6.5pt; font-family: monospace; font-weight: 600; padding: .5mm 2mm; border-radius: 2px; letter-spacing: .04em; }
            .nc-status-badge { flex-shrink: 0; }
            .nc-status-badge.nc { background: #FDECEA; color: #C75D45; font-size: 7.5pt; font-weight: 700; padding: 1mm 2.5mm; border-radius: 2px; }
            .nc-status-badge.ok { background: #E8F5EE; color: #2E7D5B; font-size: 7.5pt; font-weight: 700; padding: 1mm 2.5mm; border-radius: 2px; }
            .nc-status-badge.na { background: #F5F2EC; color: #4A5A66; font-size: 7.5pt; font-weight: 700; padding: 1mm 2.5mm; border-radius: 2px; }
            .nc-title-row { background: #F4F6F8; padding: 2.5mm 3.5mm; border-bottom: 1px solid #D8D0C6; font-size: 10pt; font-weight: 600; color: #132A41; }
            .nc-fotos-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #D8D0C6; }
            .nc-foto-item { padding: 3mm; border-right: 1px solid #D8D0C6; }
            .nc-foto-item:last-child { border-right: none; }
            .sec-lbl { font-size: 7pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #4A5A66; display: flex; align-items: center; gap: 2mm; margin-bottom: 2mm; }
            .nc-foto-slot { width: 100%; aspect-ratio: 4/3; background: #ECEFF1; border: 1px dashed #D8D0C6; border-radius: 2px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 2mm; }
            .nc-foto-slot img { width: 100%; height: 100%; object-fit: contain; background: #ECEFF1; }
            .nc-geo { font-family: monospace; font-size: 6.5pt; color: #4A5A66; line-height: 1.6; }
            .nc-diag-full { padding: 3mm; border-bottom: 1px solid #D8D0C6; font-size: 8.5pt; line-height: 1.55; text-align: justify; }
            .nc-diag-full.divergente { background: #FDF0E6; }
            .correl-tag { font-size: 6.5pt; font-weight: 700; padding: .5mm 1.5mm; border-radius: 2px; margin-left: 1mm; text-transform: uppercase; letter-spacing: .04em; }
            .correl-tag.ok { background: #E8F5EE; color: #2E7D5B; }
            .correl-tag.div { background: #FDF0E6; color: #9A4B14; }
            .correl-tag.inc { background: #F5F2EC; color: #4A5A66; }
            .nc-notes { padding: 3mm; border-bottom: 1px solid #D8D0C6; background: #FAFAFA; font-size: 8.5pt; text-align: justify; }
            .nc-quant { padding: 2.5mm 3mm; background: #F7F5F0; font-size: 8.5pt; display: flex; align-items: center; gap: 3mm; }
            .nc-quant .ql { font-size: 7pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #4A5A66; }
            .nc-quant .qv { font-weight: 700; color: #1A2A38; }
            .badge { display: inline-block; font-size: 6pt; font-weight: 700; padding: .5mm 1.5mm; border-radius: 2px; letter-spacing: .06em; text-transform: uppercase; vertical-align: middle; margin-left: 1mm; }
            .badge-humano  { background: #2C5AA0; color: #fff; }
            .badge-maquina { background: #2E7D5B; color: #fff; }
            .badge-sensor  { background: #E07B39; color: #fff; }
            .sem-foto-note { padding: 3mm; background: #E8F5EE; border-bottom: 1px solid #D8D0C6; font-size: 7.5pt; color: #2E7D5B; font-style: italic; }
            .na-aviso { padding: 3mm; background: #F5F2EC; border-bottom: 1px solid #D8D0C6; font-size: 7.5pt; color: #4A5A66; font-style: italic; }
            .no-break { break-inside: avoid; page-break-inside: avoid; }
            .callout.legal {
              border-left: 3.5px solid #132A41;
              background: #F8FAFC;
              padding: 4mm 5mm;
              border-radius: 0 4px 4px 0;
              margin: 4mm 0;
              font-size: 8.5pt;
              line-height: 1.65;
              color: #2b2b2b;
              text-align: justify;
            }
            .selo-amorimtech { display:inline-flex; align-items:center; gap:3mm; border:1px solid #D8D0C6; border-radius:30px; padding:2.5mm 6mm 2.5mm 3mm; margin-top:10mm; }
            .selo-amorimtech .badge-circ { width:9mm; height:9mm; border-radius:50%; background:#132A41; color:#E8B27E; display:flex; align-items:center; justify-content:center; font-family:'Poppins',sans-serif; font-weight:700; font-size:9pt; flex-shrink:0; }
            .selo-amorimtech .txt { font-size:7.5pt; color:#4A5A66; line-height:1.4; }
            .selo-amorimtech .txt b { color:#132A41; font-family:'Poppins',sans-serif; }
`;
