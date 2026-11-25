import { randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { isUtf8 } from 'node:buffer';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import type { ModuleFileType } from './documentText';

export type { ModuleFileType } from './documentText';

// Uploaded learning materials: validation, bounded text extraction and
// private storage. Nothing here trusts the client's filename or declared type.

const MIMES: Record<ModuleFileType, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
};

export const MAX_FILES_PER_UPLOAD = 10;
const MAX_TEXT_CHARS = 200_000;
const WORKER_HEAP_MB = 256;

export class FileRejection extends Error {}

export interface ValidatedFile {
  fileType: ModuleFileType;
  mimeType: string;
  originalFileName: string;
}

export interface ExtractionResult {
  extractedText: string | null;
  processingStatus: 'EXTRACTED' | 'NO_TEXT';
  processingNote: string | null;
}

/** Display-safe name: no path parts, control characters or path separators. */
export function sanitizeFileName(name: string): string {
  const base = path.basename(String(name ?? '').replace(/\\/g, '/'));
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim();
  return (cleaned || 'file').slice(0, 120);
}

const isZip = (b: Buffer) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/**
 * Cheap, in-process checks: extension, declared MIME type and the file's own
 * signature must all agree. Throws FileRejection (user-facing message) for
 * unsupported or mislabelled files; those are never stored.
 */
export function validateUpload(originalName: string, declaredMime: string, buf: Buffer): ValidatedFile {
  const originalFileName = sanitizeFileName(originalName);
  const ext = path.extname(originalFileName).slice(1).toLowerCase();
  if (!(ext in MIMES)) throw new FileRejection('Unsupported file type. Upload PDF, DOCX, PPTX or TXT files.');
  const fileType = ext as ModuleFileType;
  const mime = String(declaredMime || '').split(';')[0].trim().toLowerCase();
  if (!MIMES[fileType].includes(mime)) throw new FileRejection(`The file's type (${mime || 'unknown'}) does not match a .${fileType} file.`);
  if (buf.length === 0) throw new FileRejection('The file is empty.');
  if (fileType === 'pdf' && buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new FileRejection('This is not a valid PDF file.');
  if ((fileType === 'docx' || fileType === 'pptx') && !isZip(buf)) throw new FileRejection(`This is not a valid .${fileType} file.`);
  if (fileType === 'txt' && (buf.includes(0) || !isUtf8(buf))) throw new FileRejection('Text files must be UTF-8 plain text.');
  return { fileType, mimeType: mime, originalFileName };
}

function normalize(text: string): { text: string; truncated: boolean } {
  const cleaned = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned.length > MAX_TEXT_CHARS ? { text: cleaned.slice(0, MAX_TEXT_CHARS), truncated: true } : { text: cleaned, truncated: false };
}

const unavailable = (why: string): ExtractionResult => ({
  extractedText: null,
  processingStatus: 'NO_TEXT',
  processingNote: `${why} The original is kept — enter the module content manually.`,
});

type WorkerReply = { ok: true; text: string; note: string | null } | { ok: false; rejected?: string; failed?: boolean };

// Parsers run in a separate, memory-capped Node process that is killed at
// the deadline, so extraction work genuinely stops (not merely stops being
// awaited). Under tsx/vitest the worker is TypeScript and needs the loader.
// Live extraction processes and the outcome of the most recent one. The
// request never finishes while its worker is alive: finish() waits for the
// child's own 'exit' event, so "stopped" is observed, not assumed.
const liveWorkers = new Set<ChildProcess>();
let lastWorker: { pid: number | undefined; exitCode: number | null; signal: NodeJS.Signals | null; timedOut: boolean } | null = null;
export const workerStats = () => ({ live: liveWorkers.size, last: lastWorker });

// A static require.resolve lets deployment file tracing find and bundle the
// worker (compiled .js, or .ts under tsx). Test runners that load TypeScript
// without a require hook can't resolve it, so fall back to the source path.
function workerPath(): string {
  try {
    return require.resolve('./extractWorker');
  } catch {
    return path.join(__dirname, 'extractWorker.ts');
  }
}

function runWorker(fileType: ModuleFileType, buf: Buffer, timeoutMs: number): Promise<WorkerReply | 'timeout' | 'crashed'> {
  const workerFile = workerPath();
  let child: ChildProcess;
  try {
    child = fork(workerFile, [], {
      serialization: 'advanced',
      execArgv: [...(workerFile.endsWith('.ts') ? ['--import', 'tsx'] : []), `--max-old-space-size=${WORKER_HEAP_MB}`],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
  } catch {
    return Promise.resolve('crashed'); // could not even be created; nothing to track
  }
  liveWorkers.add(child);
  let timedOut = false;
  // 'close' is the one event every outcome ends with: after 'exit' for a
  // worker that ran, and after 'error' alone when the process never started
  // (a failed spawn emits no 'exit'). Tracking is cleared and the request
  // settled only then, so it can neither hang nor outlive a running worker.
  const closed = new Promise<void>((resolveClose) => {
    child.once('close', () => {
      liveWorkers.delete(child);
      lastWorker = { pid: child.pid, exitCode: child.exitCode, signal: child.signalCode, timedOut };
      resolveClose();
    });
  });
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: WorkerReply | 'timeout' | 'crashed') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (value === 'timeout') timedOut = true;
      // Only a started, still-running process can (and must) be killed.
      if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      closed.then(() => resolve(value));
    };
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    child.once('message', (reply: WorkerReply) => finish(reply));
    child.once('error', () => finish('crashed')); // spawn failure, kill failure or IPC error
    child.once('exit', () => finish('crashed')); // exited without replying
    try {
      child.send({ fileType, data: new Uint8Array(buf) }, (err) => { if (err) finish('crashed'); });
    } catch {
      finish('crashed'); // IPC channel already gone (e.g. spawn failed synchronously)
    }
  });
}

