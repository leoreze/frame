const stageOrder = ['lead_entrou', 'diagnostico_enviado', 'conversa_iniciada', 'proposta_enviada', 'fechado'];
const stageColors = {
  lead_entrou: '',
  diagnostico_enviado: 'blue',
  conversa_iniciada: 'dark',
  proposta_enviada: '',
  fechado: 'blue',
};

const statsGrid = document.getElementById('statsGrid');
const leadsTableBody = document.getElementById('leadsTableBody');
const crmWelcome = document.getElementById('crmWelcome');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const logoutTopBtn = document.getElementById('logoutTopBtn');
const crmModal = document.getElementById('crmModal');
const crmModalTitle = document.getElementById('crmModalTitle');
const crmModalBody = document.getElementById('crmModalBody');
const crmModalClose = document.getElementById('crmModalClose');

let stageLabels = {};
let leads = [];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatStage(stage) {
  return stageLabels[stage] || stage || '—';
}

function stageIndex(stage) {
  return stageOrder.indexOf(stage);
}

function openModal(title, content) {
  crmModalTitle.textContent = title;
  crmModalBody.innerHTML = content;
  crmModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  bindModalInnerActions();
}

function closeModal() {
  crmModal.setAttribute('aria-hidden', 'true');
  crmModalBody.innerHTML = '';
  document.body.style.overflow = '';
}

function renderStats() {
  const counts = Object.fromEntries(stageOrder.map((stage) => [stage, 0]));
  for (const lead of leads) counts[lead.crmStage] = (counts[lead.crmStage] || 0) + 1;
  statsGrid.innerHTML = stageOrder.map((stage) => `
    <article class="stat-card">
      <span>${formatStage(stage)}</span>
      <strong>${counts[stage] || 0}</strong>
    </article>
  `).join('');
}

function latestDiagnostic(lead) {
  return (lead.diagnostics || [])[0] || null;
}

