import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { pool } from '../db.js';
import { extractTextFromUpload } from '../services/extract-text.service.js';
import { generateFrameDiagnostic } from '../services/frame-ai.service.js';

const router = express.Router();

const uploadDir = path.resolve('uploads');
await fs.mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 80) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.pptx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      cb(new Error('Envie apenas PDF ou PPTX.'));
      return;
    }
    cb(null, true);
  }
});

router.post('/', upload.single('presentationFile'), async (req, res, next) => {
  try {
    const leadInput = {
      fullName: req.body.fullName?.trim(),
      email: req.body.email?.trim(),
      company: req.body.company?.trim(),
      roleTitle: req.body.roleTitle?.trim(),
      whatsapp: req.body.whatsapp?.trim(),
      currentSituation: req.body.currentSituation?.trim(),
      objective: req.body.objective?.trim(),
      audience: req.body.audience?.trim(),
      presentationContext: req.body.presentationContext?.trim(),
      presentationLocation: req.body.presentationLocation?.trim(),
      durationMinutes: Number(req.body.durationMinutes || 0) || null,
      successMetric: req.body.successMetric?.trim(),
      painLevel: req.body.painLevel?.trim(),
      urgency: req.body.urgency?.trim(),
      currentMaterialStage: req.body.currentMaterialStage?.trim(),
      notes: req.body.notes?.trim(),
      consent: String(req.body.consent) === 'true'
    };

    if (!leadInput.fullName || !leadInput.email || !leadInput.objective || !leadInput.audience) {
      return res.status(400).json({ success: false, error: 'Preencha nome, e-mail, objetivo e público.' });
    }

    const extractedText = await extractTextFromUpload(req.file);
    const diagnostic = await generateFrameDiagnostic({
      ...leadInput,
      extractedText
    });

    let diagnosticId = null;
    let persistenceWarning = null;

    try {
      const leadInsert = await pool.query(
        `INSERT INTO leads (full_name, email, company, role_title, whatsapp, consent)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [leadInput.fullName, leadInput.email, leadInput.company || null, leadInput.roleTitle || null, leadInput.whatsapp || null, leadInput.consent]
      );

      const diagnosticInsert = await pool.query(
        `INSERT INTO diagnostics (
          lead_id, current_situation, objective, audience, presentation_context, presentation_location,
          duration_minutes, success_metric, pain_level, urgency, current_material_stage, notes,
          uploaded_filename, uploaded_path, extracted_text, diagnostic_json
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16
        ) RETURNING id`,
        [
          leadInsert.rows[0].id,
          leadInput.currentSituation || null,
          leadInput.objective,
          leadInput.audience,
          leadInput.presentationContext || null,
          leadInput.presentationLocation || null,
          leadInput.durationMinutes,
          leadInput.successMetric || null,
          leadInput.painLevel || null,
          leadInput.urgency || null,
          leadInput.currentMaterialStage || null,
          leadInput.notes || null,
          req.file?.originalname || null,
          req.file?.path || null,
          extractedText || null,
          diagnostic
        ]
      );

      diagnosticId = diagnosticInsert.rows[0].id;
    } catch (dbError) {
      console.warn('Diagnóstico gerado, mas não foi possível salvar no banco:', dbError.message);
      persistenceWarning = 'Diagnóstico gerado, mas o banco não está conectado para salvar o histórico.';
    }

    res.json({
      success: true,
      diagnosticId,
      diagnostic,
      warning: persistenceWarning
    });
  } catch (error) {
    next(error);
  }
});

export default router;
