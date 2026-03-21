import express from 'express';
import session from 'express-session';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { pool } from '../db.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../../public');

const CRM_STAGES = ['lead_entrou', 'diagnostico_enviado', 'conversa_iniciada', 'proposta_enviada', 'fechado'];
const STAGE_LABELS = {
  lead_entrou: 'Lead entrou',
  diagnostico_enviado: 'Diagnóstico enviado',
  conversa_iniciada: 'Conversa iniciada',
  proposta_enviada: 'Proposta enviada',
  fechado: 'Fechado',
};

const isProd = process.env.NODE_ENV === 'production';

export const crmSessionMiddleware = session({
  name: 'frame_crm',
  secret: process.env.CRM_SESSION_SECRET || process.env.SESSION_SECRET || 'frame-crm-dev-secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto',
    maxAge: 1000 * 60 * 60,
  },
});

function requireCrmAuth(req, res, next) {
  if (req.session?.crmUser) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ success: false, error: 'Sessão expirada.' });
  return res.redirect('/crm-frame/login');
}

function parseDiagnosticJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stageOrder(stage) {
  return CRM_STAGES.indexOf(stage);
}

function normalizeLeadRow(row) {
  const diagnostic = parseDiagnosticJson(row.diagnostic_json);
  return {
    id: row.lead_id,
    diagnosticId: row.diagnostic_id,
    fullName: row.full_name,
    email: row.email,
    company: row.company,
    roleTitle: row.role_title,
    whatsapp: row.whatsapp,
    consent: row.consent,
    createdAt: row.created_at,
    diagnosticCreatedAt: row.diagnostic_created_at || row.created_at,
    crmStage: row.crm_stage,
    crmStageLabel: STAGE_LABELS[row.crm_stage] || row.crm_stage,
    crmLastContactAt: row.crm_last_contact_at,
    crmOwner: row.crm_owner,
    objective: row.objective,
    audience: row.audience,
    presentationContext: row.presentation_context,
    presentationLocation: row.presentation_location,
    durationMinutes: row.duration_minutes,
    successMetric: row.success_metric,
    painLevel: row.pain_level,
    urgency: row.urgency,
    currentMaterialStage: row.current_material_stage,
    notes: row.notes,
    uploadedFilename: row.uploaded_filename,
    uploadedPath: row.uploaded_path,
    scoreOverall: diagnostic?.score_overall ?? null,
    scores: diagnostic?.scores ?? {},
    summary: diagnostic?.summary ?? '',
    headline: diagnostic?.headline ?? '',
    findings: diagnostic?.findings ?? [],
    recommendations: diagnostic?.recommendations ?? [],
    commercialHook: diagnostic?.commercial_hook ?? '',
    mainRisk: diagnostic?.main_risk ?? '',
    strength: diagnostic?.strength ?? '',
  };
}

function emailKey(value) {
  return String(value || '').trim().toLowerCase();
}

