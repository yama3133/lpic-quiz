import React, { useState, useRef, useEffect } from 'react';
import * as exam201 from './data/lpic201.js';
import * as exam202 from './data/lpic202.js';
import * as exam305 from './data/lpic305.js';

// ── Exam registry ──────────────────────────────────────────────────────────
const EXAMS = {
  lpic201: { ...exam201, id: 'lpic201', color: 'azure', accent: '#0078d4', accentDeep: '#003c71',
             label: 'LPIC-201', subtitle: 'Linux Engineer 201-450 v4.5',
             description: 'Linuxカーネル / ストレージ / ファイルシステム / ネットワーク構成' },
  lpic202: { ...exam202, id: 'lpic202', color: 'green', accent: '#16a34a', accentDeep: '#14532d',
             label: 'LPIC-202', subtitle: 'Linux Engineer 202-450 v4.5',
             description: 'DNS / HTTP / メール / ファイル共有 / セキュリティ' },
  lpic305: { ...exam305, id: 'lpic305', color: 'violet', accent: '#7c3aed', accentDeep: '#4c1d95',
             label: 'LPIC-305', subtitle: 'Linux Professional 3 · v3.0',
             description: '仮想化 / コンテナ (KVM, Xen, Docker, LXC)' },
};
const EXAM_LIST = ['lpic201', 'lpic202', 'lpic305'].map(id => EXAMS[id]);

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const EXAM_TOTAL = 60;

// ── Helpers ────────────────────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Options that reference other options by letter (e.g. "AとBが正しい", "AまたはB",
// "上記の全て") become nonsensical after shuffling. Detect these and skip shuffle.
const CROSS_REF_PATTERNS = [
  /[A-E]\s*(?:と|または|もしくは|および|及び|や)\s*[A-E]/,
  /上記(?:の)?(?:全て|すべて|全部)/,
  /(?:すべて|全て)が?(?:正しい|有効|該当)/,
  /どちらも(?:可能|正しい|有効|該当)?|どれも.*?正しい|どちらでもない|どれでもない/,
];
function hasCrossReferenceOptions(options) {
  if (!options || options.length === 0) return false;
  return options.some((opt) => CROSS_REF_PATTERNS.some((re) => re.test(opt)));
}

function shuffleQuestion(q) {
  if (q.type === 'command' || !q.options || q.options.length === 0) return q;
  if (hasCrossReferenceOptions(q.options)) return q; // keep original order
  const isMulti = q.type === 'multi';
  const correctSet = new Set(isMulti ? q.answer : [q.answer]);
  const indexed = q.options.map((opt, i) => ({ opt, isCorrect: correctSet.has(i) }));
  const shuffled = shuffleArray(indexed);
  const newAnswers = shuffled.map((x, i) => x.isCorrect ? i : -1).filter(i => i !== -1);
  return {
    ...q,
    options: shuffled.map(x => x.opt),
    answer: isMulti ? newAnswers : newAnswers[0],
  };
}

