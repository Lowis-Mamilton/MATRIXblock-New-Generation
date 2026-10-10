/** `.mbng` project file import / export. */
import { FILE_EXTENSION, parseProject, type ProjectFile } from './format';
import { isIOS } from '../platform';

export const projectFileName = (p: ProjectFile) =>
  `${p.name.replace(/[\\/:*?"<>|]+/g, '_') || 'project'}${FILE_EXTENSION}`;

type SavePicker = (opts: object) => Promise<{ createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }> }>;

/**
 * How a project can leave the browser, best first:
 * - `picker`: native "Save as" dialog (Chrome / Edge on desktop)
 * - `share`: share sheet with the file, then "Save to Files" (iOS Safari)
 * - `download`: a plain `<a download>` (other desktop / Android browsers)
 * - `manual`: show the project text to copy or share (always works)
 *
 * iOS in-app browsers such as Bluefy silently drop `<a download>`, so iOS never uses it.
 */
export type ExportMethod = 'picker' | 'share' | 'download' | 'manual';

export function exportMethods(c: { savePicker: boolean; shareFiles: boolean; ios: boolean }): ExportMethod[] {
  const methods: ExportMethod[] = [];
  if (c.savePicker) methods.push('picker');
  if (c.shareFiles) methods.push('share');
  if (!c.ios) methods.push('download');
  methods.push('manual');
  return methods;
}

export type ExportResult = { kind: 'done' } | { kind: 'cancelled' } | { kind: 'manual'; text: string; fileName: string };

const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError';

/** Save the project to a file using the best method this browser supports. */
export async function exportProject(p: ProjectFile): Promise<ExportResult> {
  const text = JSON.stringify(p, null, 2);
  const name = projectFileName(p);
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  const file = typeof File !== 'undefined' ? new File([text], name, { type: 'application/json' }) : null;
  let shareFiles = false;
  try {
    shareFiles = !!file && !!navigator.canShare?.({ files: [file] });
  } catch {
    shareFiles = false;
  }

  for (const method of exportMethods({ savePicker: !!picker, shareFiles, ios: isIOS() })) {
    try {
      switch (method) {
        case 'picker': {
          const handle = await picker!({
            suggestedName: name,
            types: [{ description: 'MATRIXblock', accept: { 'application/json': [FILE_EXTENSION] } }],
          });
          const w = await handle.createWritable();
          await w.write(new Blob([text], { type: 'application/json' }));
          await w.close();
          return { kind: 'done' };
        }
        case 'share':
          await navigator.share({ files: [file!], title: p.name });
          return { kind: 'done' };
        case 'download': {
          const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          return { kind: 'done' };
        }
        case 'manual':
          return { kind: 'manual', text, fileName: name };
      }
    } catch (e) {
      if (isAbort(e)) return { kind: 'cancelled' };
      // Not allowed here (e.g. share without a user gesture): try the next method.
    }
  }
  return { kind: 'manual', text, fileName: name };
}

/** Ask the user for a project file; resolves null if they cancel. */
export function importProject(): Promise<ProjectFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    // iOS does not know the .mbng type and would grey the files out, so it gets no filter.
    if (!isIOS()) input.accept = `${FILE_EXTENSION},.json,.txt,application/json,text/plain`;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(parseProject(await file.text()));
      } catch (e) {
        reject(e);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