/**
 * Extracts readable text from an already-validated file. Damaged documents
 * throw FileRejection (not stored). If extraction is unavailable — times out,
 * runs out of memory, or finds no text (e.g. a scanned PDF) — the file is
 * still accepted as NO_TEXT so the teacher keeps the original and types the
 * content instead.
 */
export async function extractText(fileType: ModuleFileType, buf: Buffer): Promise<ExtractionResult> {
  const reply = await runWorker(fileType, buf, env.MODULE_EXTRACT_TIMEOUT_MS);
  if (reply === 'timeout') return unavailable('Text extraction took too long and was stopped.');
  if (reply === 'crashed' || (!reply.ok && !reply.rejected)) return unavailable('Text extraction failed for this file.');
  if (!reply.ok) throw new FileRejection(reply.rejected);

  const { text, truncated } = normalize(reply.text);
  const note = [reply.note, truncated ? `Extracted text was shortened to ${MAX_TEXT_CHARS.toLocaleString('en-US')} characters.` : null].filter(Boolean).join(' ') || null;
  if (!text) return unavailable('No readable text was found (for example, a scanned document).');
  return { extractedText: text, processingStatus: 'EXTRACTED', processingNote: note };
}

/** validateUpload + extractText, for callers that want one step. */
export async function processUpload(originalName: string, declaredMime: string, buf: Buffer) {
  const validated = validateUpload(originalName, declaredMime, buf);
  return { ...validated, ...(await extractText(validated.fileType, buf)) };
}

const STORED_NAME = /^[0-9a-f-]{36}\.(pdf|docx|pptx|txt)$/;
const STAGING_ID = /^staging\/[0-9a-f-]{36}\.(pdf|docx|pptx|txt)$/;
const ALL_MIMES = Object.values(MIMES).flat();

// ── Storage backends ─────────────────────────────────────────────────────────
// Supabase Storage (a private bucket) when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set — required on Vercel, whose filesystem
// is temporary. Otherwise the local private directory MODULE_FILE_DIR (local
// development and tests). Originals live under a server-generated name in
// both; nothing is ever publicly readable.
const supabase: SupabaseClient | null =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

/** True when originals are kept in Supabase Storage (uploads go direct to it). */
export const usesObjectStorage = () => supabase !== null;

