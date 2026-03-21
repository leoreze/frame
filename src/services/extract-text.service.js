import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import unzipper from 'unzipper';
import { parseStringPromise } from 'xml2js';

function normalizeWhitespace(text = '') {
  return text.replace(/\s+/g, ' ').replace(/[\u0000-\u001F]+/g, ' ').trim();
}

async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  return normalizeWhitespace(parsed.text).slice(0, 12000);
}

async function extractPptxText(filePath) {
  const directory = await unzipper.Open.file(filePath);
  const slideFiles = directory.files.filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file.path));
  const texts = [];

  for (const slideFile of slideFiles) {
    const xml = await slideFile.buffer();
    const json = await parseStringPromise(xml.toString('utf8'));
    const slideTexts = [];

    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === 'a:t' && Array.isArray(value)) {
          slideTexts.push(...value);
        } else {
          walk(value);
        }
      }
    };

    walk(json);
    if (slideTexts.length) {
      texts.push(slideTexts.join(' '));
    }
  }

  return normalizeWhitespace(texts.join(' ')).slice(0, 12000);
}

export async function extractTextFromUpload(file) {
  if (!file) return '';

  const ext = path.extname(file.originalname || file.filename).toLowerCase();

  try {
    if (ext === '.pdf') return await extractPdfText(file.path);
    if (ext === '.pptx') return await extractPptxText(file.path);
  } catch (error) {
    console.warn('Falha ao extrair texto do upload:', error.message);
  }

  return '';
}
