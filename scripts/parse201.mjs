import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MD_PATH = '/Users/yuukiyamashita/Downloads/LPIC201_問題集_150問.md';
const OUT_PATH = join(__dirname, '../src/data/lpic201.js');

const text = readFileSync(MD_PATH, 'utf-8');

function extractAnswerLetters(boldLine) {
  const content = boldLine.replace(/^\*\*|\*\*$/g, '').trim();
  // Pattern: just letters "A、B、C" or "A, B, C" or "A と B"
  if (/^[A-E]([、,\s]+[A-E])*$/.test(content)) {
    return [...content.matchAll(/[A-E]/g)].map(m => m[0]);
  }
  if (/^[A-E]\s+と\s+[A-E]$/.test(content)) {
    return [...content.matchAll(/[A-E]/g)].map(m => m[0]);
  }
  // Pattern: letters followed by periods or 、
  const withDot = [...content.matchAll(/\b([A-E])[.）]/g)].map(m => m[1]);
  if (withDot.length > 0) return [...new Set(withDot)];
  // Single letter: "B. ..."
  const single = content.match(/^([A-E])[. ]/);
  if (single) return [single[1]];
  return [];
}

function parseLPIC201(text) {
  const questions = [];
  const lines = text.split('\n');
  let currentTopic = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Topic header
    const topicMatch = line.match(/^## (Topic \d+[^(\n]*)/);
    if (topicMatch) {
      currentTopic = topicMatch[1].trim().replace(/\s*\(\d+問\)$/, '');
      i++;
      continue;
    }

    // Question header
    const qMatch = line.match(/^### Q(\d+)【(多肢選択|コマ問)】/);
    if (qMatch) {
      const qNum = parseInt(qMatch[1]);
      const qTypeRaw = qMatch[2];
      i++;

      // Collect question text and options
      const qTextLines = [];
      const optionLines = [];

      while (i < lines.length && !lines[i].startsWith('<details>') && lines[i] !== '---') {
        const l = lines[i];
        const optMatch = l.match(/^([A-E])\. (.+)/);
        if (optMatch) {
          optionLines.push(l.trim());
        } else if (l.trim() && !l.startsWith('#')) {
          qTextLines.push(l.trim());
        }
        i++;
      }

      const questionText = qTextLines.filter(Boolean).join(' ');
      const options = optionLines.map(l => l.replace(/^[A-E]\. /, '').trim());

      // Parse <details> block
      const detailLines = [];
      if (i < lines.length && lines[i].startsWith('<details>')) {
        i++; // skip <details><summary>解答</summary>
        while (i < lines.length && lines[i] !== '</details>') {
          detailLines.push(lines[i]);
          i++;
        }
        i++; // skip </details>
      }
      const detailsText = detailLines.join('\n');

      let answer = null;
      let explanation = '';

      if (qTypeRaw === 'コマ問') {
        // Extract from code block
        const codeMatch = detailsText.match(/```(?:\w*\n)?([\s\S]*?)```/);
        if (codeMatch) {
          answer = codeMatch[1].trim();
        } else {
          // Inline: `command`
          const inlineMatch = detailsText.match(/`([^`]+)`/);
          if (inlineMatch) answer = inlineMatch[1].trim();
        }
        explanation = detailsText
          .replace(/```[\s\S]*?```/g, '')
          .replace(/^\s*\n/, '')
          .trim();
      } else {
        // Find the bold answer line (first line starting with **)
        const boldMatch = detailsText.match(/^\*\*[^*]+\*\*$/m);
        let letters = [];
        if (boldMatch) {
          letters = extractAnswerLetters(boldMatch[0]);
        }
        if (letters.length === 0) {
          // Fallback: find first **X.** pattern anywhere
          const fallback = detailsText.match(/\*\*([A-E])\./);
          if (fallback) letters = [fallback[1]];
        }
        const indices = letters.map(l => 'ABCDE'.indexOf(l));
        answer = indices.length === 1 ? indices[0] : indices.length > 1 ? indices : 0;

        // Explanation: everything after first bold line
        const firstBoldEnd = detailsText.indexOf('**', detailsText.indexOf('**') + 2) + 2;
        explanation = detailsText.substring(firstBoldEnd).trim();
      }

      const type = qTypeRaw === 'コマ問' ? 'command'
        : Array.isArray(answer) ? 'multi' : 'single';

      questions.push({
        id: `Q${String(qNum).padStart(3, '0')}`,
        type,
        question: questionText,
        options: type === 'command' ? [] : options,
        answer: answer ?? (type === 'command' ? '' : 0),
        explanation: explanation.replace(/\n{3,}/g, '\n\n').trim(),
        topic: currentTopic,
        category: currentTopic,
      });
      continue;
    }
    i++;
  }
  return questions;
}

// Build CATEGORIES from parsed questions
function buildCategories(questions) {
  const topicMap = new Map();
  for (const q of questions) {
    if (!topicMap.has(q.topic)) topicMap.set(q.topic, 0);
    topicMap.set(q.topic, topicMap.get(q.topic) + 1);
  }
  return [...topicMap.entries()].map(([name, count]) => ({ name, count }));
}

const questions = parseLPIC201(text);
const categories = buildCategories(questions);

console.log(`LPIC-201: ${questions.length} questions parsed`);
console.log('Topics:', categories.map(c => `${c.name} (${c.count})`).join(', '));

const output = `// Auto-generated by scripts/parse201.mjs
export const EXAM_NAME = 'LPIC-201';
export const EXAM_VERSION = 'Linux Engineer 201-450 v4.5';
export const EXAM_COLOR = 'azure';

export const CATEGORIES = ${JSON.stringify(categories, null, 2)};

export const questions = ${JSON.stringify(questions, null, 2)};
`;

writeFileSync(OUT_PATH, output, 'utf-8');
console.log(`Written to ${OUT_PATH}`);
