import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Plus, Loader2, AlertTriangle, ArrowLeft, Eye, Pencil, Upload, Download, Trash2, FileText, CheckCircle2,
  XCircle, Archive, Send, EyeOff, Library, X,
} from 'lucide-react';
import {
  adminModuleApi, saveBlob,
  type ManagedModule, type ManagedModuleDetail, type ManagedModuleFile, type ModuleFormInput, type ModuleStatus,
} from '../services/api';
import { formatInline } from '../utils/formatInline';

// Teacher/Admin Module Management: list, create/edit with uploads, preview,
// publish/unpublish and archive. All rules are enforced server-side; the UI
// only mirrors them (e.g. hides actions on modules you can't manage).

const DIFFICULTY_LABEL: Record<string, ModuleFormInput['difficulty']> = { Easy: 'Beginner', Medium: 'Intermediate', Hard: 'Advanced' };
const CATEGORY_SUGGESTIONS = ['Web Security', 'Network Security', 'System Security', 'Social Engineering', 'Cryptography'];
const ACCEPT = '.pdf,.docx,.pptx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation';

const STATUS_STYLE: Record<ModuleStatus, string> = {
  DRAFT: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300',
  PUBLISHED: 'bg-green-500/10 border-green-500/40 text-green-300',
  ARCHIVED: 'bg-gray-500/10 border-gray-500/40 text-gray-400',
};

const inputClass = 'w-full bg-[#0a0f1e] border border-gray-700 rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors';
const btn = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const StatusBadge: React.FC<{ status: ModuleStatus }> = ({ status }) => (
  <span className={`px-2 py-0.5 text-xs font-semibold rounded border tracking-wide ${STATUS_STYLE[status]}`}>{status}</span>
);

const dateText = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const sizeText = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function errorText(err: any): { message: string; details: string[] } {
  const details = Array.isArray(err?.details) ? err.details.map((d: any) => (typeof d === 'string' ? d : d?.message ?? String(d))) : [];
  return { message: err?.message ?? 'Something went wrong.', details };
}

const Paragraphs: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-3 text-sm leading-relaxed text-gray-300">
    {text.trim().split(/\n\n+/).map((block, i) =>
      block.startsWith('## ')
        ? <h4 key={i} className="text-base font-bold text-white">{block.slice(3)}</h4>
        : <p key={i} className="whitespace-pre-line" dangerouslySetInnerHTML={{ __html: formatInline(block) }} />
    )}
  </div>
);

