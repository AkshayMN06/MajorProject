import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Loader2, AlertTriangle, CheckCircle2,
  BookOpen, Layers, HelpCircle, Check, X as XIcon, FileText, Download, ChevronDown, Target,
} from 'lucide-react';
import { moduleApi, saveBlob, type ModuleDetail, type ModuleLesson, type ModuleMaterial } from '../services/api';
import { formatInline } from '../utils/formatInline';

interface InteractiveContent {
  steps: { title: string; body: string }[];
}

interface QuizContent {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const TYPE_ICON: Record<ModuleLesson['type'], React.ReactNode> = {
  theory: <BookOpen size={14} />,
  interactive: <Layers size={14} />,
  quiz: <HelpCircle size={14} />,
};

// Very small markdown-ish renderer for theory content: "## " headings,
// "- " bullets, blank-line-separated paragraphs. Not a general markdown
// parser — matches exactly the formatting used in moduleData.ts.
const TheoryContent: React.FC<{ text: string }> = ({ text }) => {
  const blocks = text.trim().split(/\n\n+/);
  return (
    <div className="space-y-4 text-sm leading-relaxed text-gray-300">
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          return (
            <h3 key={i} className="text-lg font-bold text-white pt-2">
              {block.replace(/^## /, '')}
            </h3>
          );
        }
        if (block.split('\n').every((l) => l.startsWith('- ') || l.startsWith('**'))) {
          return (
            <ul key={i} className="list-disc list-inside space-y-1 pl-1">
              {block.split('\n').map((l, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(l.replace(/^- /, '')) }} />
              ))}
            </ul>
          );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(block) }} />;
      })}
    </div>
  );
};