function checkCommand(input, answer) {
  if (!input || answer == null) return false;
  const normalize = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[`"']/g, '');
  const u = normalize(input);
  // Accept answer string or alternatives separated by newlines / "または"
  const candidates = String(answer)
    .split(/\n|または/)
    .map((s) => normalize(s))
    .filter(Boolean);
  return candidates.some((c) => c === u);
}

function modeLabel(mode) {
  if (!mode) return '';
  switch (mode.mode) {
    case 'ordered':  return '全問 順番通り';
    case 'random':   return '全問 ランダム';
    case 'category': return `カテゴリー · ${mode.category}`;
    case 'exam':     return `本番形式 ${EXAM_TOTAL}問`;
    default: return '';
  }
}

function colorVars(exam) {
  if (!exam) return {};
  const map = {
    azure:  { c: '#0078d4', d: '#003c71', rgb: '0, 120, 212' },
    green:  { c: '#16a34a', d: '#14532d', rgb: '22, 163, 74' },
    violet: { c: '#7c3aed', d: '#4c1d95', rgb: '124, 58, 237' },
  };
  return map[exam.color] || map.azure;
}

function btnPrimaryClass(exam) {
  if (!exam) return 'btn-primary';
  if (exam.color === 'green')  return 'btn-primary-green';
  if (exam.color === 'violet') return 'btn-primary-violet';
  return 'btn-primary';
}

function modePrimaryClass(exam) {
  if (!exam) return 'mode-btn-primary';
  if (exam.color === 'green')  return 'mode-btn-primary-green';
  if (exam.color === 'violet') return 'mode-btn-primary-violet';
  return 'mode-btn-primary';
}

// ── Main App ──────────────────────────────────────────────────────────────
const App = () => {
  const [examId, setExamId] = useState(null);
  const [stage, setStage] = useState('select_exam');
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [commandInput, setCommandInput] = useState('');
  const [commandResult, setCommandResult] = useState(null);
  const [quizMode, setQuizMode] = useState(null);

  const exam = examId ? EXAMS[examId] : null;

  const startQuiz = (mode, options = {}) => {
    try {
      const src = EXAMS[examId].questions;
      let qList;
      if (mode === 'ordered')        qList = [...src];
      else if (mode === 'random')    qList = shuffleArray(src);
      else if (mode === 'category')  qList = shuffleArray(src.filter(q => q.category === options.category));
      else if (mode === 'exam')      qList = shuffleArray(src).slice(0, Math.min(EXAM_TOTAL, src.length));
      else                           qList = [...src];
      qList = qList.map(shuffleQuestion);
      setQuestions(qList);
      setCurrentQuestion(0);
      setScore(0);
      setShowResult(false);
      setIsQuizFinished(false);
      setSelectedAnswers([]);
      setCommandInput('');
      setCommandResult(null);
      setQuizMode({ mode, ...options });
      setStage('quiz');
    } catch (e) {
      console.error(e);
      alert('クイズの開始中にエラーが発生しました。');
    }
  };

  const handleChoice = (index) => {
    if (showResult || selectedAnswers.includes(index)) return;
    const q = questions[currentQuestion];
    if (!q) return;
    const isMulti = q.type === 'multi';
    const requiredCount = isMulti ? q.answer.length : 1;
    const newSel = [...selectedAnswers, index];
    setSelectedAnswers(newSel);
    if (newSel.length === requiredCount) {
      setShowResult(true);
      const isCorrect = isMulti
        ? q.answer.every(a => newSel.includes(a))
        : index === q.answer;
      if (isCorrect) setScore(s => s + 1);
    }
  };

  const handleCommandSubmit = () => {
    if (showResult || commandResult !== null) return;
    const q = questions[currentQuestion];
    if (!q) return;
    const correct = checkCommand(commandInput, q.answer);
    setCommandResult(correct);
    setShowResult(true);
    if (correct) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    const next = currentQuestion + 1;
    if (next < questions.length) {
      setCurrentQuestion(next);
      setShowResult(false);
      setSelectedAnswers([]);
      setCommandInput('');
      setCommandResult(null);
    } else {
      setIsQuizFinished(true);
    }
  };

  const goToExamTitle = () => {
    setStage('title');
    setQuestions([]);
    setCurrentQuestion(0);
    setScore(0);
    setShowResult(false);
    setIsQuizFinished(false);
    setSelectedAnswers([]);
    setCommandInput('');
    setCommandResult(null);
    setQuizMode(null);
  };

  const resetToExamSelect = () => {
    setExamId(null);
    setStage('select_exam');
    goToExamTitle();
    setStage('select_exam');
  };

  if (stage === 'select_exam') {
    return <ExamSelectScreen onSelect={(id) => { setExamId(id); setStage('title'); }} />;
  }
  if (stage === 'title') {
    return (
      <TitleScreen
        exam={exam}
        onSelectMode={(m) => m === 'category' ? setStage('category') : startQuiz(m)}
        onBackToExamSelect={resetToExamSelect}
      />
    );
  }
  if (stage === 'category') {
    return (
      <CategoryScreen
        exam={exam}
        onPick={(cat) => startQuiz('category', { category: cat })}
        onBack={goToExamTitle}
      />
    );
  }
  if (isQuizFinished) {
    return <ResultScreen score={score} total={questions.length} onBack={goToExamTitle} onHome={resetToExamSelect} mode={quizMode} exam={exam} />;
  }

  const q = questions[currentQuestion];
  if (!q) return null;

  return (
    <QuizScreen
      question={q}
      currentIndex={currentQuestion}
      total={questions.length}
      score={score}
      selectedAnswers={selectedAnswers}
      showResult={showResult}
      commandInput={commandInput}
      commandResult={commandResult}
      onChoice={handleChoice}
      onCommandChange={setCommandInput}
      onCommandSubmit={handleCommandSubmit}
      onNext={nextQuestion}
      onExit={goToExamTitle}
      mode={quizMode}
      exam={exam}
    />
  );
};

// ── Ambient background ────────────────────────────────────────────────────
function Ambient({ color }) {
  const map = {
    azure:  'radial-gradient(900px 700px at 8% 10%, rgba(0, 120, 212, 0.12) 0%, transparent 55%), radial-gradient(900px 800px at 92% 90%, rgba(14, 165, 233, 0.12) 0%, transparent 55%), radial-gradient(700px 700px at 50% 50%, rgba(124, 58, 237, 0.05) 0%, transparent 70%)',
    green:  'radial-gradient(900px 700px at 8% 10%, rgba(22, 163, 74, 0.12) 0%, transparent 55%), radial-gradient(900px 800px at 92% 90%, rgba(34, 197, 94, 0.10) 0%, transparent 55%), radial-gradient(700px 700px at 50% 50%, rgba(20, 184, 166, 0.05) 0%, transparent 70%)',
    violet: 'radial-gradient(900px 700px at 8% 10%, rgba(124, 58, 237, 0.12) 0%, transparent 55%), radial-gradient(900px 800px at 92% 90%, rgba(168, 85, 247, 0.10) 0%, transparent 55%), radial-gradient(700px 700px at 50% 50%, rgba(79, 70, 229, 0.06) 0%, transparent 70%)',
  };
  const bg = map[color] || map.azure;
  return (
    <>
      <div className="bg-ambient" style={{ background: bg }} />
      <div className="bg-grid" />
    </>
  );
}

// ── Exam selection (top-level) ────────────────────────────────────────────
function ExamSelectScreen({ onSelect }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <Ambient />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <div className="chip fade-in">
          <span className="chip-dot" />
          <span>LPIC · Linux Professional Institute</span>
        </div>

        <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#0f172a' }}>
            LPIC 模擬試験
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
            受験する試験を選択してください。各 150 問の問題集で、本番形式の練習が可能です。
          </p>
        </div>

        <div className="panel slide-up" style={{ animationDelay: '0.05s', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Stat label="EXAMS"      value="3"                color="var(--azure)" />
          <Divider />
          <Stat label="QUESTIONS"  value={String(EXAM_LIST.reduce((s, e) => s + e.questions.length, 0))} color="var(--green)" />
          <Divider />
          <Stat label="MODES"      value="4"                color="var(--violet)" />
        </div>

        <div className="panel slide-up" style={{ animationDelay: '0.1s', width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {EXAM_LIST.map((e) => <ExamCard key={e.id} exam={e} onClick={() => onSelect(e.id)} />)}
        </div>

        <div className="label fade-in-slow" style={{ marginTop: 4 }}>
          LINUX ENGINEER · LINUX PROFESSIONAL · MOCK EXAM
        </div>
      </div>
    </div>
  );
}

function ExamCard({ exam, onClick }) {
  const palette = {
    azure:  { color: '#0078d4', bg: 'rgba(0, 120, 212, 0.05)',  border: 'rgba(0, 120, 212, 0.40)',  badgeBg: 'rgba(0, 120, 212, 0.10)',  badgeBorder: 'rgba(0, 120, 212, 0.35)' },
    green:  { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.05)',  border: 'rgba(22, 163, 74, 0.40)',  badgeBg: 'rgba(22, 163, 74, 0.10)',  badgeBorder: 'rgba(22, 163, 74, 0.35)' },
    violet: { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.05)', border: 'rgba(124, 58, 237, 0.40)', badgeBg: 'rgba(124, 58, 237, 0.10)', badgeBorder: 'rgba(124, 58, 237, 0.35)' },
  };
  const p = palette[exam.color];
  const cmdCount = exam.questions.filter(q => q.type === 'command').length;

  return (
    <button
      className="exam-card"
      onClick={onClick}
      style={{ '--exam-bg': p.bg, '--exam-border': p.border }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <span className="exam-badge" style={{ background: p.badgeBg, border: `1px solid ${p.badgeBorder}`, color: p.color }}>
          {exam.label.replace('LPIC-', '')}
        </span>
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            {exam.label}
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>{exam.subtitle}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{exam.description}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span className="mode-btn-badge">{exam.questions.length}問</span>
        <span className="mode-btn-badge" style={{ background: p.badgeBg, borderColor: p.badgeBorder, color: p.color }}>コマ問 {cmdCount}</span>
        <ArrowRight />
      </div>
    </button>
  );
}

// ── Per-exam title screen ─────────────────────────────────────────────────
function TitleScreen({ exam, onSelectMode, onBackToExamSelect }) {
  const total = exam.questions.length;
  const cats = exam.CATEGORIES;
  const cmdCount = exam.questions.filter(q => q.type === 'command').length;
  const cv = colorVars(exam);
  const primaryCls = modePrimaryClass(exam);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <Ambient color={exam.color} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <button className="btn btn-ghost slide-up" onClick={onBackToExamSelect} style={{ padding: '8px 14px', fontSize: 13, alignSelf: 'flex-start' }}>
          <ChevronLeft /><span>試験選択へ</span>
        </button>

        <div className="chip fade-in" style={{
          background: `rgba(${cv.rgb}, 0.08)`,
          borderColor: `rgba(${cv.rgb}, 0.35)`,
          color: cv.d,
        }}>
          <span className="chip-dot" style={{ background: cv.c, boxShadow: `0 0 6px rgba(${cv.rgb}, 0.7)` }} />
          <span>{exam.subtitle}</span>
        </div>

        <div className="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 style={{ fontSize: 'clamp(34px, 5.5vw, 52px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#0f172a' }}>
            {exam.label} 模擬試験
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
            {exam.description}
          </p>
        </div>

        <div className="panel slide-up" style={{ animationDelay: '0.05s', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Stat label="QUESTIONS"  value={String(total)}      color={cv.c} />
          <Divider />
          <Stat label="CATEGORIES" value={String(cats.length)} color="var(--cyan)" />
          <Divider />
          <Stat label="コマ問"     value={String(cmdCount)}    color="var(--violet)" />
          <Divider />
          <Stat label="EXAM"       value={`${EXAM_TOTAL} Q`}   color="var(--warning)" />
        </div>

        <div className="panel slide-up" style={{ animationDelay: '0.1s', width: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ModeButton primary primaryCls={primaryCls} title="全問 順番通り" sub={`第1問 → 第${total}問の順で出題`} badge={`${total}問`} onClick={() => onSelectMode('ordered')} />
          <ModeButton title="全問 ランダム" sub="順番をシャッフルして出題" badge={`${total}問`} onClick={() => onSelectMode('random')} />
          <ModeButton title="カテゴリー別" sub="苦手領域を集中的に対策" badge={`${cats.length}カテゴリ`} onClick={() => onSelectMode('category')} />
          <ModeButton title={`本番形式 (${EXAM_TOTAL}問)`} sub="ランダム抽出で模試形式" badge="EXAM" highlight onClick={() => onSelectMode('exam')} />
        </div>

        <div className="label fade-in-slow" style={{ marginTop: 4 }}>
          MULTIPLE CHOICE · COMMAND INPUT · WITH EXPLANATIONS
        </div>
      </div>
    </div>
  );
}

function ModeButton({ title, sub, badge, primary, primaryCls, highlight, onClick }) {
  return (
    <button
      className={`mode-btn ${primary ? (primaryCls || 'mode-btn-primary') : ''} ${highlight ? 'mode-btn-highlight' : ''}`}
      onClick={onClick}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span className="mode-btn-title">{title}</span>
        {sub && <span className="mode-btn-sub">{sub}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {badge && <span className="mode-btn-badge">{badge}</span>}
        <ArrowRight />
      </div>
    </button>
  );
}

// ── Category screen ──────────────────────────────────────────────────────
function CategoryScreen({ exam, onPick, onBack }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <Ambient color={exam.color} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div className="chip fade-in">
          <span className="chip-dot" />
          <span>SELECT CATEGORY · {exam.label}</span>
        </div>
        <h2 className="slide-up" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', textAlign: 'center' }}>
          カテゴリーを選択
        </h2>
        <div className="panel slide-up" style={{ width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {exam.CATEGORIES.map((c) => (
            <button key={c.name} className="mode-btn" onClick={() => onPick(c.name)}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minWidth: 0 }}>
                <span className="mode-btn-title" style={{ wordBreak: 'break-word' }}>{c.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span className="mode-btn-badge">{c.count}問</span>
                <ArrowRight />
              </div>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost slide-up" onClick={onBack} style={{ padding: '12px 20px' }}>
          <ChevronLeft /><span>戻る</span>
        </button>
      </div>
    </div>
  );
}

// ── Quiz screen (multiple choice + command) ──────────────────────────────
function QuizScreen({
  question, currentIndex, total, score,
  selectedAnswers, showResult,
  commandInput, commandResult,
  onChoice, onCommandChange, onCommandSubmit,
  onNext, onExit, mode, exam,
}) {
  const progressPct = ((currentIndex + (showResult ? 1 : 0)) / total) * 100;
  const isMulti = question.type === 'multi';
  const isCommand = question.type === 'command';
  const requiredCount = isMulti ? question.answer.length : 1;
  const remaining = Math.max(0, requiredCount - selectedAnswers.length);
  const cv = colorVars(exam);
  const primaryBtnCls = btnPrimaryClass(exam);

  const inputRef = useRef(null);
  useEffect(() => {
    if (isCommand && inputRef.current && !showResult) {
      inputRef.current.focus();
    }
  }, [currentIndex, isCommand, showResult]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !showResult && commandInput.trim()) {
      e.preventDefault();
      onCommandSubmit();
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Ambient color={exam.color} />

      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        padding: '14px 24px',
        background: 'rgba(250, 251, 255, 0.85)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button className="btn btn-ghost" onClick={onExit} style={{ padding: '8px 14px', fontSize: 13 }}>
              <ChevronLeft /><span>戻る</span>
            </button>
            <div className="chip" style={{
              padding: '4px 10px', fontSize: 10,
              background: `rgba(${cv.rgb}, 0.08)`, borderColor: `rgba(${cv.rgb}, 0.35)`, color: cv.d,
            }}>
              <span className="chip-dot" style={{ width: 5, height: 5, background: cv.c, boxShadow: `0 0 6px rgba(${cv.rgb}, 0.7)` }} />
              <span>{exam.label} · {modeLabel(mode)}</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="label mono" style={{ color: 'var(--text-muted)' }}>
              {String(currentIndex + 1).padStart(3, '0')} <span style={{ color: 'var(--text-faint)' }}>/ {String(total).padStart(3, '0')}</span>
            </span>
            <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${cv.c} 0%, var(--cyan) 100%)`,
                boxShadow: `0 0 10px rgba(${cv.rgb}, 0.45)`,
                borderRadius: 999, transition: 'width 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="label">CORRECT</span>
            <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--success)' }}>
              {String(score).padStart(2, '0')}
            </span>
          </div>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, flex: 1, padding: '32px 20px 48px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <section key={`q-${currentIndex}`} className="panel panel-hl slide-up" style={{ padding: '28px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="label mono" style={{ color: cv.c }}>
                  QUESTION {String(currentIndex + 1).padStart(3, '0')}
                </span>
                {question.category && (
                  <span className="label" style={{
                    padding: '3px 8px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.30)',
                    borderRadius: 6, color: 'var(--cyan-deep)', fontSize: 10,
                  }}>
                    {question.category}
                  </span>
                )}
                {isMulti && (
                  <span className="label" style={{
                    padding: '3px 8px', background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.35)',
                    borderRadius: 6, color: 'var(--violet)', fontSize: 10,
                  }}>
                    複数選択 · {requiredCount}つ
                  </span>
                )}
                {isCommand && (
                  <span className="label" style={{
                    padding: '3px 8px', background: 'rgba(245, 158, 11, 0.10)', border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: 6, color: '#b45309', fontSize: 10,
                  }}>
                    コマ問 · 入力式
                  </span>
                )}
              </div>
              {!showResult && !isCommand && selectedAnswers.length > 0 && (
                <span className="label" style={{ color: 'var(--cyan-deep)' }}>あと {remaining} つ</span>
              )}
            </div>
            <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.85, color: 'var(--text)', letterSpacing: 0.01, whiteSpace: 'pre-wrap' }}>
              {question.question}
            </p>
          </section>

          {/* Multiple-choice options */}
          {!isCommand && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {question.options.map((opt, i) => {
                const isSelected = selectedAnswers.includes(i);
                const isCorrect = Array.isArray(question.answer) ? question.answer.includes(i) : i === question.answer;
                let cls = 'option';
                let marker = LETTERS[i];
                if (showResult) {
                  if (isCorrect)       { cls += ' option-correct'; marker = '✓'; }
                  else if (isSelected) { cls += ' option-wrong';   marker = '✕'; }
                  else                 { cls += ' option-muted option-disabled'; }
                } else if (isSelected) { cls += ' option-selected'; }
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => onChoice(i)}
                    disabled={showResult}
                    style={{ animation: `slide-up 0.4s ${0.05 * i}s cubic-bezier(0.16, 1, 0.3, 1) both` }}
                  >
                    <span className="option-marker">{marker}</span>
                    <span className="option-text">{opt}</span>
                  </button>
                );
              })}
            </section>
          )}

          {/* Command input */}
          {isCommand && (
            <section className="cmd-input-wrap slide-up">
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                placeholder="コマンドを入力 (例: ls -al)"
                className={`cmd-input ${showResult ? (commandResult ? 'correct' : 'wrong') : ''}`}
                value={commandInput}
                onChange={(e) => onCommandChange(e.target.value)}
                onKeyDown={handleKey}
                disabled={showResult}
                aria-label="コマンド入力"
              />
              {!showResult && (
                <button
                  className="cmd-submit"
                  onClick={onCommandSubmit}
                  disabled={!commandInput.trim()}
                >
                  <span>答え合わせ</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>(Enter)</span>
                </button>
              )}
              {showResult && (
                <div className="panel" style={{
                  padding: 16, display: 'flex', alignItems: 'center', gap: 12,
                  borderColor: commandResult ? 'rgba(22,163,74,0.35)' : 'rgba(220,38,38,0.35)',
                  background: commandResult ? 'rgba(22,163,74,0.04)' : 'rgba(220,38,38,0.04)',
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: commandResult ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.12)',
                    color: commandResult ? 'var(--success)' : 'var(--danger)',
                    fontWeight: 700, flexShrink: 0,
                  }}>
                    {commandResult ? '✓' : '✕'}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span className="label" style={{ color: commandResult ? 'var(--success)' : 'var(--danger)' }}>
                      {commandResult ? '正解' : '不正解'}
                    </span>
                    <span className="mono" style={{ fontSize: 13.5, color: 'var(--text)', wordBreak: 'break-all' }}>
                      正答: <strong>{question.answer}</strong>
                    </span>
                  </div>
                </div>
              )}
            </section>
          )}

          {showResult && (
            <section className="panel slide-up" style={{
              padding: 24,
              borderColor: 'rgba(22, 163, 74, 0.30)',
              boxShadow: '0 16px 40px rgba(22, 163, 74, 0.08), 0 4px 12px rgba(15, 23, 42, 0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ExplainIcon />
                <span className="label" style={{ color: 'var(--success)' }}>解説</span>
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.85, color: 'var(--text-muted)', letterSpacing: 0.01, whiteSpace: 'pre-wrap' }}>
                {question.explanation || '解説はありません。'}
              </p>
              <button
                className={`btn ${primaryBtnCls}`}
                onClick={onNext}
                style={{ marginTop: 20, width: '100%', padding: '16px 24px' }}
              >
                <span>{currentIndex + 1 === total ? '結果を見る' : '次の問題へ'}</span>
                <ArrowRight />
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Result screen ────────────────────────────────────────────────────────
function ResultScreen({ score, total, onBack, onHome, mode, exam }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = pct >= 60;
  const cv = colorVars(exam);
  const accent = passed ? 'var(--success)' : cv.c;
  const accentRGB = passed ? '34, 197, 94' : cv.rgb;
  const primaryBtnCls = btnPrimaryClass(exam);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <Ambient color={exam.color} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
        <div className="chip slide-up" style={{
          background: `rgba(${accentRGB}, 0.10)`,
          borderColor: `rgba(${accentRGB}, 0.50)`,
          color: accent,
        }}>
          <span className="chip-dot" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <span>{passed ? 'PASSED' : 'KEEP GOING'}</span>
        </div>

        <h1 className="slide-up" style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#0f172a' }}>
          {passed ? 'お見事！' : 'お疲れさまでした'}
        </h1>

        <div className="label slide-up">{exam.label} · {modeLabel(mode)}</div>

        <div className="panel slide-up" style={{
          width: '100%', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: `0 20px 50px rgba(${accentRGB}, 0.18), 0 4px 12px rgba(15, 23, 42, 0.04)`,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span className="label">SCORE</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="mono" style={{ fontSize: 64, fontWeight: 700, color: accent, lineHeight: 1 }}>{score}</span>
              <span className="mono" style={{ fontSize: 24, color: 'var(--text-dim)' }}>/ {total}</span>
            </div>
          </div>

          <div style={{ height: 10, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: `linear-gradient(90deg, ${accent} 0%, var(--cyan) 100%)`,
              boxShadow: `0 0 12px ${accent}55`,
              borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="label">ACCURACY</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: accent }}>{pct}%</span>
          </div>
        </div>

        <div className="slide-up" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className={`btn ${primaryBtnCls}`} onClick={onBack} style={{ width: '100%', padding: '16px 24px' }}>
            <ChevronLeft /><span>{exam.label} タイトルへ</span>
          </button>
          <button className="btn btn-secondary" onClick={onHome} style={{ width: '100%', padding: '14px 24px' }}>
            <span>試験選択へ戻る</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Utility components ───────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span className="label">{label}</span>
      <span className="mono" style={{ fontSize: 22, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
function Divider() { return <span style={{ width: 1, height: 28, background: 'var(--border)' }} />; }
function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ExplainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)' }}>
      <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export default App;
