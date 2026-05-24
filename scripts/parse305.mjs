import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MD_PATH = '/Users/yuukiyamashita/Downloads/LPIC305_150questions.md';
const OUT_PATH = join(__dirname, '../src/data/lpic305.js');

const text = readFileSync(MD_PATH, 'utf-8');

function parseLPIC305(text) {
  const questions = [];
  const lines = text.split('\n');
  let currentTopic = '';
  let currentSection = '';
  let i = 0;
  let seqNum = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Main topic: ## 課題351: ...
    const topicMatch = line.match(/^## (課題\d+[：:][^\n]*)/);
    if (topicMatch) {
      currentTopic = topicMatch[1].trim();
      i++;
      continue;
    }

    // Sub-section: ### 351.1 name
    const sectionMatch = line.match(/^### (\d+\.\d+[^\n]+)/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim().replace(/（\d+問）$/, '').trim();
      i++;
      continue;
    }

    // Question header: #### [単一選択] 001 or #### [複数選択] or #### [コマ問] or #### [語句入力問題]
    const qMatch = line.match(/^#### \[(単一選択|複数選択|コマ問|語句入力問題)\]\s*(\d+)/);
    if (qMatch) {
      const qTypeRaw = qMatch[1];
      const qNum = parseInt(qMatch[2]);
      seqNum++;
      i++;

      // Collect question text and options
      const qTextLines = [];
      const optionLines = [];

      // For 305, options and text are mixed until ** 解説: or blank followed by ** or ---
      while (i < lines.length && lines[i] !== '---') {
        const l = lines[i];

        // Stop at explanation
        if (l.startsWith('**解説:**') || l.startsWith('**答:') || l.startsWith('**回答:')) break;

        // Detect option line: starts with A) or **A) (entire line bold marks correct answer)
        const optMatch = l.match(/^(\*\*)?([A-D])\)\s*(.*)/);
        if (optMatch) {
          const isBoldLine = optMatch[1] === '**';
          let text = optMatch[3].trim();
          // Strip trailing ** if line was bold-wrapped
          if (isBoldLine && text.endsWith('**')) text = text.slice(0, -2).trim();
          optionLines.push({
            letter: optMatch[2],
            raw: l.trim(),
            text,
            isBoldLine, // entire line was bold → correct answer for single-choice
          });
        } else if (l.trim() && !l.startsWith('#') && !l.startsWith('**解説')) {
          qTextLines.push(l.trim());
        }
        i++;
      }

      const questionText = qTextLines.filter(Boolean).join(' ').trim();

      // Collect explanation + answer text
      const explanationLines = [];
      let commandAnswer = null;

      while (i < lines.length && lines[i] !== '---') {
        const l = lines[i];
        // Command answer line: **答: answer**
        const ansMatch = l.match(/^\*\*答[：:]\s*(.+?)\*\*/);
        const ansMatch2 = l.match(/^\*\*回答[：:]\*\*\s*`([^`]+)`/);
        if (ansMatch) {
          commandAnswer = ansMatch[1].trim();
          // Remove Japanese reading in parens: "hypercall（ハイパーコール）" → also accept "hypercall"
          commandAnswer = commandAnswer.replace(/（[^）]+）$/, '').trim();
        } else if (ansMatch2) {
          commandAnswer = ansMatch2[1].trim();
        } else if (l.startsWith('**解説:**') || l.startsWith('**解説:')) {
          explanationLines.push(l.replace(/^\*\*解説[：:]\*?\*?\s*/, '').trim());
        } else if (l.trim()) {
          explanationLines.push(l.trim());
        }
        i++;
      }

      const explanation = explanationLines.filter(Boolean).join(' ').trim();

      let answer = null;
      let type;

      if (qTypeRaw === 'コマ問' || qTypeRaw === '語句入力問題') {
        type = 'command';
        answer = commandAnswer || '';
      } else if (qTypeRaw === '単一選択') {
        type = 'single';
        // Correct option = the one whose line is entirely bold-wrapped
        let correctIdx = optionLines.findIndex(o => o.isBoldLine);
        if (correctIdx === -1) {
          // Explanation fallback
          const fallback = explanation.match(/正解は([A-D])|正解：?([A-D])|^([A-D])が正解|([A-D])が正解です/);
          if (fallback) {
            const letter = fallback[1] || fallback[2] || fallback[3] || fallback[4];
            correctIdx = 'ABCD'.indexOf(letter);
          }
        }
        answer = correctIdx >= 0 ? correctIdx : 0;
      } else {
        // 複数選択 - correct options have **...** wrapping just the text portion
        type = 'multi';
        const correctIndices = [];
        for (let k = 0; k < optionLines.length; k++) {
          const o = optionLines[k];
          // Pattern: A) **text** OR **A) text**
          if (o.isBoldLine || /^\*\*.+\*\*$/.test(o.text) || o.text.startsWith('**')) {
            correctIndices.push(k);
          }
        }
        if (correctIndices.length === 0) {
          // Fallback from explanation: detect letters like "AとBが正解", "A、Bが正解"
          const expl = explanation;
          const m = expl.match(/([A-D])(?:と|、|,|・)([A-D])(?:[とと、,・]([A-D]))?(?:[とと、,・]([A-D]))?(?:が|は)/);
          if (m) {
            for (let j = 1; j < m.length; j++) {
              if (m[j]) correctIndices.push('ABCD'.indexOf(m[j]));
            }
          }
        }
        answer = correctIndices.length > 0 ? [...new Set(correctIndices)].sort((a,b)=>a-b) : [0, 1];
      }

      // Clean option texts (remove leftover ** markers)
      const cleanOptions = optionLines.map(o =>
        o.text.replace(/^\*\*/, '').replace(/\*\*$/, '').trim()
      );

      const category = currentSection || currentTopic;

      questions.push({
        id: `Q${String(seqNum).padStart(3, '0')}`,
        type,
        question: questionText,
        options: type === 'command' ? [] : cleanOptions,
        answer: answer ?? (type === 'command' ? '' : 0),
        explanation,
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

const questions = parseLPIC305(text);
const categories = buildCategories(questions);

console.log(`LPIC-305: ${questions.length} questions parsed`);
console.log('Topics:', categories.map(c => `${c.name} (${c.count})`).join(', '));

const output = `// Auto-generated by scripts/parse305.mjs
export const EXAM_NAME = 'LPIC-305';
export const EXAM_VERSION = 'Linux Professional 3: Virtualization & Containerization';
export const EXAM_COLOR = 'violet';

export const CATEGORIES = ${JSON.stringify(categories, null, 2)};

export const questions = ${JSON.stringify(questions, null, 2)};
`;

writeFileSync(OUT_PATH, output, 'utf-8');
console.log(`Written to ${OUT_PATH}`);
