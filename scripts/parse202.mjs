import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MD_PATH = '/Users/yuukiyamashita/Downloads/lpic202_quiz.md';
const OUT_PATH = join(__dirname, '../src/data/lpic202.js');

const text = readFileSync(MD_PATH, 'utf-8');

function parseLPIC202(text) {
  const questions = [];
  const lines = text.split('\n');
  let currentTopic = '';
  let currentSection = '';
  let i = 0;
  let globalQNum = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Main topic header: ## 主題207：...
    const topicMatch = line.match(/^## (主題\d+[：:][^\n]*)/);
    if (topicMatch) {
      currentTopic = topicMatch[1].trim();
      i++;
      continue;
    }

    // Sub-section: ### 207.1 name
    const sectionMatch = line.match(/^### (\d+\.\d+\s+[^\n]+)/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim().replace(/（\d+問）$/, '').trim();
      i++;
      continue;
    }

    // Question header: **Q1.** or **Q1.** (コマ問)
    const qMatch = line.match(/^\*\*Q(\d+)\.\*\*\s*(.*)/);
    if (qMatch) {
      const qNum = parseInt(qMatch[1]);
      globalQNum++;
      let firstLine = qMatch[2].trim();
      i++;

      // Check if command question from first line
      const isCommand = firstLine.includes('（コマ問）') || firstLine.includes('(コマ問)');
      firstLine = firstLine.replace(/（コマ問）|\(コマ問\)/g, '').trim();

      // Collect remaining question text
      const qTextLines = [firstLine];
      const optionLines = [];

      while (i < lines.length && !lines[i].startsWith('<details>') && lines[i] !== '---') {
        const l = lines[i];
        const optMatch = l.match(/^-\s+([A-E])[.)\s]\s*(.*)/);
        if (optMatch) {
          optionLines.push({ letter: optMatch[1], text: optMatch[2].trim() });
        } else if (l.trim() && !l.startsWith('#') && !l.startsWith('**Q')) {
          qTextLines.push(l.trim());
        }
        i++;
      }

      const questionText = qTextLines.filter(Boolean).join(' ').trim();
      const optionTexts = optionLines.map(o => o.text);

      // Parse <details> block
      const detailLines = [];
      if (i < lines.length && lines[i].startsWith('<details>')) {
        i++;
        while (i < lines.length && lines[i] !== '</details>') {
          detailLines.push(lines[i]);
          i++;
        }
        i++;
      }
      const detailsText = detailLines.join('\n');

      // Determine if command question from question text
      const isCommandQ = isCommand ||
        questionText.includes('コマ問') ||
        questionText.includes('コマンドを答えよ') ||
        (optionLines.length === 0 && !isCommand && detailsText.includes('正解：`'));

      let answer = null;
      let explanation = '';

      if (isCommandQ) {
        // **正解：`command`** or **正解：answer**
        const cmdMatch = detailsText.match(/\*\*正解[：:][`「]?([^`」\n*]+)[`」]?\*\*/);
        if (cmdMatch) {
          answer = cmdMatch[1].trim();
        } else {
          const boldMatch = detailsText.match(/\*\*正解[：:]([^*\n]+)\*\*/);
          if (boldMatch) answer = boldMatch[1].trim();
        }
        explanation = detailsText.replace(/\*\*正解[：:][^*]+\*\*\n?/, '').trim();
      } else {
        // **正解：A** or **正解：A, B, C** or **正解：A, B**
        const answerMatch = detailsText.match(/\*\*正解[：:]([A-E](?:[,、\s]+[A-E])*)\*\*/);
        if (answerMatch) {
          const letters = [...answerMatch[1].matchAll(/[A-E]/g)].map(m => m[0]);
          const indices = letters.map(l => 'ABCDE'.indexOf(l));
          answer = indices.length === 1 ? indices[0] : indices;
        } else {
          answer = 0;
        }
        explanation = detailsText.replace(/\*\*正解[：:][^*]+\*\*\n?/, '').trim();
      }

      // Check if multiple choice based on question text patterns
      const isMultiHint = questionText.includes('2つ選べ') ||
        questionText.includes('3つ選べ') ||
        questionText.includes('複数選択') ||
        questionText.includes('複数選べ') ||
        (Array.isArray(answer) && answer.length > 1);

      const type = isCommandQ ? 'command'
        : (Array.isArray(answer) && answer.length > 1) ? 'multi' : 'single';

      const category = currentSection || currentTopic;

      questions.push({
        id: `Q${String(qNum).padStart(3, '0')}`,
        type,
        question: questionText,
        options: type === 'command' ? [] : optionTexts,
        answer: answer ?? (type === 'command' ? '' : 0),
        explanation: explanation.replace(/\n{3,}/g, '\n\n').trim(),
        topic: currentTopic,
        category,
      });
      continue;
    }

    i++;
  }
  return questions;
}

function buildCategories(questions) {
  const topicMap = new Map();
  for (const q of questions) {
    if (!topicMap.has(q.topic)) topicMap.set(q.topic, 0);
    topicMap.set(q.topic, topicMap.get(q.topic) + 1);
  }
  return [...topicMap.entries()].map(([name, count]) => ({ name, count }));
}

const questions = parseLPIC202(text);
const categories = buildCategories(questions);

console.log(`LPIC-202: ${questions.length} questions parsed`);
console.log('Topics:', categories.map(c => `${c.name} (${c.count})`).join(', '));

const output = `// Auto-generated by scripts/parse202.mjs
export const EXAM_NAME = 'LPIC-202';
export const EXAM_VERSION = 'Linux Engineer 202-450 v4.5';
export const EXAM_COLOR = 'green';

export const CATEGORIES = ${JSON.stringify(categories, null, 2)};

export const questions = ${JSON.stringify(questions, null, 2)};
`;

writeFileSync(OUT_PATH, output, 'utf-8');
console.log(`Written to ${OUT_PATH}`);