const Notice: React.FC<{ kind: 'error' | 'ok'; message: string; details?: string[]; onClose?: () => void }> = ({ kind, message, details, onClose }) => (
  <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 text-sm px-4 py-3 rounded-xl border ${kind === 'error' ? 'bg-red-950/30 border-red-500/30 text-red-300' : 'bg-green-950/30 border-green-500/30 text-green-300'}`}>
    {kind === 'error' ? <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />}
    <div className="flex-1">
      <p>{message}</p>
      {!!details?.length && <ul className="list-disc list-inside mt-1 space-y-0.5">{details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
    </div>
    {onClose && <button onClick={onClose} aria-label="Dismiss" className="opacity-70 hover:opacity-100"><X size={14} /></button>}
  </div>
);

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  title: string; description: string; category: string; difficulty: ModuleFormInput['difficulty'];
  learningObjectives: string; content: string; thumbnailUrl: string; estimatedTime: string; tags: string; referenceMaterials: string;
}

const emptyForm: FormState = {
  title: '', description: '', category: '', difficulty: 'Beginner', learningObjectives: '', content: '',
  thumbnailUrl: '', estimatedTime: '', tags: '', referenceMaterials: '',
};

const formFrom = (m: ManagedModuleDetail): FormState => ({
  title: m.name, description: m.description, category: m.category, difficulty: DIFFICULTY_LABEL[m.difficulty] ?? 'Intermediate',
  learningObjectives: m.learningObjectives ?? '', content: m.content ?? '', thumbnailUrl: m.thumbnailUrl ?? '',
  estimatedTime: String(m.duration ?? ''), tags: m.tags.join(', '), referenceMaterials: m.referenceMaterials ?? '',
});

const toInput = (f: FormState): ModuleFormInput => ({
  title: f.title, description: f.description, category: f.category, difficulty: f.difficulty,
  learningObjectives: f.learningObjectives, content: f.content,
  ...(f.thumbnailUrl.trim() ? { thumbnailUrl: f.thumbnailUrl.trim() } : {}),
  ...(f.estimatedTime.trim() ? { estimatedTime: Number(f.estimatedTime) } : {}),
  tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
  ...(f.referenceMaterials.trim() ? { referenceMaterials: f.referenceMaterials } : {}),
});

function missingRequired(f: FormState): string[] {
  const missing: string[] = [];
  if (!f.title.trim()) missing.push('Module title');
  if (!f.description.trim()) missing.push('Short description');
  if (!f.category.trim()) missing.push('Category');
  if (!f.learningObjectives.trim()) missing.push('Learning objectives');
  return missing;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type View = { kind: 'list' } | { kind: 'edit'; id: string | null };

const ModuleManagementPage: React.FC = () => {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-cyber-bg-dark text-white p-6 pb-24 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {flash && <Notice kind="ok" message={flash} onClose={() => setFlash(null)} />}
        {view.kind === 'list'
          ? <ModuleList onCreate={() => { setFlash(null); setView({ kind: 'edit', id: null }); }} onEdit={(id) => { setFlash(null); setView({ kind: 'edit', id }); }} onFlash={setFlash} />
          : <ModuleEditor id={view.id} onBack={(message) => { setFlash(message ?? null); setView({ kind: 'list' }); }} />}
      </div>
    </div>
  );
};

// ─── List ──────────────────────────────────────────────────────────────────────

const FILTERS: Array<'ALL' | ModuleStatus> = ['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'];

const ModuleList: React.FC<{ onCreate: () => void; onEdit: (id: string) => void; onFlash: (m: string) => void }> = ({ onCreate, onEdit, onFlash }) => {
  const [modules, setModules] = useState<ManagedModule[] | null>(null);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);
  const [filter, setFilter] = useState<'ALL' | ModuleStatus>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<ManagedModule | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setModules(await adminModuleApi.list());
    } catch (err) {
      setError(errorText(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (m: ManagedModule, action: 'publish' | 'unpublish') => {
    setBusyId(m.id);
    setError(null);
    try {
      await adminModuleApi[action](m.id);
      onFlash(action === 'publish' ? `"${m.name}" is published — students can see it now.` : `"${m.name}" is unpublished and hidden from students.`);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const shown = (modules ?? []).filter((m) => filter === 'ALL' || m.status === filter);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><Library className="text-indigo-400" /> Module Management</h1>
          <p className="text-gray-400 text-sm mt-1">Create learning modules from your own material. Published modules appear on every student's Modules dashboard.</p>
        </div>
        <button onClick={onCreate} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 shadow-lg shadow-indigo-900/30`}>
          <Plus size={16} /> Create Module
        </button>
      </motion.div>

      {error && <Notice kind="error" message={error.message} details={error.details} onClose={() => setError(null)} />}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === f ? 'bg-indigo-600/90 border-indigo-500 text-white' : 'bg-white/5 border-cyber-border text-gray-400 hover:text-white'}`}>
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            {modules && <span className="ml-1.5 opacity-70">{f === 'ALL' ? modules.length : modules.filter((m) => m.status === f).length}</span>}
          </button>
        ))}
      </div>

      {!modules && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={28} /></div>}

      {modules && (
        <div className="overflow-x-auto rounded-2xl border border-cyber-border bg-white/5">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-gray-500 border-b border-cyber-border">
              <tr>
                {['Module', 'Category', 'Difficulty', 'Created by', 'Created', 'Status', 'Files', 'Learners', 'Actions'].map((h) => (
                  <th key={h} scope="col" className={`px-4 py-3 font-semibold ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id} className="border-b border-cyber-border/60 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 max-w-[16rem]">
                    <p className="font-semibold text-white truncate" title={m.name}>{m.name}</p>
                    {m.isPredefined && <p className="text-[11px] text-gray-500">Built-in curriculum</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{m.category}</td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{DIFFICULTY_LABEL[m.difficulty] ?? m.difficulty}</td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{m.createdBy?.name ?? 'System'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{dateText(m.createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-3 text-gray-300">{m.fileCount}</td>
                  <td className="px-4 py-3 text-gray-300" title="Students who have completed at least one lesson">{m.learnerCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton label={`View ${m.name}`} onClick={() => setViewing(m.id)}><Eye size={15} /></IconButton>
                      {m.canManage && m.status !== 'ARCHIVED' && (
                        <>
                          <IconButton label={`Edit ${m.name}`} onClick={() => onEdit(m.id)}><Pencil size={15} /></IconButton>
                          {m.status === 'PUBLISHED'
                            ? <IconButton label={`Unpublish ${m.name}`} busy={busyId === m.id} onClick={() => act(m, 'unpublish')}><EyeOff size={15} /></IconButton>
                            : <IconButton label={`Publish ${m.name}`} busy={busyId === m.id} onClick={() => act(m, 'publish')}><Send size={15} /></IconButton>}
                          <IconButton label={`Delete ${m.name}`} danger onClick={() => setArchiving(m)}><Trash2 size={15} /></IconButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">No modules here yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {archiving && (
        <ArchiveDialog module={archiving} onClose={() => setArchiving(null)} onDone={async () => {
          onFlash(`"${archiving.name}" was deleted. It's archived: hidden from students, with learner progress and history kept.`);
          setArchiving(null);
          await load();
        }} />
      )}
      {viewing && <PreviewLoader id={viewing} onClose={() => setViewing(null)} />}
    </>
  );
};

const IconButton: React.FC<{ label: string; onClick: () => void; children: React.ReactNode; danger?: boolean; busy?: boolean }> = ({ label, onClick, children, danger, busy }) => (
  <button onClick={onClick} disabled={busy} aria-label={label} title={label.split(' ')[0]}
    className={`p-2 rounded-lg border border-transparent transition-colors disabled:opacity-50 ${danger ? 'text-red-400 hover:bg-red-500/10 hover:border-red-500/30' : 'text-gray-300 hover:bg-white/10 hover:border-cyber-border'}`}>
    {busy ? <Loader2 size={15} className="animate-spin" /> : children}
  </button>
);

// ─── Archive (delete) confirmation ─────────────────────────────────────────────

const ArchiveDialog: React.FC<{ module: ManagedModule; onClose: () => void; onDone: () => void }> = ({ module, onClose, onDone }) => {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === module.name.trim();

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminModuleApi.archive(module.id, typed);
      onDone();
    } catch (err) {
      setError(errorText(err).message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Delete module?" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-gray-300">You are about to delete <strong className="text-white">{module.name}</strong>.</p>
        <ul className="list-disc list-inside text-gray-400 space-y-1">
          <li>It will be archived and removed from every student's dashboard.</li>
          <li>{module.learnerCount} learner{module.learnerCount === 1 ? '' : 's'} with progress — their progress and all assessment history are kept.</li>
          <li>Its {module.fileCount} uploaded file{module.fileCount === 1 ? '' : 's'} are kept with the archived module.</li>
          <li>An archived module can't be edited or published again.</li>
        </ul>
        <label className="block">
          <span className="block text-xs text-gray-400 mb-1.5">Type the module name to confirm</span>
          <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} placeholder={module.name} aria-label="Module name confirmation" />
        </label>
        {error && <p className="text-red-400 text-xs" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className={`${btn} border border-gray-700 text-gray-300 hover:text-white`}>Cancel</button>
          <button onClick={confirm} disabled={!matches || busy} className={`${btn} bg-red-600 hover:bg-red-500 text-white`}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />} Delete module
          </button>
        </div>
      </div>
    </Modal>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Portalled to <body>: the page content is its own stacking context, so an
  // in-place overlay would sit underneath the fixed sidebar.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`bg-[#0f1629] border border-[#1e293b] rounded-2xl p-7 w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
};

// ─── Preview ───────────────────────────────────────────────────────────────────

interface PreviewData {
  title: string; description: string; category: string; difficulty: string; learningObjectives: string;
  content: string; status?: ModuleStatus; files: ManagedModuleFile[]; thumbnailUrl?: string | null;
}

const PreviewLoader: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const [mod, setMod] = useState<ManagedModuleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { adminModuleApi.get(id).then(setMod).catch((err) => setError(errorText(err).message)); }, [id]);
  return (
    <Modal title="Module preview" onClose={onClose} wide>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!mod && !error && <Loader2 className="animate-spin text-indigo-400 mx-auto" />}
      {mod && (
        <ModulePreview moduleId={mod.id} data={{
          title: mod.name, description: mod.description, category: mod.category, difficulty: DIFFICULTY_LABEL[mod.difficulty] ?? mod.difficulty,
          learningObjectives: mod.learningObjectives ?? '', content: mod.content ?? '', status: mod.status, files: mod.files, thumbnailUrl: mod.thumbnailUrl,
        }} predefinedLessons={mod.isPredefined ? mod.lessonCount : undefined} />
      )}
    </Modal>
  );
};

