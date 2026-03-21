const stageLabels = {
  lead_entrou: 'Lead entrou',
  diagnostico_enviado: 'Diagnóstico enviado',
  conversa_iniciada: 'Conversa iniciada',
  proposta_enviada: 'Proposta enviada',
  fechado: 'Fechado',
};

const state = { leads: [], selectedLeadId: null, stages: [] };

const summaryCards = document.getElementById('summaryCards');
const stageFilter = document.getElementById('stageFilter');
const searchInput = document.getElementById('searchInput');
const leadList = document.getElementById('leadList');
const detailPanel = document.getElementById('detailPanel');
const listCount = document.getElementById('listCount');

document.getElementById('refreshBtn')?.addEventListener('click', loadAll);
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await fetch('/api/crm/logout', { method: 'POST' });
  window.location.href = '/crm-frame/login';
});
stageFilter?.addEventListener('change', loadLeads);
searchInput?.addEventListener('input', debounce(loadLeads, 300));

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (response.status === 401) {
    window.location.href = '/crm-frame/login';
    return null;
  }
  if (!response.ok || !payload.success) throw new Error(payload.error || 'Falha na requisição.');
  return payload;
}

async function loadAll() {
  try {
    const me = await fetchJson('/api/crm/me');
    if (!me) return;
    const [overview, leadsPayload] = await Promise.all([
      fetchJson('/api/crm/overview'),
      fetchJson(buildLeadsUrl()),
    ]);
    renderSummary(overview.overview);
    state.leads = leadsPayload.leads;
    state.stages = leadsPayload.stages;
    populateStageFilter(leadsPayload.stages);
    renderLeadList();
    if (state.selectedLeadId) {
      const lead = state.leads.find((item) => item.lead_id === state.selectedLeadId);
      renderDetail(lead || null);
    }
  } catch (error) {
    alert(error.message || 'Erro ao carregar CRM.');
  }
}

async function loadLeads() {
  try {
    const payload = await fetchJson(buildLeadsUrl());
    if (!payload) return;
    state.leads = payload.leads;
    state.stages = payload.stages;
    renderLeadList();
    const lead = state.leads.find((item) => item.lead_id === state.selectedLeadId) || state.leads[0] || null;
    state.selectedLeadId = lead?.lead_id || null;
    renderDetail(lead);
  } catch (error) {
    alert(error.message || 'Erro ao carregar leads.');
  }
}

function buildLeadsUrl() {
  const params = new URLSearchParams();
  if (stageFilter?.value) params.set('stage', stageFilter.value);
  if (searchInput?.value?.trim()) params.set('search', searchInput.value.trim());
  const qs = params.toString();
  return `/api/crm/leads${qs ? `?${qs}` : ''}`;
}

function renderSummary(overview) {
  summaryCards.innerHTML = `
    ${Object.entries(overview).map(([key, total]) => `
      <article class="card crm-summary-card ${key === 'total' ? 'crm-summary-card-total' : ''}">
        <small>${key === 'total' ? 'Total de leads' : stageLabels[key] || key}</small>
        <strong>${total}</strong>
      </article>
    `).join('')}
  `;
}

function populateStageFilter(stages) {
  const current = stageFilter.value;
  stageFilter.innerHTML = `<option value="">Todas</option>${stages.map((stage) => `<option value="${stage}">${stageLabels[stage]}</option>`).join('')}`;
  stageFilter.value = current;
}

function renderLeadList() {
  listCount.textContent = `${state.leads.length} registro(s)`;
  if (!state.leads.length) {
    leadList.innerHTML = `<div class="crm-empty-state"><p>Nenhum lead encontrado com esse filtro.</p></div>`;
    detailPanel.innerHTML = `<div class="crm-empty-state"><h3>Nada selecionado</h3><p>Ajuste os filtros ou gere um novo diagnóstico.</p></div>`;
    return;
  }
  leadList.innerHTML = state.leads.map((lead) => `
    <button type="button" class="crm-lead-item ${lead.lead_id === state.selectedLeadId ? 'active' : ''}" data-id="${lead.lead_id}">
      <div>
        <strong>${escapeHtml(lead.full_name)}</strong>
        <span>${escapeHtml(lead.company || lead.email)}</span>
      </div>
      <div class="crm-lead-meta">
        <span class="crm-stage-pill">${stageLabels[lead.crm_stage] || lead.crm_stage}</span>
        <small>${formatDate(lead.diagnostic_created_at || lead.lead_created_at)}</small>
      </div>
    </button>
  `).join('');

  leadList.querySelectorAll('.crm-lead-item').forEach((item) => {
    item.addEventListener('click', () => {
      state.selectedLeadId = item.dataset.id;
      renderLeadList();
      renderDetail(state.leads.find((lead) => lead.lead_id === state.selectedLeadId));
    });
  });

  if (!state.selectedLeadId) {
    state.selectedLeadId = state.leads[0].lead_id;
    renderLeadList();
  }
  renderDetail(state.leads.find((lead) => lead.lead_id === state.selectedLeadId));
}