const InteractiveLesson: React.FC<{ content: InteractiveContent; onFinish: () => void }> = ({ content, onFinish }) => {
  const [step, setStep] = useState(0);
  const isLast = step === content.steps.length - 1;
  const current = content.steps[step];

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-6">
        {content.steps.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-indigo-500' : 'bg-gray-800'}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-xs text-indigo-400 font-medium mb-2">Step {step + 1} of {content.steps.length}</p>
          <h3 className="text-lg font-bold text-white mb-3">{current.title}</h3>
          <p className="text-sm text-gray-300 leading-relaxed">{current.body}</p>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between mt-8">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-4 py-2 rounded-lg text-sm border border-cyber-border text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => (isLast ? onFinish() : setStep((s) => s + 1))}
          className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2"
        >
          {isLast ? 'Finish' : 'Next'} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

const QuizLesson: React.FC<{ content: QuizContent; onFinish: () => void }> = ({ content, onFinish }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  return (
    <div>
      <h3 className="text-base font-semibold text-white mb-5">{content.question}</h3>
      <div className="space-y-2.5 mb-6">
        {content.options.map((opt, i) => {
          const isCorrect = i === content.correctIndex;
          const isSelected = i === selected;
          let cls = 'border-cyber-border bg-white/5 text-gray-300 hover:border-gray-600';
          if (revealed && isCorrect) cls = 'border-green-500/60 bg-green-500/10 text-green-300';
          else if (revealed && isSelected && !isCorrect) cls = 'border-red-500/60 bg-red-500/10 text-red-300';
          else if (isSelected) cls = 'border-indigo-500 bg-indigo-500/10 text-white';

          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() => setSelected(i)}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors flex items-center justify-between ${cls}`}
            >
              <span>{opt}</span>
              {revealed && isCorrect && <Check size={16} className="flex-shrink-0" />}
              {revealed && isSelected && !isCorrect && <XIcon size={16} className="flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {revealed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-sm text-gray-400 bg-white/5 border border-cyber-border rounded-lg p-4"
        >
          {content.explanation}
        </motion.div>
      )}

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          disabled={selected === null}
          className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Answer
        </button>
      ) : (
        <button
          onClick={onFinish}
          className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2"
        >
          Continue <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
};

export const LessonPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mod, setMod] = useState<ModuleDetail | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await moduleApi.getById(id);
      setMod(data);
      const firstIncomplete = data.lessons.findIndex((l) => !l.completed);
      setActiveIdx(firstIncomplete === -1 ? 0 : firstIncomplete);
    } catch {
      setError('Could not load this module. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-bg-dark flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={28} />
      </div>
    );
  }

  if (error || !mod) {
    return (
      <div className="min-h-screen bg-cyber-bg-dark flex items-center justify-center p-6">
        <div className="flex items-start gap-3 bg-red-950/30 border border-red-500/30 text-red-300 text-sm px-5 py-4 rounded-xl max-w-md">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error ?? 'Module not found.'}</span>
        </div>
      </div>
    );
  }

  const lesson = mod.lessons[activeIdx];
  const isLastLesson = activeIdx === mod.lessons.length - 1;

  const markCompleteAndAdvance = async () => {
    if (!lesson || lesson.completed) {
      advance();
      return;
    }
    setCompleting(true);
    try {
      await moduleApi.completeLesson(mod.id, lesson.id);
      setMod((prev) =>
        prev ? { ...prev, lessons: prev.lessons.map((l) => (l.id === lesson.id ? { ...l, completed: true } : l)) } : prev
      );
    } catch {
      // Non-fatal — the lesson content was still shown; let the learner continue.
    } finally {
      setCompleting(false);
      advance();
    }
  };

  const advance = () => {
    if (isLastLesson) {
      navigate('/modules');
    } else {
      setActiveIdx((i) => i + 1);
    }
  };

  const renderBody = () => {
    if (lesson.type === 'theory') {
      if (!lesson.content.trim() && mod.files?.length) {
        return <p className="text-sm text-gray-400">This module's learning material is in the documents below.</p>;
      }
      return <TheoryContent text={lesson.content} />;
    }
    if (lesson.type === 'interactive') {
      let parsed: InteractiveContent;
      try { parsed = JSON.parse(lesson.content); } catch { return <p className="text-red-400 text-sm">Could not load this lesson's content.</p>; }
      return <InteractiveLesson content={parsed} onFinish={markCompleteAndAdvance} />;
    }
    if (lesson.type === 'quiz') {
      let parsed: QuizContent;
      try { parsed = JSON.parse(lesson.content); } catch { return <p className="text-red-400 text-sm">Could not load this lesson's content.</p>; }
      return <QuizLesson content={parsed} onFinish={markCompleteAndAdvance} />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-cyber-bg-dark text-white p-6 pb-24 md:p-8 lg:p-12">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/modules')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={15} /> Back to Modules
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
          {/* Lesson list sidebar */}
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white mb-1">{mod.name}</h2>
            <p className="text-xs text-gray-500 mb-4">{mod.category} &middot; {mod.difficulty}</p>
            {mod.lessons.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setActiveIdx(i)}
                className={`w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  i === activeIdx ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/40' : 'text-gray-400 hover:bg-white/5 border border-transparent'
                }`}
              >
                {l.completed ? <CheckCircle2 size={15} className="text-green-400 flex-shrink-0" /> : <span className="flex-shrink-0 text-gray-600">{TYPE_ICON[l.type]}</span>}
                <span className="flex-1 truncate">{l.title}</span>
              </button>
            ))}
          </div>

          {/* Active lesson content */}
          <motion.div
            key={lesson.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card border border-cyber-border bg-white/5 rounded-2xl p-6 md:p-8"
          >
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium mb-4 uppercase tracking-wide">
              {TYPE_ICON[lesson.type]} {lesson.type}
            </div>
            {renderBody()}

            {lesson.type === 'theory' && (
              <button
                onClick={markCompleteAndAdvance}
                disabled={completing}
                className="mt-8 px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {completing ? <Loader2 size={14} className="animate-spin" /> : isLastLesson ? 'Finish Module' : 'Mark Complete & Continue'}
                {!completing && <ArrowRight size={14} />}
              </button>
            )}
          </motion.div>
        </div>

        {mod.isCustom && <ModuleExtras mod={mod} />}
      </div>
    </div>
  );
};

const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Teacher-authored modules: objectives, references and the uploaded
// learning materials (extracted text inline, original file downloadable).
const ModuleExtras: React.FC<{ mod: ModuleDetail }> = ({ mod }) => (
  <div className="mt-8 space-y-6">
    {mod.learningObjectives && (
      <section className="glass-card border border-cyber-border bg-white/5 rounded-2xl p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3"><Target size={15} className="text-indigo-400" /> Learning objectives</h3>
        <TheoryContent text={mod.learningObjectives} />
      </section>
    )}
    {!!mod.files?.length && (
      <section className="glass-card border border-cyber-border bg-white/5 rounded-2xl p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4"><FileText size={15} className="text-indigo-400" /> Learning materials</h3>
        <div className="space-y-3">
          {mod.files.map((f) => <MaterialItem key={f.id} moduleId={mod.id} file={f} />)}
        </div>
      </section>
    )}
    {mod.referenceMaterials && (
      <section className="glass-card border border-cyber-border bg-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-3">References</h3>
        <TheoryContent text={mod.referenceMaterials} />
      </section>
    )}
    {mod.authorName && <p className="text-xs text-gray-600">Module by {mod.authorName}</p>}
  </div>
);

const MaterialItem: React.FC<{ moduleId: string; file: ModuleMaterial }> = ({ moduleId, file }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await moduleApi.downloadFile(moduleId, file.id);
      saveBlob(res.data, file.originalFileName);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border border-cyber-border rounded-xl">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-300 bg-indigo-500/10">{file.fileType}</span>
        <span className="flex-1 min-w-0 truncate text-sm text-gray-200" title={file.originalFileName}>{file.originalFileName}</span>
        <span className="text-xs text-gray-500 hidden sm:inline">{fileSize(file.fileSize)}</span>
        {file.extractedText && (
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200">
            {open ? 'Hide' : 'Read'} <ChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        )}
        <button onClick={download} disabled={busy} aria-label={`Download ${file.originalFileName}`} className="flex items-center gap-1 text-xs text-gray-300 hover:text-white disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download
        </button>
      </div>
      {failed && <p className="px-4 pb-3 text-xs text-red-400">The file could not be downloaded. Please try again.</p>}
      {open && file.extractedText && (
        <div className="border-t border-cyber-border px-4 py-4 max-h-[28rem] overflow-y-auto">
          <TheoryContent text={file.extractedText} />
        </div>
      )}
    </div>
  );
};

export default LessonPage;