function renderTable() {
  const query = (searchInput.value || '').trim().toLowerCase();
  const filtered = leads.filter((lead) => {
    if (!query) return true;
    const blob = [lead.fullName, lead.email, lead.company, lead.objective, lead.audience, lead.whatsapp]
      .filter(Boolean).join(' ').toLowerCase();
    return blob.includes(query);
  });

  if (!filtered.length) {
    leadsTableBody.innerHTML = '<tr><td colspan="6">Nenhum lead encontrado.</td></tr>';
    return;
  }

  leadsTableBody.innerHTML = filtered.map((lead) => {
    const diagnostic = latestDiagnostic(lead);
    const hasUpload = diagnostic?.hasUpload;
    return `
      <tr>
        <td>
          <strong>${escapeHtml(lead.fullName)}</strong><br>
          <span style="color:var(--muted);">${escapeHtml(lead.company || lead.email || 'Sem empresa')}</span><br>
          <span class="tiny-muted">${escapeHtml(lead.email || '—')}</span>
        </td>
        <td>
          <strong>${escapeHtml(lead.objective || '—')}</strong><br>
          <span style="color:var(--muted);">${escapeHtml(lead.audience || '—')}</span><br>
          <span class="tiny-muted">${formatDate(diagnostic?.createdAt || lead.createdAt)}</span>
        </td>
        <td>${lead.scoreOverall != null ? Math.round(lead.scoreOverall) : '—'}</td>
        <td><span class="badge ${stageColors[lead.crmStage] || ''}">${escapeHtml(formatStage(lead.crmStage))}</span></td>
        <td><span class="count-pill">${lead.diagnosticsCount || 0}</span></td>
        <td>
          <div class="icon-actions">
            <button class="icon-btn" type="button" data-action="stage-flow" data-id="${lead.id}" title="Ver estágio no funil">◔</button>
            <button class="icon-btn" type="button" data-action="details" data-id="${lead.id}" title="Abrir detalhes em modal">⌕</button>
            <button class="icon-btn ${hasUpload ? '' : 'is-disabled'}" type="button" data-action="download" data-id="${lead.id}" title="Baixar apresentação enviada" ${hasUpload ? '' : 'disabled'}>⇩</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  bindTableActions();
}

function renderStageFlowModal(lead) {
  const currentIndex = stageIndex(lead.crmStage);
  const html = `
    <div class="modal-stack">
      <p style="margin:0;color:var(--muted);line-height:1.7;">Pipeline completo do lead <strong>${escapeHtml(lead.fullName)}</strong>. A etapa atual aparece destacada.</p>
      <div class="stage-flow">
        ${stageOrder.map((stage, index) => {
          const stateClass = index < currentIndex ? 'done' : index === currentIndex ? 'active' : '';
          return `
            <div class="stage-flow-item ${stateClass}">
              <div class="stage-flow-step">${index + 1}</div>
              <div>
                <strong>${escapeHtml(formatStage(stage))}</strong>
                <small>${index === currentIndex ? 'Etapa atual' : index < currentIndex ? 'Etapa concluída' : 'Próxima etapa do funil'}</small>
              </div>
              <small>${index === currentIndex ? formatDate(lead.crmLastContactAt || lead.createdAt) : '—'}</small>
            </div>`;
        }).join('')}
      </div>
    </div>`;
  openModal(`Funil de ${lead.fullName}`, html);
}

function renderDiagnosticItem(diagnostic) {
  return `
    <div class="history-card">
      <div>
        <strong>${escapeHtml(diagnostic.objective || 'Diagnóstico')}</strong>
        <small>${formatDate(diagnostic.createdAt)} · Score ${diagnostic.scoreOverall != null ? Math.round(diagnostic.scoreOverall) : '—'}</small>
      </div>
      <div class="history-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-diagnostic-details="${diagnostic.diagnosticId}">Detalhes</button>
        ${diagnostic.hasUpload ? `<a class="btn btn-ghost btn-sm" href="/api/crm/diagnostics/${diagnostic.diagnosticId}/download">Baixar apresentação</a>` : '<span class="tiny-muted">Sem upload</span>'}
      </div>
    </div>`;
}

function renderTimelineItem(lead, item) {
  return `
    <div class="history-card">
      <div>
        <strong>${escapeHtml(item.stageLabel)}</strong>
        <small>${formatDate(item.createdAt)}</small>
      </div>
      <div class="history-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-timeline-details="${item.id}" data-lead-id="${lead.id}">Detalhes</button>
      </div>
    </div>`;
}

function renderLeadDetailsModal(lead) {
  const diagnostic = latestDiagnostic(lead);
  const html = `
    <div class="modal-stack">
      <div>
        <div class="badge ${stageColors[lead.crmStage] || ''}">${escapeHtml(formatStage(lead.crmStage))}</div>
        <h3 style="margin:12px 0 0;">${escapeHtml(lead.fullName)}</h3>
        <p style="margin:8px 0 0;color:var(--muted);line-height:1.7;">${escapeHtml(lead.headline || 'Lead capturado pelo diagnóstico FRAME.')}</p>
      </div>

      <div class="summary-strip">
        <div class="summary-chip"><strong>${lead.diagnosticsCount || 0}</strong><span>diagnósticos com este e-mail</span></div>
        <div class="summary-chip"><strong>${escapeHtml(lead.email || '—')}</strong><span>e-mail agrupado</span></div>
        <div class="summary-chip"><strong>${escapeHtml(lead.company || '—')}</strong><span>empresa</span></div>
      </div>

      <div class="modal-grid">
        <div class="modal-box"><label>E-mail</label>${escapeHtml(lead.email || '—')}</div>
        <div class="modal-box"><label>WhatsApp</label>${escapeHtml(lead.whatsapp || '—')}</div>
        <div class="modal-box"><label>Empresa</label>${escapeHtml(lead.company || '—')}</div>
        <div class="modal-box"><label>Cargo</label>${escapeHtml(lead.roleTitle || '—')}</div>
        <div class="modal-box"><label>Objetivo</label>${escapeHtml(lead.objective || '—')}</div>
        <div class="modal-box"><label>Público</label>${escapeHtml(lead.audience || '—')}</div>
        <div class="modal-box"><label>Contexto</label>${escapeHtml(lead.presentationContext || '—')}</div>
        <div class="modal-box"><label>Local / formato</label>${escapeHtml(lead.presentationLocation || '—')}</div>
        <div class="modal-box"><label>Métrica de sucesso</label>${escapeHtml(lead.successMetric || '—')}</div>
        <div class="modal-box"><label>Urgência</label>${escapeHtml(lead.urgency || '—')}</div>
      </div>

      <div class="score-strip">
        <div class="score-pill"><strong>${lead.scoreOverall != null ? Math.round(lead.scoreOverall) : '—'}</strong><span>Geral</span></div>
        ${['foco','roteiro','arquitetura','mensagem','estetica'].map((key) => `
          <div class="score-pill"><strong>${lead.scores?.[key] != null ? Math.round(lead.scores[key]) : '—'}</strong><span>${key[0].toUpperCase() + key.slice(1)}</span></div>
        `).join('')}
      </div>

      <div class="modal-grid">
        <div class="modal-box"><label>Resumo</label>${escapeHtml(lead.summary || '—')}</div>
        <div class="modal-box"><label>Hook comercial</label>${escapeHtml(lead.commercialHook || '—')}</div>
      </div>

      <div class="action-panel">
        <h4>Atualizar etapa</h4>
        <div class="action-grid">
          <select id="modalStageSelect">
            ${stageOrder.map((stage) => `<option value="${stage}" ${lead.crmStage === stage ? 'selected' : ''}>${escapeHtml(formatStage(stage))}</option>`).join('')}
          </select>
          <input id="modalOwnerInput" placeholder="Responsável comercial" value="${escapeHtml(lead.crmOwner || '')}" />
        </div>
        <textarea id="modalStageNote" rows="3" placeholder="Observação comercial"></textarea>
        <div class="timeline-actions">
          <button class="btn btn-primary" type="button" id="saveStageBtn" data-lead-id="${lead.id}">Salvar etapa</button>
          <a class="btn btn-ghost" href="mailto:${encodeURIComponent(lead.email || '')}">Conferir e-mail</a>
          ${lead.whatsapp ? `<a class="btn btn-ghost" target="_blank" rel="noreferrer" href="https://wa.me/55${String(lead.whatsapp).replace(/\D/g,'')}">Abrir WhatsApp</a>` : ''}
          ${diagnostic?.hasUpload ? `<a class="btn btn-ghost" href="/api/crm/diagnostics/${diagnostic.diagnosticId}/download">Baixar último upload</a>` : ''}
        </div>
      </div>

      <section>
        <h4 style="margin:0 0 12px;">Histórico de diagnósticos</h4>
        <div class="history-list">
          ${(lead.diagnostics || []).length ? lead.diagnostics.map(renderDiagnosticItem).join('') : '<p class="tiny-muted">Nenhum diagnóstico encontrado.</p>'}
        </div>
      </section>

      <section>
        <h4 style="margin:0 0 12px;">Timeline comercial</h4>
        <div class="history-list">
          ${(lead.timeline || []).length ? lead.timeline.map((item) => renderTimelineItem(lead, item)).join('') : '<p class="tiny-muted">Nenhum histórico comercial registrado.</p>'}
        </div>
      </section>
    </div>`;
  openModal(`Detalhes de ${lead.fullName}`, html);
}

function renderDiagnosticDetailsModal(lead, diagnosticId) {
  const diagnostic = (lead.diagnostics || []).find((item) => item.diagnosticId === diagnosticId);
  if (!diagnostic) return;
  const html = `
    <div class="modal-stack">
      <div class="modal-grid">
        <div class="modal-box"><label>Data</label>${formatDate(diagnostic.createdAt)}</div>
        <div class="modal-box"><label>Objetivo</label>${escapeHtml(diagnostic.objective || '—')}</div>
        <div class="modal-box"><label>Público</label>${escapeHtml(diagnostic.audience || '—')}</div>
        <div class="modal-box"><label>Score geral</label>${diagnostic.scoreOverall != null ? Math.round(diagnostic.scoreOverall) : '—'}</div>
      </div>
      <div class="modal-box"><label>Resumo</label>${escapeHtml(diagnostic.summary || '—')}</div>
      <div class="modal-box"><label>Recomendações</label>
        <ul class="detail-list">${(diagnostic.recommendations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>—</li>'}</ul>
      </div>
      <div class="timeline-actions">
        <a class="btn btn-ghost" href="mailto:${encodeURIComponent(lead.email || '')}">Conferir e-mail</a>
        ${diagnostic.hasUpload ? `<a class="btn btn-ghost" href="/api/crm/diagnostics/${diagnostic.diagnosticId}/download">Baixar apresentação</a>` : ''}
      </div>
    </div>`;
  openModal(`Diagnóstico de ${lead.fullName}`, html);
}

function renderTimelineDetailsModal(lead, timelineId) {
  const item = (lead.timeline || []).find((entry) => entry.id === timelineId);
  if (!item) return;
  const html = `
    <div class="modal-stack">
      <div class="modal-grid">
        <div class="modal-box"><label>Lead</label>${escapeHtml(lead.fullName)}</div>
        <div class="modal-box"><label>Etapa</label>${escapeHtml(item.stageLabel)}</div>
        <div class="modal-box"><label>Data</label>${formatDate(item.createdAt)}</div>
        <div class="modal-box"><label>E-mail</label>${escapeHtml(lead.email || '—')}</div>
      </div>
      <div class="modal-box"><label>Observação</label>${escapeHtml(item.note || 'Sem observação.')}</div>
      <div class="timeline-actions">
        <a class="btn btn-ghost" href="mailto:${encodeURIComponent(lead.email || '')}">Conferir e-mail</a>
      </div>
    </div>`;
  openModal(`Histórico de ${lead.fullName}`, html);
}

async function updateLeadStage(leadId) {
  const stage = document.getElementById('modalStageSelect')?.value;
  const owner = document.getElementById('modalOwnerInput')?.value || '';
  const note = document.getElementById('modalStageNote')?.value || '';
  const button = document.getElementById('saveStageBtn');
  if (!stage || !button) return;
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = 'Salvando...';
  try {
    const response = await fetch(`/api/crm/leads/${leadId}/stage`, {
      credentials: 'include',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, owner, note })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Não foi possível atualizar a etapa.');
    await loadCrmData();
    const lead = leads.find((item) => item.id === leadId) || leads.find((item) => (item.relatedLeadIds || []).includes(leadId));
    if (lead) renderLeadDetailsModal(lead);
  } catch (error) {
    alert(error.message || 'Não foi possível atualizar a etapa.');
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

function bindTableActions() {
  leadsTableBody.querySelectorAll('[data-action="stage-flow"]').forEach((button) => {
    button.addEventListener('click', () => {
      const lead = leads.find((item) => item.id === button.dataset.id);
      if (lead) renderStageFlowModal(lead);
    });
  });
  leadsTableBody.querySelectorAll('[data-action="details"]').forEach((button) => {
    button.addEventListener('click', () => {
      const lead = leads.find((item) => item.id === button.dataset.id);
      if (lead) renderLeadDetailsModal(lead);
    });
  });
  leadsTableBody.querySelectorAll('[data-action="download"]').forEach((button) => {
    button.addEventListener('click', () => {
      const lead = leads.find((item) => item.id === button.dataset.id);
      const diagnostic = lead ? latestDiagnostic(lead) : null;
      if (!diagnostic?.hasUpload) return;
      window.location.href = `/api/crm/diagnostics/${diagnostic.diagnosticId}/download`;
    });
  });
}

function bindModalInnerActions() {
  document.getElementById('saveStageBtn')?.addEventListener('click', () => {
    updateLeadStage(document.getElementById('saveStageBtn').dataset.leadId);
  });
  crmModalBody.querySelectorAll('[data-diagnostic-details]').forEach((button) => {
    button.addEventListener('click', () => {
      const diagnosticId = button.dataset.diagnosticDetails;
      const lead = leads.find((item) => (item.diagnostics || []).some((entry) => entry.diagnosticId === diagnosticId));
      if (lead) renderDiagnosticDetailsModal(lead, diagnosticId);
    });
  });
  crmModalBody.querySelectorAll('[data-timeline-details]').forEach((button) => {
    button.addEventListener('click', () => {
      const lead = leads.find((item) => item.id === button.dataset.leadId);
      if (lead) renderTimelineDetailsModal(lead, button.dataset.timelineDetails);
    });
  });
}

async function loadSession() {
  const response = await fetch('/api/crm/me', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    window.location.href = '/crm-frame/login';
    return false;
  }
  const payload = await response.json();
  crmWelcome.textContent = `Sessão ativa como ${payload.user.user}`;
  return true;
}

async function loadCrmData() {
  const response = await fetch('/api/crm/leads', { credentials: 'include', cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    if (response.status === 401) {
      window.location.href = '/crm-frame/login';
      return;
    }
    throw new Error(payload.error || 'Não foi possível carregar o CRM.');
  }
  stageLabels = payload.stageLabels || {};
  leads = payload.leads || [];
  renderStats();
  renderTable();
}

async function logout() {
  await fetch('/api/crm/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/crm-frame/login';
}

refreshBtn.addEventListener('click', () => loadCrmData().catch((error) => alert(error.message)));
searchInput.addEventListener('input', renderTable);
logoutBtn.addEventListener('click', logout);
logoutTopBtn.addEventListener('click', logout);
crmModalClose.addEventListener('click', closeModal);
document.querySelector('[data-close-modal]').addEventListener('click', closeModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && crmModal.getAttribute('aria-hidden') === 'false') closeModal();
});

(async () => {
  const ok = await loadSession();
  if (!ok) return;
  try {
    await loadCrmData();
  } catch (error) {
    alert(error.message || 'Não foi possível carregar o CRM.');
  }
})();
