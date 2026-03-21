const METHOD_META = {
  foco: {
    title: 'Foco',
    short: 'Tese, objetivo e decisão esperada.',
    description: 'Mede o quanto a apresentação deixa claro o objetivo central, a prioridade da mensagem e a ação esperada do público.',
    average: 74
  },
  roteiro: {
    title: 'Roteiro',
    short: 'Fluxo narrativo e progressão lógica.',
    description: 'Avalia se a história avança com lógica, encadeamento e ritmo, conduzindo o público do contexto até a conclusão.',
    average: 71
  },
  arquitetura: {
    title: 'Arquitetura',
    short: 'Estrutura, hierarquia e escaneabilidade.',
    description: 'Analisa como o conteúdo foi organizado nos slides, a hierarquia visual e a facilidade de leitura e entendimento rápido.',
    average: 69
  },
  mensagem: {
    title: 'Mensagem',
    short: 'Força de argumento e persuasão.',
    description: 'Observa clareza, objetividade e impacto do discurso para sustentar valor, credibilidade e convencimento.',
    average: 73
  },
  estetica: {
    title: 'Estética',
    short: 'Acabamento visual e percepção de valor.',
    description: 'Mede consistência visual, profissionalismo, harmonia e se o design reforça a confiança na apresentação.',
    average: 76
  }
};

