import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import diagnosticRouter from './routes/diagnostic.routes.js';
import crmRouter, { crmSessionMiddleware } from './routes/crm.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
const uploadsDir = path.resolve(__dirname, '../uploads');
const port = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.set('trust proxy', 1);
const pages = {
  '/': 'index.html',
  '/diagnostico': 'diagnostico.html',
  '/lead': 'lead.html',
  '/servicos': 'servicos.html',
  '/metodo-frame': 'metodo-frame.html',
  '/pacotes': 'pacotes.html',
  '/cases': 'cases.html',
  '/depoimentos': 'depoimentos.html',
  '/faq': 'faq.html',
  '/contato': 'contato.html',
  '/conteudos': 'conteudos.html',
  '/portfolio': 'portfolio.html',
  '/pitch-deck': 'pitch-deck.html',
  '/apresentacao-comercial': 'apresentacao-comercial.html',
  '/apresentacao-institucional': 'apresentacao-institucional.html',
  '/board-executivo': 'board-executivo.html',
  '/palestras-keynotes': 'palestras-keynotes.html',
  '/treinamentos-corporativos': 'treinamentos-corporativos.html',
  '/antes-e-depois': 'antes-e-depois.html',
  '/dicas-pitch-deck-vendas': 'dicas-pitch-deck-vendas.html',
  '/erros-slides-corporativos': 'erros-slides-corporativos.html',
  '/storytelling-lideres-times': 'storytelling-lideres-times.html',
  '/conteudo-linkedin-youtube': 'conteudo-linkedin-youtube.html',
};

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(crmSessionMiddleware);
app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  });
});

Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(publicDir, file));
  });
});

app.use('/api/diagnostics', diagnosticRouter);
app.use(crmRouter);

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  return res.status(404).sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const message = err?.message || 'Erro interno no servidor.';
  res.status(500).json({
    success: false,
    error: isProd ? 'Erro interno no servidor.' : message,
  });
});

app.listen(port, () => {
  console.log(`FRAME rodando em http://localhost:${port}`);
});
