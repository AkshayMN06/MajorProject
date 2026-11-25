import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

// Document parsers. Only ever run inside the extraction child process
// (extractWorker.ts), so a slow or hostile document can be killed without
// affecting the server.

export type ModuleFileType = 'pdf' | 'docx' | 'pptx' | 'txt';

export const MAX_PDF_PAGES = 300;
const MAX_ZIP_UNCOMPRESSED = 100 * 1024 * 1024; // zip-bomb guard for DOCX/PPTX

/** A document that can't be opened (damaged, encrypted, wrong format). */
export class DocumentRejected extends Error {}

async function openOfficeZip(buf: Buffer, requiredEntry: string, label: string): Promise<JSZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new DocumentRejected(`This ${label} file is damaged and cannot be opened.`);
  }
  let total = 0;
  zip.forEach((_p, entry) => {
    total += (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  });
  if (total > MAX_ZIP_UNCOMPRESSED) throw new DocumentRejected(`This ${label} file expands to more than 100 MB and was rejected.`);
  if (!zip.file(requiredEntry)) throw new DocumentRejected(`This is not a valid ${label} document.`);
  return zip;
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

async function extractPptx(buf: Buffer): Promise<string> {
  const zip = await openOfficeZip(buf, 'ppt/presentation.xml', 'PowerPoint');
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/g)!.pop()) - Number(b.match(/\d+/g)!.pop()));
  const parts: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await zip.file(name)!.async('string');
    const paragraphs = xml.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1])).join('')).filter((t) => t.trim());
    if (paragraphs.length) parts.push(`## Slide ${i + 1}\n\n${paragraphs.join('\n')}`);
  }
  return parts.join('\n\n');
}

async function extractDocx(buf: Buffer): Promise<string> {
  await openOfficeZip(buf, 'word/document.xml', 'Word');
  try {
    return (await mammoth.extractRawText({ buffer: buf })).value;
  } catch {
    throw new DocumentRejected('This Word file is damaged and cannot be read.');
  }
}

async function extractPdf(buf: Buffer): Promise<{ text: string; truncatedPages: boolean }> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    // pageJoiner '' drops the library's default "-- 1 of N --" page markers.
    const result = await parser.getText({ first: MAX_PDF_PAGES, pageJoiner: '' });
    return { text: result.text, truncatedPages: (result.total ?? 0) > MAX_PDF_PAGES };
  } catch (err: any) {
    if (err?.name === 'PasswordException') throw new DocumentRejected('This PDF is password-protected. Remove the password and upload it again.');
    throw new DocumentRejected('This PDF is damaged and cannot be read.');
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function extractRawText(fileType: ModuleFileType, buf: Buffer): Promise<{ text: string; note: string | null }> {
  if (fileType === 'pdf') {
    const pdf = await extractPdf(buf);
    return { text: pdf.text, note: pdf.truncatedPages ? `Only the first ${MAX_PDF_PAGES} pages were extracted.` : null };
  }
  if (fileType === 'docx') return { text: await extractDocx(buf), note: null };
  if (fileType === 'pptx') return { text: await extractPptx(buf), note: null };
  return { text: buf.toString('utf8'), note: null };
}