let bucketReady: Promise<void> | null = null;
// Creates the private bucket on first use, limited to the supported types and
// the per-file size, so Supabase itself refuses anything else.
function bucket() {
  bucketReady ??= (async () => {
    const { data } = await supabase!.storage.getBucket(env.MODULE_FILE_BUCKET);
    if (data) return;
    const { error } = await supabase!.storage.createBucket(env.MODULE_FILE_BUCKET, {
      public: false,
      fileSizeLimit: `${env.MODULE_FILE_MAX_MB}MB`,
      allowedMimeTypes: ALL_MIMES,
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  })().catch((err) => {
    bucketReady = null; // retry on the next request
    throw err;
  });
  return bucketReady.then(() => supabase!.storage.from(env.MODULE_FILE_BUCKET));
}

const originalPath = (storedFileName: string) => {
  if (!STORED_NAME.test(storedFileName)) throw new Error('Invalid stored file name');
  return `originals/${storedFileName}`;
};

/** Writes the original bytes under a server-generated name; returns that name. */
export async function storeFile(fileType: ModuleFileType, buf: Buffer): Promise<string> {
  const storedFileName = `${randomUUID()}.${fileType}`;
  if (supabase) {
    const { error } = await (await bucket()).upload(originalPath(storedFileName), buf, { contentType: MIMES[fileType][0], upsert: false });
    if (error) throw error;
    return storedFileName;
  }
  await mkdir(env.MODULE_FILE_DIR, { recursive: true, mode: 0o700 });
  await writeFile(path.join(env.MODULE_FILE_DIR, storedFileName), buf, { mode: 0o600, flag: 'wx' });
  return storedFileName;
}

function storedPath(storedFileName: string): string {
  if (!STORED_NAME.test(storedFileName)) throw new Error('Invalid stored file name');
  return path.join(env.MODULE_FILE_DIR, storedFileName);
}

/** Local backend only: a read stream of the original. */
export const openStoredFile = (storedFileName: string) => createReadStream(storedPath(storedFileName));

/** Object storage only: a short-lived URL that downloads the original under its display name. */
export async function signedDownloadUrl(storedFileName: string, downloadName: string): Promise<string> {
  const { data, error } = await (await bucket()).createSignedUrl(originalPath(storedFileName), 60, { download: downloadName });
  if (error || !data) throw error ?? new Error('Could not sign the download');
  return data.signedUrl;
}

export async function removeStoredFile(storedFileName: string): Promise<void> {
  if (supabase) {
    const { error } = await (await bucket()).remove([originalPath(storedFileName)]);
    if (error) throw error;
    return;
  }
  await unlink(storedPath(storedFileName)).catch((err) => {
    if (err?.code !== 'ENOENT') throw err;
  });
}

// ── Direct uploads (object storage) ─────────────────────────────────────────
// The browser uploads each file straight to a signed staging URL (bypassing
// the hosting platform's request-size limit); the server then fetches it,
// validates and extracts it like any upload, and moves it to originals/.

export interface UploadTarget { uploadId: string; signedUrl: string; originalFileName: string }

/** Cheap pre-checks (name, declared type, declared size) and a signed staging URL per file. */
export async function createUploadTarget(name: string, declaredMime: string, size: number): Promise<UploadTarget> {
  const originalFileName = sanitizeFileName(name);
  const ext = path.extname(originalFileName).slice(1).toLowerCase();
  if (!(ext in MIMES)) throw new FileRejection('Unsupported file type. Upload PDF, DOCX, PPTX or TXT files.');
  const mime = String(declaredMime || '').split(';')[0].trim().toLowerCase();
  if (!MIMES[ext as ModuleFileType].includes(mime)) throw new FileRejection(`The file's type (${mime || 'unknown'}) does not match a .${ext} file.`);
  if (!(size > 0)) throw new FileRejection('The file is empty.');
  if (size > env.MODULE_FILE_MAX_MB * 1024 * 1024) throw new FileRejection(`Each file must be ${env.MODULE_FILE_MAX_MB} MB or smaller.`);
  const uploadId = `staging/${randomUUID()}.${ext}`;
  const { data, error } = await (await bucket()).createSignedUploadUrl(uploadId);
  if (error || !data) throw error ?? new Error('Could not sign the upload');
  return { uploadId, signedUrl: data.signedUrl, originalFileName };
}

/** Bytes of a staged upload (size-checked), or a FileRejection if it isn't there. */
export async function readStagedUpload(uploadId: string): Promise<Buffer> {
  if (!STAGING_ID.test(uploadId)) throw new FileRejection('Unknown upload.');
  const { data, error } = await (await bucket()).download(uploadId);
  if (error || !data) throw new FileRejection('The upload was not received. Try uploading the file again.');
  if (data.size > env.MODULE_FILE_MAX_MB * 1024 * 1024) throw new FileRejection(`Each file must be ${env.MODULE_FILE_MAX_MB} MB or smaller.`);
  return Buffer.from(await data.arrayBuffer());
}

/** Moves a validated staged upload into originals/; returns its stored name. */
export async function promoteStagedUpload(uploadId: string, fileType: ModuleFileType): Promise<string> {
  const storedFileName = `${randomUUID()}.${fileType}`;
  const { error } = await (await bucket()).move(uploadId, originalPath(storedFileName));
  if (error) throw error;
  return storedFileName;
}

/** Best-effort removal of a staged upload that was rejected or abandoned. */
export async function discardStagedUpload(uploadId: string): Promise<void> {
  if (!STAGING_ID.test(uploadId)) return;
  await (await bucket()).remove([uploadId]).catch(() => {});
}

/** Content-Disposition with an ASCII fallback plus the UTF-8 name (RFC 6266/5987). */
export function attachmentHeader(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