const ModulePreview: React.FC<{ moduleId?: string; data: PreviewData; predefinedLessons?: number }> = ({ moduleId, data, predefinedLessons }) => (
  <div className="space-y-5">
    {data.thumbnailUrl && <img src={data.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="w-full h-40 object-cover rounded-xl border border-cyber-border" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {data.status && <StatusBadge status={data.status} />}
        <span className="text-xs text-indigo-300">{data.category || 'No category'}</span>
        <span className="text-xs text-gray-500">· {data.difficulty}</span>
      </div>
      <h3 className="text-2xl font-bold text-white">{data.title || 'Untitled module'}</h3>
      <p className="text-gray-400 text-sm mt-1">{data.description}</p>
    </div>
    <PreviewSection title="Learning objectives">{data.learningObjectives.trim() ? <Paragraphs text={data.learningObjectives} /> : <Empty />}</PreviewSection>
    {predefinedLessons !== undefined
      ? <PreviewSection title="Content"><p className="text-sm text-gray-400">Built-in module with {predefinedLessons} lessons.</p></PreviewSection>
      : <PreviewSection title="Module content">{data.content.trim() ? <Paragraphs text={data.content} /> : <Empty text="No typed content — students will study the uploaded materials." />}</PreviewSection>}
    <PreviewSection title={`Uploaded materials (${data.files.length})`}>
      {data.files.length === 0 ? <Empty text="No files uploaded." /> : (
        <div className="space-y-3">
          {data.files.map((f) => (
            <details key={f.id} className="border border-cyber-border rounded-xl group">
              <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                <FileText size={15} className="text-indigo-400 flex-shrink-0" />
                <span className="flex-1 truncate text-sm text-gray-200">{f.originalFileName}</span>
                <FileStatus file={f} />
              </summary>
              <div className="border-t border-cyber-border px-4 py-4 max-h-80 overflow-y-auto">
                {f.extractedText ? <Paragraphs text={f.extractedText} /> : <p className="text-sm text-gray-400">{f.processingNote}</p>}
                {moduleId && <DownloadButton moduleId={moduleId} file={f} />}
              </div>
            </details>
          ))}
        </div>
      )}
    </PreviewSection>
  </div>
);

const PreviewSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
    {children}
  </section>
);
const Empty: React.FC<{ text?: string }> = ({ text = 'Not provided.' }) => <p className="text-sm text-gray-500 italic">{text}</p>;

const FileStatus: React.FC<{ file: ManagedModuleFile }> = ({ file }) =>
  file.processingStatus === 'EXTRACTED'
    ? <span className="flex items-center gap-1 text-xs text-green-300 whitespace-nowrap"><CheckCircle2 size={13} /> Text extracted</span>
    : <span className="flex items-center gap-1 text-xs text-yellow-300 whitespace-nowrap"><AlertTriangle size={13} /> No text found</span>;

const DownloadButton: React.FC<{ moduleId: string; file: ManagedModuleFile }> = ({ moduleId, file }) => {
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} aria-label={`Download ${file.originalFileName}`} className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        try { saveBlob((await adminModuleApi.downloadFile(moduleId, file.id)).data, file.originalFileName); } finally { setBusy(false); }
      }}>
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download original
    </button>
  );
};

