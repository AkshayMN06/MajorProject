import { DocumentRejected, extractRawText, type ModuleFileType } from './documentText';

// Child-process entry point for text extraction (forked by moduleFiles.ts).
// Receives one document, replies once, exits. The parent kills this process
// on timeout, so runaway parsing can't outlive the request.
process.once('message', async (msg: { fileType: ModuleFileType; data: Uint8Array }) => {
  try {
    const result = await extractRawText(msg.fileType, Buffer.from(msg.data));
    process.send!({ ok: true, ...result });
  } catch (err) {
    process.send!(err instanceof DocumentRejected ? { ok: false, rejected: err.message } : { ok: false, failed: true });
  }
  process.disconnect();
});