function groupLeadsByEmail(rows, timelineMap = {}) {
  const groups = new Map();

  for (const rawRow of rows) {
    const row = normalizeLeadRow(rawRow);
    const key = emailKey(row.email) || row.id;
    const existing = groups.get(key);
    const diagnostics = [];
    if (row.diagnosticId) {
      diagnostics.push({
        diagnosticId: row.diagnosticId,
        leadId: row.id,
        createdAt: row.diagnosticCreatedAt,
        objective: row.objective,
        audience: row.audience,
        scoreOverall: row.scoreOverall,
        uploadedFilename: row.uploadedFilename,
        hasUpload: Boolean(row.uploadedPath && row.uploadedFilename),
        summary: row.summary,
        recommendations: row.recommendations || [],
      });
    }

    if (!existing) {
      groups.set(key, {
        ...row,
        timeline: timelineMap[row.id] || [],
        relatedLeadIds: [row.id],
        diagnostics,
        diagnosticsCount: diagnostics.length || 1,
      });
      continue;
    }

    existing.relatedLeadIds.push(row.id);
    existing.timeline = [
      ...(existing.timeline || []),
      ...(timelineMap[row.id] || [])
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    existing.diagnostics.push(...diagnostics);
    existing.diagnosticsCount = existing.diagnostics.length;

    const existingTime = new Date(existing.crmLastContactAt || existing.diagnosticCreatedAt || existing.createdAt || 0).getTime();
    const rowTime = new Date(row.crmLastContactAt || row.diagnosticCreatedAt || row.createdAt || 0).getTime();
    if (rowTime >= existingTime) {
      Object.assign(existing, {
        id: row.id,
        diagnosticId: row.diagnosticId,
        fullName: row.fullName,
        company: row.company || existing.company,
        roleTitle: row.roleTitle || existing.roleTitle,
        whatsapp: row.whatsapp || existing.whatsapp,
        consent: row.consent,
        createdAt: row.createdAt,
        diagnosticCreatedAt: row.diagnosticCreatedAt,
        crmStage: row.crmStage,
        crmStageLabel: row.crmStageLabel,
        crmLastContactAt: row.crmLastContactAt,
        crmOwner: row.crmOwner,
        objective: row.objective,
        audience: row.audience,
        presentationContext: row.presentationContext,
        presentationLocation: row.presentationLocation,
        durationMinutes: row.durationMinutes,
        successMetric: row.successMetric,
        painLevel: row.painLevel,
        urgency: row.urgency,
        currentMaterialStage: row.currentMaterialStage,
        notes: row.notes,
        uploadedFilename: row.uploadedFilename,
        uploadedPath: row.uploadedPath,
        scoreOverall: row.scoreOverall,
        scores: row.scores,
        summary: row.summary,
        headline: row.headline,
        findings: row.findings,
        recommendations: row.recommendations,
        commercialHook: row.commercialHook,
        mainRisk: row.mainRisk,
        strength: row.strength,
      });
    }
  }

  return [...groups.values()].map((lead) => ({
    ...lead,
    diagnostics: (lead.diagnostics || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    diagnosticsCount: lead.diagnostics?.length || 0,
  })).sort((a, b) => new Date(b.crmLastContactAt || b.diagnosticCreatedAt || b.createdAt || 0) - new Date(a.crmLastContactAt || a.diagnosticCreatedAt || a.createdAt || 0));
}

async function ensureCrmSchema() {
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS crm_stage TEXT NOT NULL DEFAULT 'lead_entrou';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS crm_last_contact_at TIMESTAMP;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS crm_owner TEXT;

    CREATE TABLE IF NOT EXISTS crm_timeline (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

router.post('/api/crm/login', async (req, res) => {
  const user = String(req.body.user || req.body.username || '').trim();
  const password = String(req.body.password || '');
  const validUser = String(process.env.CRM_USER || 'admin').trim();
  const validPass = String(process.env.CRM_PASSWORD || '123456');

  if (!user || !password) {
    return res.status(400).json({ success: false, error: 'Preencha usuário e senha.' });
  }

  if (user !== validUser || password !== validPass) {
    return res.status(401).json({ success: false, error: 'Usuário ou senha inválidos.' });
  }

  req.session.crmUser = {
    user,
    loginAt: new Date().toISOString(),
    token: crypto.randomUUID(),
  };

  req.session.save((error) => {
    if (error) {
      return res.status(500).json({ success: false, error: 'Não foi possível iniciar a sessão do CRM.' });
    }
    return res.json({ success: true, user: req.session.crmUser });
  });
});

router.post('/api/crm/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('frame_crm');
    res.json({ success: true });
  });
});

router.get('/api/crm/me', (req, res) => {
  if (!req.session?.crmUser) return res.status(401).json({ success: false, error: 'Não autenticado.' });
  return res.json({ success: true, user: req.session.crmUser });
});

router.get('/crm-frame/login', (req, res) => {
  if (req.session?.crmUser) return res.redirect('/crm-frame');
  res.sendFile(path.join(publicDir, 'crm-login.html'));
});

router.get('/crm-frame', requireCrmAuth, (_req, res) => {
  res.sendFile(path.join(publicDir, 'crm-frame.html'));
});

router.use('/api/crm', requireCrmAuth);

router.get('/api/crm/overview', async (_req, res, next) => {
  try {
    await ensureCrmSchema();
    const [countsResult, recentResult] = await Promise.all([
      pool.query(`SELECT crm_stage, COUNT(*)::int AS total FROM leads GROUP BY crm_stage`),
      pool.query(`
        SELECT l.id AS lead_id, d.id AS diagnostic_id, l.full_name, l.email, l.company, l.role_title, l.whatsapp,
               l.consent, l.created_at, l.crm_stage, l.crm_last_contact_at, l.crm_owner,
               d.objective, d.audience, d.presentation_context, d.presentation_location, d.duration_minutes,
               d.success_metric, d.pain_level, d.urgency, d.current_material_stage, d.notes, d.diagnostic_json
        FROM leads l
        LEFT JOIN LATERAL (
          SELECT * FROM diagnostics d1
          WHERE d1.lead_id = l.id
          ORDER BY d1.created_at DESC
          LIMIT 1
        ) d ON true
        ORDER BY l.created_at DESC
        LIMIT 5
      `),
    ]);

    const counts = Object.fromEntries(CRM_STAGES.map((stage) => [stage, 0]));
    for (const row of countsResult.rows) counts[row.crm_stage] = row.total;

    return res.json({
      success: true,
      counts,
      stageLabels: STAGE_LABELS,
      recent: groupLeadsByEmail(recentResult.rows),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/api/crm/leads', async (req, res, next) => {
  try {
    await ensureCrmSchema();
    const search = String(req.query.search || '').trim().toLowerCase();
    const rows = await pool.query(`
      SELECT l.id AS lead_id, d.id AS diagnostic_id, l.full_name, l.email, l.company, l.role_title, l.whatsapp,
             l.consent, l.created_at, l.crm_stage, l.crm_last_contact_at, l.crm_owner,
             d.objective, d.audience, d.presentation_context, d.presentation_location, d.duration_minutes,
             d.success_metric, d.pain_level, d.urgency, d.current_material_stage, d.notes, d.diagnostic_json,
             d.uploaded_filename, d.uploaded_path, d.created_at AS diagnostic_created_at
      FROM leads l
      LEFT JOIN diagnostics d ON d.lead_id = l.id
      ORDER BY COALESCE(d.created_at, l.created_at) DESC
    `);

    const rawLeadIds = [...new Set(rows.rows.map((row) => row.lead_id).filter(Boolean))];
    let timelineMap = {};
    if (rawLeadIds.length) {
      const timelineRes = await pool.query(
        `SELECT lead_id, id, stage, note, created_at FROM crm_timeline WHERE lead_id = ANY($1::uuid[]) ORDER BY created_at DESC`,
        [rawLeadIds]
      );
      timelineMap = timelineRes.rows.reduce((acc, row) => {
        acc[row.lead_id] ??= [];
        acc[row.lead_id].push({
          id: row.id,
          stage: row.stage,
          stageLabel: STAGE_LABELS[row.stage] || row.stage,
          note: row.note,
          createdAt: row.created_at,
        });
        return acc;
      }, {});
    }

    const leads = groupLeadsByEmail(rows.rows, timelineMap).filter((lead) => {
      if (!search) return true;
      const blob = [lead.fullName, lead.email, lead.company, lead.objective, lead.audience, lead.whatsapp]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(search);
    });

    return res.json({
      success: true,
      stageLabels: STAGE_LABELS,
      leads,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/api/crm/diagnostics/:diagnosticId/download', async (req, res, next) => {
  try {
    const { diagnosticId } = req.params;
    const result = await pool.query(
      `SELECT uploaded_filename, uploaded_path FROM diagnostics WHERE id = $1 LIMIT 1`,
      [diagnosticId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, error: 'Diagnóstico não encontrado.' });
    }

    const file = result.rows[0];
    if (!file.uploaded_path || !file.uploaded_filename) {
      return res.status(404).json({ success: false, error: 'Este diagnóstico não possui arquivo enviado.' });
    }

    await fs.access(file.uploaded_path);
    return res.download(file.uploaded_path, file.uploaded_filename);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: 'Arquivo não encontrado no servidor.' });
    }
    next(error);
  }
});

router.patch('/api/crm/leads/:leadId/stage', async (req, res, next) => {
  try {
    await ensureCrmSchema();
    const { leadId } = req.params;
    const stage = String(req.body.stage || '').trim();
    const note = String(req.body.note || '').trim();
    const owner = String(req.body.owner || '').trim() || null;

    if (!CRM_STAGES.includes(stage)) {
      return res.status(400).json({ success: false, error: 'Etapa inválida.' });
    }

    const updatedLead = await pool.query(
      `UPDATE leads
       SET crm_stage = $2, crm_last_contact_at = NOW(), crm_owner = COALESCE($3, crm_owner)
       WHERE id = $1
       RETURNING id, crm_stage, crm_last_contact_at, crm_owner`,
      [leadId, stage, owner]
    );

    if (!updatedLead.rowCount) {
      return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
    }

    await pool.query(
      `INSERT INTO crm_timeline (lead_id, stage, note) VALUES ($1, $2, $3)`,
      [leadId, stage, note || null]
    );

    return res.json({
      success: true,
      lead: {
        id: updatedLead.rows[0].id,
        crmStage: updatedLead.rows[0].crm_stage,
        crmStageLabel: STAGE_LABELS[updatedLead.rows[0].crm_stage] || updatedLead.rows[0].crm_stage,
        crmLastContactAt: updatedLead.rows[0].crm_last_contact_at,
        crmOwner: updatedLead.rows[0].crm_owner,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { CRM_STAGES, STAGE_LABELS, ensureCrmSchema, stageOrder };
export default router;
