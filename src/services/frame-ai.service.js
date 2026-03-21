import OpenAI from 'openai';

const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
const client = hasOpenAiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function inferScores(input) {
  let foco = 66;
  let roteiro = 64;
  let arquitetura = 61;
  let mensagem = 65;
  let estetica = 68;

  if (input.objective?.toLowerCase().includes('vender')) mensagem += 4;
  if (input.audience?.toLowerCase().includes('invest')) roteiro -= 3;
  if (!input.presentationContext) foco -= 4;
  if (!input.successMetric) foco -= 5;
  if (!input.extractedText) arquitetura -= 6;
  if (input.extractedText && input.extractedText.length > 500) roteiro += 3;
  if (String(input.currentMaterialStage || '').toLowerCase().includes('rascunho')) arquitetura -= 4;
  if (String(input.urgency || '').toLowerCase().includes('amanh')) mensagem -= 2;

  foco = clampScore(foco);
  roteiro = clampScore(roteiro);
  arquitetura = clampScore(arquitetura);
  mensagem = clampScore(mensagem);
  estetica = clampScore(estetica);
  const overall = clampScore((foco + roteiro + arquitetura + mensagem + estetica) / 5);

  return { overall, foco, roteiro, arquitetura, mensagem, estetica };
}

function buildFallbackDiagnostic(input) {
  const scores = inferScores(input);
  return {
    headline: 'Sua apresentação tem potencial, mas ainda pode estar perdendo força na decisão.',
    summary: 'Geramos um diagnóstico inicial usando o briefing enviado. Mesmo sem leitura avançada ou IA conectada, já é possível identificar sinais de desalinhamento entre objetivo, narrativa e estrutura. O maior ganho tende a vir da clareza do raciocínio e da condução da decisão.',
    score_overall: scores.overall,
    scores: {
      foco: scores.foco,
      roteiro: scores.roteiro,
      arquitetura: scores.arquitetura,
      mensagem: scores.mensagem,
      estetica: scores.estetica,
    },
    main_risk: 'A apresentação pode até parecer visualmente aceitável, mas ainda não deixar totalmente claro o que o público deve entender, sentir e decidir ao final.',
    strength: 'Você já tem contexto, objetivo e intenção definidos, o que acelera muito uma evolução estratégica do material.',
    findings: [
      'Há espaço para deixar a mensagem principal mais explícita logo no início.',
      'A narrativa pode conduzir melhor o público até a decisão esperada.',
      'A estrutura dos slides provavelmente ganha força com maior hierarquia visual e síntese.'
    ],
    recommendations: [
      'Definir uma tese central em uma frase antes de revisar os slides.',
      'Reorganizar a ordem do conteúdo para criar progressão lógica.',
      'Reduzir excesso de texto e reforçar leitura escaneável.',
      'Adaptar linguagem e profundidade ao público decisor.'
    ],
    commercial_hook: 'Com uma revisão orientada pelo método FRAME, esse material pode evoluir rapidamente de “informativo” para “convincente”.',
    cta: 'Fale com a FRAME para transformar esse diagnóstico em uma apresentação com mais impacto.'
  };
}

function buildPrompt(input) {
  return `
Você é um consultor sênior de apresentações corporativas da FRAME.

Sua missão é gerar um diagnóstico inicial gratuito, claro, convincente e útil, baseado no método FRAME.

Método FRAME:
F = Foco
R = Roteiro
A = Arquitetura
M = Mensagem
E = Estética

Contexto do lead:
- Nome: ${input.fullName}
- Empresa: ${input.company || 'Não informado'}
- Cargo: ${input.roleTitle || 'Não informado'}
- Situação atual: ${input.currentSituation || 'Não informado'}
- Objetivo da apresentação: ${input.objective}
- Público: ${input.audience}
- Contexto: ${input.presentationContext || 'Não informado'}
- Local/Formato: ${input.presentationLocation || 'Não informado'}
- Duração estimada: ${input.durationMinutes || 'Não informado'} minutos
- Métrica de sucesso: ${input.successMetric || 'Não informado'}
- Nível de dor percebida: ${input.painLevel || 'Não informado'}
- Urgência: ${input.urgency || 'Não informado'}
- Estágio do material atual: ${input.currentMaterialStage || 'Não informado'}
- Observações extras: ${input.notes || 'Não informado'}

Texto extraído do arquivo enviado:
${input.extractedText ? input.extractedText.slice(0, 10000) : 'Nenhum texto extraído. Baseie-se apenas no briefing.'}

Retorne SOMENTE JSON válido no seguinte formato:
{
  "headline": "frase curta e forte",
  "summary": "resumo em 2 a 4 frases",
  "score_overall": 0,
  "scores": {
    "foco": 0,
    "roteiro": 0,
    "arquitetura": 0,
    "mensagem": 0,
    "estetica": 0
  },
  "main_risk": "principal risco atual",
  "strength": "principal ponto positivo",
  "findings": ["achado 1", "achado 2", "achado 3"],
  "recommendations": ["recomendacao 1", "recomendacao 2", "recomendacao 3", "recomendacao 4"],
  "commercial_hook": "texto curto mostrando que existe oportunidade de melhoria",
  "cta": "convite para falar com a FRAME"
}

Regras:
- Seja específico.
- Linguagem executiva, humana e direta.
- Nunca invente detalhes concretos não fornecidos; quando faltar dado, faça inferência prudente.
- Score 0-100.
- O diagnóstico deve ajudar o lead a perceber valor e querer avançar.
`;
}

export async function generateFrameDiagnostic(input) {
  if (!client) return buildFallbackDiagnostic(input);

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    input: buildPrompt(input),
    text: {
      format: {
        type: 'json_schema',
        name: 'frame_diagnostic',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            headline: { type: 'string' },
            summary: { type: 'string' },
            score_overall: { type: 'number' },
            scores: {
              type: 'object',
              additionalProperties: false,
              properties: {
                foco: { type: 'number' },
                roteiro: { type: 'number' },
                arquitetura: { type: 'number' },
                mensagem: { type: 'number' },
                estetica: { type: 'number' }
              },
              required: ['foco', 'roteiro', 'arquitetura', 'mensagem', 'estetica']
            },
            main_risk: { type: 'string' },
            strength: { type: 'string' },
            findings: {
              type: 'array',
              items: { type: 'string' },
              minItems: 3,
              maxItems: 5
            },
            recommendations: {
              type: 'array',
              items: { type: 'string' },
              minItems: 4,
              maxItems: 6
            },
            commercial_hook: { type: 'string' },
            cta: { type: 'string' }
          },
          required: ['headline', 'summary', 'score_overall', 'scores', 'main_risk', 'strength', 'findings', 'recommendations', 'commercial_hook', 'cta']
        }
      }
    }
  });

  return JSON.parse(response.output_text);
}