// ─── Editor ────────────────────────────────────────────────────────────────────

const ModuleEditor: React.FC<{ id: string | null; onBack: (message?: string) => void }> = ({ id: initialId, onBack }) => {
  const [id, setId] = useState<string | null>(initialId);
  const [mod, setMod] = useState<ManagedModuleDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(!!initialId);
  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!initialId) return;
    adminModuleApi.get(initialId)
      .then((m) => { setMod(m); setForm(formFrom(m)); })
      .catch((err) => setError(errorText(err)))
      .finally(() => setLoading(false));
  }, [initialId]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const isPublished = mod?.status === 'PUBLISHED';

  // Saves the form; returns the saved module (or null on failure).
  const save = async (publish: boolean): Promise<ManagedModuleDetail | null> => {
    setError(null);
    setNotice(null);
    const missing = missingRequired(form);
    if (missing.length) {
      setError({ message: 'Fill in the required fields.', details: missing.map((m) => `${m} is required.`) });
      return null;
    }
    setSaving(publish ? 'publish' : 'draft');
    try {
      let saved: ManagedModuleDetail;
      if (!id) {
        const res = await adminModuleApi.create({ ...toInput(form), publish });
        saved = res.data;
        setId(saved.id);
        if (res.warnings?.length) setError({ message: res.warnings[0], details: res.warnings.slice(1) });
      } else {
        saved = await adminModuleApi.update(id, toInput(form));
        if (publish && saved.status !== 'PUBLISHED') saved = await adminModuleApi.publish(id);
      }
      setMod(saved);
      setForm(formFrom(saved));
      return saved;
    } catch (err) {
      setError(errorText(err));
      return null;
    } finally {
      setSaving(null);
    }
  };

  const saveDraft = async () => {
    const saved = await save(false);
    if (saved) setNotice(saved.status === 'PUBLISHED' ? 'Changes saved — students see the update now.' : 'Draft saved. Only teachers and admins can see it.');
  };

  const publish = async () => {
    const saved = await save(true);
    if (saved?.status === 'PUBLISHED') onBack(`"${saved.name}" is published — students can see it now.`);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-400" size={28} /></div>;

  return (
    <>
      <button onClick={() => onBack()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft size={15} /> Back to Module Management</button>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{id ? 'Edit module' : 'Create module'}</h1>
        {mod && <StatusBadge status={mod.status} />}
      </div>

      {error && <Notice kind="error" message={error.message} details={error.details} onClose={() => setError(null)} />}
      {notice && <Notice kind="ok" message={notice} onClose={() => setNotice(null)} />}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <form className="glass-card border border-cyber-border bg-white/5 rounded-2xl p-6 space-y-5" onSubmit={(e) => { e.preventDefault(); saveDraft(); }}>
          <Field label="Module title" required><input value={form.title} onChange={set('title')} maxLength={120} className={inputClass} required /></Field>
          <Field label="Short description" required><textarea value={form.description} onChange={set('description')} maxLength={500} rows={2} className={inputClass} required /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Category / cybersecurity topic" required>
              <input value={form.category} onChange={set('category')} maxLength={60} list="module-categories" className={inputClass} required />
              <datalist id="module-categories">{CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Difficulty level" required>
              <select value={form.difficulty} onChange={set('difficulty')} className={inputClass}>
                <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
              </select>
            </Field>
          </div>
          <Field label="Learning objectives" required hint="One per line, e.g. “- Recognise phishing red flags”.">
            <textarea value={form.learningObjectives} onChange={set('learningObjectives')} rows={4} className={inputClass} required />
          </Field>
          <Field label="Module content / learning material" required={!id || isPublished}
            hint="Type the lesson here, upload documents, or both. Use “## Heading”, “- bullet” and **bold**. If a document's text can't be extracted, enter it here.">
            <textarea value={form.content} onChange={set('content')} rows={10} className={inputClass} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Estimated learning time (minutes)"><input type="number" min={1} max={1000} value={form.estimatedTime} onChange={set('estimatedTime')} className={inputClass} /></Field>
            <Field label="Tags" hint="Comma-separated."><input value={form.tags} onChange={set('tags')} className={inputClass} /></Field>
          </div>
          <Field label="Thumbnail image URL" hint="Optional https:// link to an image."><input value={form.thumbnailUrl} onChange={set('thumbnailUrl')} className={inputClass} placeholder="https://" /></Field>
          <Field label="Reference materials" hint="Optional links or citations."><textarea value={form.referenceMaterials} onChange={set('referenceMaterials')} rows={3} className={inputClass} /></Field>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-cyber-border">
            <button type="submit" disabled={!!saving} className={`${btn} border border-gray-600 text-gray-200 hover:text-white hover:border-gray-400`}>
              {saving === 'draft' ? <Loader2 size={15} className="animate-spin" /> : null}{isPublished ? 'Save changes' : 'Save as Draft'}
            </button>
            <button type="button" onClick={() => setPreviewing(true)} className={`${btn} border border-indigo-500/50 text-indigo-200 hover:bg-indigo-500/10`}><Eye size={15} /> Preview</button>
            {!isPublished && (
              <button type="button" onClick={publish} disabled={!!saving} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}>
                {saving === 'publish' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publish Module
              </button>
            )}
          </div>
        </form>

        <FilesPanel moduleId={id} files={mod?.files ?? []} onChange={(files) => setMod((m) => (m ? { ...m, files } : m))} />
      </div>

      {previewing && (
        <Modal title="Module preview" onClose={() => setPreviewing(false)} wide>
          <ModulePreview moduleId={id ?? undefined} data={{ ...form, status: mod?.status, files: mod?.files ?? [] }} />
          <div className="flex flex-wrap justify-end gap-3 pt-6 mt-6 border-t border-cyber-border">
            <button onClick={async () => { setPreviewing(false); await saveDraft(); }} disabled={!!saving} className={`${btn} border border-gray-600 text-gray-200 hover:text-white`}>{isPublished ? 'Save changes' : 'Save as Draft'}</button>
            {!isPublished && <button onClick={async () => { setPreviewing(false); await publish(); }} disabled={!!saving} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}><Send size={15} /> Publish Module</button>}
          </div>
        </Modal>
      )}
    </>
  );
};

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({ label, required, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-medium text-gray-300 mb-1.5">{label}{required && <span className="text-red-400" aria-hidden="true"> *</span>}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
  </label>
);

// ─── Files ─────────────────────────────────────────────────────────────────────

const FilesPanel: React.FC<{ moduleId: string | null; files: ManagedModuleFile[]; onChange: (files: ManagedModuleFile[]) => void }> = ({ moduleId, files, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [rejected, setRejected] = useState<{ originalFileName: string; error: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const upload = async (list: FileList | null) => {
    if (!moduleId || !list?.length) return;
    setUploading(true);
    setRejected([]);
    setError(null);
    try {
      const result = await adminModuleApi.upload(moduleId, Array.from(list));
      onChange([...files, ...result.accepted]);
      setRejected(result.rejected);
    } catch (err) {
      setError(errorText(err).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (f: ManagedModuleFile) => {
    if (!moduleId) return;
    setRemoving(f.id);
    setError(null);
    try {
      await adminModuleApi.removeFile(moduleId, f.id);
      onChange(files.filter((x) => x.id !== f.id));
    } catch (err) {
      setError(errorText(err).message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <aside className="glass-card border border-cyber-border bg-white/5 rounded-2xl p-6 space-y-4 h-fit">
      <div>
        <h2 className="text-base font-bold flex items-center gap-2"><Upload size={16} className="text-indigo-400" /> Learning materials</h2>
        <p className="text-xs text-gray-500 mt-1">PDF, DOCX, PPTX or TXT · up to 10 files at a time · 15 MB each. Text is extracted automatically; originals are kept.</p>
      </div>

      {!moduleId ? (
        <p className="text-sm text-gray-400 border border-dashed border-gray-700 rounded-xl p-4">Save the module as a draft first, then upload its files here.</p>
      ) : (
        <>
          <input ref={inputRef} type="file" multiple accept={ACCEPT} className="sr-only" id="module-file-input" onChange={(e) => upload(e.target.files)} disabled={uploading} />
          <label htmlFor="module-file-input" className={`${btn} w-full justify-center border border-dashed border-indigo-500/50 text-indigo-200 hover:bg-indigo-500/10 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            {uploading ? <><Loader2 size={15} className="animate-spin" /> Uploading and extracting…</> : <><Upload size={15} /> Choose files</>}
          </label>
        </>
      )}

      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
      {rejected.length > 0 && (
        <div role="alert" className="space-y-1.5">
          {rejected.map((r, i) => (
            <div key={i} className="flex gap-2 text-xs text-red-300 bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-2">
              <XCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span><strong className="text-red-200">{r.originalFileName}</strong> — {r.error}</span>
            </div>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {files.map((f) => (
          <li key={f.id} className="border border-cyber-border rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-indigo-500/30 text-indigo-300">{f.fileType}</span>
              <span className="flex-1 truncate text-sm text-gray-200" title={f.originalFileName}>{f.originalFileName}</span>
              <button onClick={() => remove(f)} disabled={removing === f.id} aria-label={`Remove ${f.originalFileName}`} className="text-gray-500 hover:text-red-400 disabled:opacity-50">
                {removing === f.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-500">
              <FileStatus file={f} />
              <span>{sizeText(f.fileSize)}</span>
            </div>
            {f.processingNote && <p className="text-[11px] text-yellow-300/80 mt-1">{f.processingNote}</p>}
          </li>
        ))}
        {moduleId && files.length === 0 && <li className="text-xs text-gray-500">No files uploaded yet.</li>}
      </ul>
    </aside>
  );
};

export default ModuleManagementPage;