function clampScore(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getScoreLabel(score) {
  if (score <= 19) return 'Péssimo';
  if (score <= 39) return 'Ruim';
  if (score <= 59) return 'Razoável';
  if (score <= 74) return 'Bom';
  if (score <= 89) return 'Ótimo';
  return 'Super';
}

function getScoreDelta(score, average) {
  const diff = clampScore(score) - clampScore(average);
  if (Math.abs(diff) <= 2) return { label: 'Na média do método', className: 'equal' };
  if (diff > 0) return { label: `${diff} pts acima da média`, className: 'up' };
  return { label: `${Math.abs(diff)} pts abaixo da média`, className: 'down' };
}

function getMetricDescription(key, score) {
  const label = getScoreLabel(score);
  const base = METHOD_META[key]?.description || '';
  const variations = {
    'Péssimo': 'Hoje esta dimensão está criticamente comprometida e tende a prejudicar diretamente a compreensão e a decisão.',
    'Ruim': 'Há fragilidade evidente aqui, com sinais claros de ruído, perda de clareza ou baixa força na leitura.',
    'Razoável': 'Existe base mínima funcional, mas ainda falta consistência para transmitir segurança e alto impacto.',
    'Bom': 'O desempenho já sustenta a apresentação, embora ainda haja espaço para refinar clareza, síntese e acabamento.',
    'Ótimo': 'Esta dimensão está madura e bem resolvida, reforçando a percepção de qualidade e condução estratégica.',
    'Super': 'Este é um ponto de destaque da apresentação, acima da média e com forte potencial de gerar confiança e impacto.'
  };
  return `${base} ${variations[label]}`.trim();
}

const stepMount = document.getElementById('stepMount');
const progressBar = document.getElementById('progressBar');
const stepCounter = document.getElementById('stepCounter');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const form = document.getElementById('diagnosticForm');
const loadingState = document.getElementById('loadingState');
const resultState = document.getElementById('resultState');
const loadingPercentEl = document.getElementById('loadingPercent');
const loadingEtaEl = document.getElementById('loadingEta');
const loadingStatusTextEl = document.getElementById('loadingStatusText');
const loadingProgressBarEl = document.getElementById('loadingProgressBar');
const loadingChecklistEl = document.getElementById('loadingChecklist');

let loadingTimer = null;
let loadingStartAt = 0;

const state = {
  step: 0,
  answers: {
    currentSituation: '',
    objective: '',
    audience: '',
    presentationContext: '',
    presentationLocation: '',
    durationMinutes: '',
    successMetric: '',
    painLevel: '',
    urgency: '',
    currentMaterialStage: '',
    fullName: '',
    email: '',
    company: '',
    roleTitle: '',
    whatsapp: '',
    notes: '',
    consent: true,
    presentationFile: null,
  }
};

const steps = [
  {
    key: 'currentSituation',
    title: 'Você já sentiu que sua apresentação não conectou?',
    description: 'Comece pelo ponto de dor. Isso ajuda a IA a entender o cenário real antes de olhar a peça.',
    type: 'options',
    options: [
      ['Sim, senti que não conectou', 'Percepção de desalinhamento na reunião.'],
      ['Sim, perdi uma oportunidade', 'A apresentação pode ter enfraquecido a decisão.'],
      ['Ainda vou apresentar, quero prevenir', 'Ótimo. Melhor ajustar antes do momento crítico.'],
      ['Tenho dúvidas sobre a qualidade atual', 'Vamos mapear isso agora.']
    ]
  },
  {
    key: 'objective',
    title: 'Qual é o objetivo principal da apresentação?',
    description: 'A mesma apresentação muda completamente quando o objetivo é vender, aprovar, captar ou treinar.',
    type: 'options',
    options: [
      ['Vender / fechar negócio', 'Foco em conversão e persuasão.'],
      ['Aprovar projeto ou ideia', 'Foco em clareza e confiança.'],
      ['Captar investimento / parceria', 'Foco em tese, narrativa e percepção de valor.'],
      ['Treinar ou alinhar equipe', 'Foco em entendimento e retenção.']
    ]
  },
  {
    key: 'audience',
    title: 'Quem é o público decisor dessa apresentação?',
    description: 'Quanto mais claro o público, melhor o diagnóstico da linguagem, profundidade e tom.',
    type: 'options',
    options: [
      ['Clientes / prospects', 'Venda e percepção comercial.'],
      ['Diretoria / board', 'Síntese, lógica executiva e confiança.'],
      ['Investidores / parceiros', 'Tese, tração, clareza e ambição.'],
      ['Equipe interna / operação', 'Didática, fluxo e entendimento.']
    ]
  },
  {
    title: 'Agora vamos contextualizar a situação.',
    description: 'Essas respostas ajudam a IA a avaliar adequação ao cenário, ao tempo e à métrica de sucesso.',
    type: 'form',
    fields: [
      { name: 'presentationContext', label: 'Contexto da apresentação', placeholder: 'Ex.: proposta comercial, reunião de board, evento, pitch de startup…' },
      { name: 'presentationLocation', label: 'Formato / local', placeholder: 'Ex.: presencial, online, auditório, sala de reunião, videoconferência…' },
      { name: 'durationMinutes', label: 'Duração estimada (min)', type: 'number', placeholder: 'Ex.: 10' },
      { name: 'successMetric', label: 'Como você mede sucesso?', placeholder: 'Ex.: fechar reunião, aprovar investimento, gerar entendimento, vender…' }
    ]
  },
  {
    title: 'Qual é o nível de urgência e maturidade do material?',
    description: 'Aqui a experiência começa a qualificar o lead comercialmente sem parecer um formulário frio.',
    type: 'form',
    fields: [
      { name: 'painLevel', label: 'Nível de dor percebida', placeholder: 'Ex.: alto, médio, baixo / estou inseguro / sinto que está confuso…' },
      { name: 'urgency', label: 'Urgência', placeholder: 'Ex.: preciso apresentar amanhã / esta semana / sem prazo imediato…' },
      { name: 'currentMaterialStage', label: 'Estágio atual do material', placeholder: 'Ex.: rascunho, deck pronto, slides antigos, só tenho ideias…' },
      { name: 'notes', label: 'Observações extras', as: 'textarea', placeholder: 'Conte qualquer detalhe importante: problema, contexto político, objeções, expectativas…', full: true }
    ]
  },
  {
    title: 'Envie o arquivo da apresentação.',
    description: 'O MVP aceita PDF e PPTX. Quando o sistema conseguir extrair texto, a análise fica ainda melhor.',
    type: 'upload'
  },
  {
    title: 'Quem está por trás dessa apresentação?',
    description: 'Esses dados transformam o diagnóstico em lead qualificado e permitem continuidade comercial.',
    type: 'form',
    fields: [
      { name: 'fullName', label: 'Nome completo', placeholder: 'Seu nome' },
      { name: 'email', label: 'E-mail', type: 'email', placeholder: 'voce@empresa.com' },
      { name: 'company', label: 'Empresa', placeholder: 'Nome da empresa' },
      { name: 'roleTitle', label: 'Cargo', placeholder: 'Ex.: CEO, comercial, marketing…' },
      { name: 'whatsapp', label: 'WhatsApp', placeholder: 'Ex.: (16) 99999-9999' }
    ]
  },
  {
    title: 'Tudo certo. Vamos gerar o diagnóstico FRAME.',
    description: 'Revise rapidamente. Ao continuar, você recebe o resultado inicial gratuito e a oportunidade de avançar com a FRAME.',
    type: 'review'
  }
];

function renderOptions(step) {
  const selected = state.answers[step.key];
  return `
    <div class="step-label">Etapa ${state.step + 1}</div>
    <h2 class="step-title">${step.title}</h2>
    <p class="step-description">${step.description}</p>
    <div class="option-grid">
      ${step.options.map(([value, help]) => `
        <button type="button" class="option-card ${selected === value ? 'active' : ''}" data-value="${escapeHtml(value)}">
          <strong>${value}</strong>
          <span>${help}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderForm(step) {
  return `
    <div class="step-label">Etapa ${state.step + 1}</div>
    <h2 class="step-title">${step.title}</h2>
    <p class="step-description">${step.description}</p>
    <div class="form-grid">
      ${step.fields.map((field) => {
        const value = state.answers[field.name] || '';
        const isTextarea = field.as === 'textarea';
        return `
          <div class="input-card ${field.full ? 'full' : ''}">
            <label for="${field.name}">${field.label}</label>
            ${isTextarea
              ? `<textarea id="${field.name}" name="${field.name}" placeholder="${field.placeholder || ''}">${escapeHtml(value)}</textarea>`
              : `<input id="${field.name}" name="${field.name}" type="${field.type || 'text'}" placeholder="${field.placeholder || ''}" value="${escapeHtml(value)}" />`
            }
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderUpload(step) {
  const file = state.answers.presentationFile;
  return `
    <div class="step-label">Etapa ${state.step + 1}</div>
    <h2 class="step-title">${step.title}</h2>
    <p class="step-description">${step.description}</p>
    <div class="input-card">
      <label for="presentationFile">Arquivo</label>
      <input id="presentationFile" name="presentationFile" type="file" accept=".pdf,.pptx" />
      <p class="file-note">${file ? `Arquivo selecionado: <strong>${escapeHtml(file.name)}</strong>` : 'Opcional no MVP, mas recomendado para enriquecer a análise.'}</p>
    </div>
  `;
}

function renderReview() {
  const a = state.answers;
  return `
    <div class="step-label">Etapa ${state.step + 1}</div>
    <h2 class="step-title">Tudo pronto para a leitura inicial.</h2>
    <p class="step-description">Confira o resumo antes de gerar o diagnóstico.</p>
    <div class="form-grid">
      ${[
        ['Situação', a.currentSituation],
        ['Objetivo', a.objective],
        ['Público', a.audience],
        ['Contexto', a.presentationContext],
        ['Formato', a.presentationLocation],
        ['Duração', a.durationMinutes ? `${a.durationMinutes} min` : '—'],
        ['Métrica de sucesso', a.successMetric],
        ['Dor percebida', a.painLevel],
        ['Urgência', a.urgency],
        ['Material atual', a.currentMaterialStage],
        ['Nome', a.fullName],
        ['E-mail', a.email],
        ['Empresa', a.company],
        ['Cargo', a.roleTitle],
        ['WhatsApp', a.whatsapp],
        ['Arquivo', a.presentationFile?.name || 'Nenhum arquivo enviado']
      ].map(([label, value]) => `
        <div class="select-card">
          <label>${label}</label>
          <div class="helper">${escapeHtml(value || '—')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStep() {
  const step = steps[state.step];
  let html = '';

  if (step.type === 'options') html = renderOptions(step);
  if (step.type === 'form') html = renderForm(step);
  if (step.type === 'upload') html = renderUpload(step);
  if (step.type === 'review') html = renderReview();

  stepMount.innerHTML = html;

  const progress = ((state.step + 1) / steps.length) * 100;
  progressBar.style.width = `${progress}%`;
  stepCounter.textContent = `Passo ${state.step + 1} de ${steps.length}`;
  prevBtn.style.visibility = state.step === 0 ? 'hidden' : 'visible';
  nextBtn.classList.toggle('hidden', state.step === steps.length - 1);
  submitBtn.classList.toggle('hidden', state.step !== steps.length - 1);

  if (step.type === 'options') {
    stepMount.querySelectorAll('.option-card').forEach((button) => {
      button.addEventListener('click', () => {
        state.answers[step.key] = button.dataset.value;
        renderStep();
      });
    });
  }

  if (step.type === 'upload') {
    const input = document.getElementById('presentationFile');
    input?.addEventListener('change', (event) => {
      state.answers.presentationFile = event.target.files[0] || null;
      renderStep();
    });
  }

  if (step.type === 'form') {
    step.fields.forEach((field) => {
      const element = document.getElementById(field.name);
      element?.addEventListener('input', (event) => {
        state.answers[field.name] = event.target.value;
      });
    });
  }
}

function validateStep() {
  const step = steps[state.step];

  if (step.type === 'options') {
    if (!state.answers[step.key]) {
      alert('Escolha uma opção para continuar.');
      return false;
    }
  }

  if (step.type === 'form') {
    for (const field of step.fields) {
      if (['fullName', 'email'].includes(field.name) && !state.answers[field.name]?.trim()) {
        alert(`Preencha ${field.label}.`);
        return false;
      }
    }
  }

  if (step.title.includes('Quem está por trás')) {
    if (!state.answers.fullName || !state.answers.email) {
      alert('Preencha nome e e-mail para receber o diagnóstico.');
      return false;
    }
  }

  return true;
}

prevBtn.addEventListener('click', () => {
  if (state.step > 0) {
    state.step -= 1;
    renderStep();
  }
});

nextBtn.addEventListener('click', () => {
  if (!validateStep()) return;
  if (state.step < steps.length - 1) {
    state.step += 1;
    renderStep();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateStep()) return;

  const data = new FormData();
  Object.entries(state.answers).forEach(([key, value]) => {
    if (key === 'presentationFile') {
      if (value) data.append(key, value);
      return;
    }
    data.append(key, value ?? '');
  });

  form.classList.add('hidden');
  loadingState.classList.remove('hidden');
  startLoadingSimulation();

  try {
    const response = await fetch('/api/diagnostics', {
      method: 'POST',
      body: data,
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Falha ao gerar diagnóstico.');
    }

    if (payload.warning) console.warn(payload.warning);
    populateResult(payload.diagnostic);
    stopLoadingSimulation(100);
    loadingState.classList.add('hidden');
    resultState.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    stopLoadingSimulation(0);
    loadingState.classList.add('hidden');
    form.classList.remove('hidden');
    alert(error.message || 'Erro ao gerar diagnóstico.');
  }
});


function startLoadingSimulation() {
  stopLoadingSimulation();
  loadingStartAt = Date.now();

  const update = () => {
    const elapsed = Math.floor((Date.now() - loadingStartAt) / 1000);
    let percent = 0;

    if (elapsed <= 8) percent = elapsed * 5;
    else if (elapsed <= 18) percent = 40 + (elapsed - 8) * 3;
    else if (elapsed <= 30) percent = 70 + (elapsed - 18) * 1.5;
    else percent = 88 + Math.min((elapsed - 30) * 0.5, 8);

    percent = Math.max(3, Math.min(96, Math.round(percent)));
    updateLoadingUi(percent);
  };

  update();
  loadingTimer = window.setInterval(update, 1000);
}

function stopLoadingSimulation(finalPercent = 100) {
  if (loadingTimer) {
    window.clearInterval(loadingTimer);
    loadingTimer = null;
  }
  updateLoadingUi(finalPercent);
}

function updateLoadingUi(percent) {
  const stages = [
    { threshold: 12, text: 'Recebendo briefing e arquivo enviado…' },
    { threshold: 34, text: 'Lendo contexto, objetivo e público da apresentação…' },
    { threshold: 62, text: 'Pontuando Foco, Roteiro, Arquitetura, Mensagem e Estética…' },
    { threshold: 84, text: 'Consolidando leituras, recomendações e score final…' },
    { threshold: 100, text: 'Diagnóstico pronto. Preparando exibição do resultado…' },
  ];

  const totalEstimate = 45;
  const elapsed = Math.floor((Date.now() - loadingStartAt) / 1000);
  const remaining = percent >= 100 ? 0 : Math.max(3, totalEstimate - elapsed);
  const foundIndex = stages.findIndex((stage) => percent <= stage.threshold);
  const currentIndex = foundIndex === -1 ? stages.length - 1 : foundIndex;
  const currentStage = stages[currentIndex];

  if (loadingPercentEl) loadingPercentEl.textContent = `${percent}%`;
  if (loadingEtaEl) loadingEtaEl.textContent = remaining === 0 ? 'concluído' : `~ ${remaining}s`;
  if (loadingStatusTextEl) loadingStatusTextEl.textContent = currentStage.text;
  if (loadingProgressBarEl) loadingProgressBarEl.style.width = `${percent}%`;

  if (loadingChecklistEl) {
    [...loadingChecklistEl.children].forEach((item, index) => {
      item.classList.remove('active', 'done');
      if (percent >= 100 || index < currentIndex) item.classList.add('done');
      else if (index === currentIndex) item.classList.add('active');
    });
  }
}

function populateResult(diagnostic) {
  document.getElementById('resultHeadline').textContent = diagnostic.headline;
  document.getElementById('resultSummary').textContent = diagnostic.summary;
  document.getElementById('resultOverallScore').textContent = `${clampScore(diagnostic.score_overall)}/100`; 
  document.getElementById('resultRisk').textContent = diagnostic.main_risk;
  document.getElementById('resultStrength').textContent = diagnostic.strength;
  document.getElementById('resultCommercialHook').textContent = diagnostic.commercial_hook;

  const scoreGrid = document.getElementById('scoreGrid');
  scoreGrid.innerHTML = Object.entries(diagnostic.scores).map(([label, score]) => {
    const metric = METHOD_META[label] || { title: capitalize(label), short: '', average: 70, description: '' };
    const normalizedScore = clampScore(score);
    const statusLabel = getScoreLabel(normalizedScore);
    const delta = getScoreDelta(normalizedScore, metric.average);
    const detailedDescription = getMetricDescription(label, normalizedScore);
    return `
      <article class="score-card">
        <div class="score-card-top">
          <div class="score-card-title">
            <strong>${metric.title}</strong>
            <span>${metric.short}</span>
          </div>
          <div class="score-card-score">
            <b>${normalizedScore}</b>
            <span>/100</span>
          </div>
        </div>
        <div class="score-scale" aria-label="Escala de 0 a 100"><span style="width:${normalizedScore}%"></span></div>
        <div class="score-scale-legend"><span>0</span><span>100</span></div>
        <div class="score-meta-row">
          <span class="score-chip status">${statusLabel}</span>
          <span class="score-chip delta ${delta.className}">${delta.label}</span>
        </div>
        <p class="score-description">${escapeHtml(detailedDescription)}</p>
      </article>
    `;
  }).join('');

  document.getElementById('resultFindings').innerHTML = diagnostic.findings.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  document.getElementById('resultRecommendations').innerHTML = diagnostic.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  const message = encodeURIComponent(
    `Olá, FRAME. Acabei de gerar meu diagnóstico inicial e quero avançar.\n\nNome: ${state.answers.fullName}\nEmpresa: ${state.answers.company || 'Não informado'}\nObjetivo: ${state.answers.objective}\nPúblico: ${state.answers.audience}\nScore geral: ${Math.round(diagnostic.score_overall)}\n\nResumo: ${diagnostic.summary}`
  );

  document.getElementById('whatsCta').href = `https://wa.me/5516981511992?text=${message}`;

  const downloadBtn = document.getElementById('downloadPdfBtn');
  if (downloadBtn) {
    downloadBtn.onclick = () => downloadDiagnosticPdf(diagnostic);
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalize(value = '') {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

renderStep();


function downloadDiagnosticPdf(diagnostic) {
  const jsPDFLib = window.jspdf;
  if (!jsPDFLib?.jsPDF) {
    alert('Não foi possível carregar o gerador de PDF.');
    return;
  }

  const { jsPDF } = jsPDFLib;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addWrapped = (text, size = 11, weight = 'normal', color = [36,31,28], gap = 18) => {
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text || ''), contentWidth);
    const lineHeight = size * 1.45;
    if (y + lines.length * lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + gap;
  };

  const addList = (items) => {
    (items || []).forEach((item) => addWrapped('• ' + item, 11, 'normal', [36,31,28], 8));
    y += 8;
  };

  doc.setFillColor(237, 118, 27);
  doc.roundedRect(margin, y, contentWidth, 88, 18, 18, 'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('FRAME • Diagnóstico de Apresentações', margin + 20, y + 26);
  doc.setFontSize(26);
  doc.text(String(diagnostic.headline || 'Diagnóstico inicial'), margin + 20, y + 58, { maxWidth: contentWidth - 120 });
  doc.setFontSize(28);
  doc.text(String(Math.round(diagnostic.score_overall || 0)), pageWidth - margin - 50, y + 54, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Score geral', pageWidth - margin - 50, y + 70, { align: 'center' });
  y += 120;

  addWrapped('Resumo', 15, 'bold', [237,118,27], 10);
  addWrapped(diagnostic.summary, 11);

  addWrapped('Contexto do lead', 15, 'bold', [237,118,27], 10);
  const leadLines = [
    `Nome: ${state.answers.fullName || 'Não informado'}`,
    `Empresa: ${state.answers.company || 'Não informado'}`,
    `Cargo: ${state.answers.roleTitle || 'Não informado'}`,
    `Objetivo: ${state.answers.objective || 'Não informado'}`,
    `Público: ${state.answers.audience || 'Não informado'}`,
    `Métrica de sucesso: ${state.answers.successMetric || 'Não informado'}`,
  ];
  leadLines.forEach(line => addWrapped(line, 11, 'normal', [36,31,28], 6));
  y += 8;

  addWrapped('Scores FRAME', 15, 'bold', [237,118,27], 10);
  Object.entries(diagnostic.scores || {}).forEach(([label, score]) => {
    const metric = METHOD_META[label] || { title: capitalize(label), average: 70 };
    const normalizedScore = clampScore(score);
    const statusLabel = getScoreLabel(normalizedScore);
    const delta = getScoreDelta(normalizedScore, metric.average);
    addWrapped(`${metric.title}: ${normalizedScore}/100 • ${statusLabel} • ${delta.label}`, 11, 'normal', [36,31,28], 6);
    addWrapped(getMetricDescription(label, normalizedScore), 10, 'normal', [103,95,89], 8);
  });
  y += 8;

  addWrapped('Principal risco', 15, 'bold', [237,118,27], 10);
  addWrapped(diagnostic.main_risk, 11);
  addWrapped('Ponto forte', 15, 'bold', [237,118,27], 10);
  addWrapped(diagnostic.strength, 11);
  addWrapped('Leituras da FRAME', 15, 'bold', [237,118,27], 10);
  addList(diagnostic.findings || []);
  addWrapped('Próximos movimentos', 15, 'bold', [237,118,27], 10);
  addList(diagnostic.recommendations || []);
  addWrapped('Próximo passo', 15, 'bold', [237,118,27], 10);
  addWrapped(diagnostic.commercial_hook || 'Se quiser avançar, fale com a FRAME para transformar esse diagnóstico em uma proposta de melhoria.', 11);

  const filenameBase = (state.answers.fullName || 'diagnostico-frame').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  doc.save(`${filenameBase || 'diagnostico-frame'}.pdf`);
}