function renderDetail(lead) {
  if (!lead) {
    detailPanel.innerHTML = `<div class="crm-empty-state"><h3>Selecione um lead</h3></div>`;
    return;
  }
  const diagnostic = lead.diagnostic_json || {};
  const scores = diagnostic.scores || {};
  detailPanel.innerHTML = `
    <div class="crm-detail-head">
      <div>
        <span class="crm-stage-pill">${stageLabels[lead.crm_stage] || lead.crm_stage}</span>
        <h2>${escapeHtml(lead.full_name)}</h2>
        <p>${escapeHtml(lead.company || 'Empresa não informada')} · ${escapeHtml(lead.role_title || 'Cargo não informado')}</p>
      </div>
      <div class="score-badge small-score">
        <small>Score</small>
        <strong>${Math.round(diagnostic.score_overall || 0)}</strong>
      </div>
    </div>

    <div class="crm-actions-inline">
      <label class="crm-stage-control">
        <span>Mover etapa</span>
        <select id="stageSelect">
          ${state.stages.map((stage) => `<option value="${stage}" ${lead.crm_stage === stage ? 'selected' : ''}>${stageLabels[stage]}</option>`).join('')}
        </select>
      </label>
      <input id="stageNote" type="text" placeholder="Observação rápida da etapa" value="${escapeHtml(lead.stage_notes || '')}" />
      <button id="saveStageBtn" class="btn btn-primary">Salvar etapa</button>
    </div>

    <div class="crm-detail-grid">
      <article class="crm-detail-block">
        <h3>Contato</h3>
        <ul class="clean-list compact-list">
          <li><strong>E-mail:</strong> ${escapeHtml(lead.email || '—')}</li>
          <li><strong>WhatsApp:</strong> ${escapeHtml(lead.whatsapp || '—')}</li>
          <li><strong>Empresa:</strong> ${escapeHtml(lead.company || '—')}</li>
          <li><strong>Última etapa:</strong> ${formatDate(lead.stage_updated_at)}</li>
        </ul>
      </article>
      <article class="crm-detail-block">
        <h3>Briefing do diagnóstico</h3>
        <ul class="clean-list compact-list">
          <li><strong>Objetivo:</strong> ${escapeHtml(lead.objective || '—')}</li>
          <li><strong>Público:</strong> ${escapeHtml(lead.audience || '—')}</li>
          <li><strong>Contexto:</strong> ${escapeHtml(lead.presentation_context || '—')}</li>
          <li><strong>Formato:</strong> ${escapeHtml(lead.presentation_location || '—')}</li>
          <li><strong>Métrica:</strong> ${escapeHtml(lead.success_metric || '—')}</li>
          <li><strong>Arquivo:</strong> ${escapeHtml(lead.uploaded_filename || 'Nenhum')}</li>
        </ul>
      </article>
    </div>

    <article class="crm-detail-block">
      <h3>Diagnóstico pronto</h3>
      <p><strong>${escapeHtml(diagnostic.headline || 'Sem headline')}</strong></p>
      <p>${escapeHtml(diagnostic.summary || 'Sem resumo gerado.')}</p>
      <div class="score-grid crm-score-grid">
        ${Object.entries(scores).map(([label, score]) => `
          <article class="score-card"><b>${Math.round(score || 0)}</b><span>${capitalize(label)}</span></article>
        `).join('')}
      </div>
    </article>

    <div class="crm-detail-grid">
      <article class="crm-detail-block">
        <h3>Risco principal</h3>
        <p>${escapeHtml(diagnostic.main_risk || '—')}</p>
        <h3>Ponto forte</h3>
        <p>${escapeHtml(diagnostic.strength || '—')}</p>
      </article>
      <article class="crm-detail-block">
        <h3>Recomendações</h3>
        <ul class="clean-list compact-list">${(diagnostic.recommendations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
    </div>

    <article class="crm-detail-block">
      <h3>Timeline comercial</h3>
      <div class="crm-timeline">
        ${(lead.timeline || []).length ? lead.timeline.map((item) => `
          <div class="crm-timeline-item">
            <strong>${stageLabels[item.to_stage] || item.to_stage}</strong>
            <span>${formatDate(item.created_at)}</span>
            <p>${escapeHtml(item.note || 'Sem observação')}</p>
          </div>
        `).join('') : '<p class="muted">Nenhuma movimentação registrada ainda.</p>'}
      </div>
    </article>
  `;

  document.getElementById('saveStageBtn')?.addEventListener('click', async () => {
    const stage = document.getElementById('stageSelect').value;
    const note = document.getElementById('stageNote').value;
    try {
      await fetchJson(`/api/crm/leads/${lead.lead_id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, note }),
      });
      await loadAll();
    } catch (error) {
      alert(error.message || 'Erro ao salvar etapa.');
    }
  });
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function capitalize(value = '') {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

loadAll();
