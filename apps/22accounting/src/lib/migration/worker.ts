// src/lib/migration/worker.ts
// This file runs inside a Web Worker — no Node.js / server imports allowed.
import { XeroParser } from './xero.parser';
import { QuickBooksParser } from './quickbooks.parser';
import type { MigrationSourceId } from './types';

self.onmessage = async (e: MessageEvent<{
  files: File[];
  sourceId: MigrationSourceId;
  cutoffDate: string;
}>) => {
  const { files, sourceId, cutoffDate } = e.data;
  try {
    const parser = sourceId === 'xero' ? new XeroParser() : new QuickBooksParser();
    const data = await parser.parse(files, cutoffDate);
    self.postMessage({ type: 'done', data });
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message });
  }
};
