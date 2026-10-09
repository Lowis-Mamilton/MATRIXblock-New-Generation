/** Browser persistence (IndexedDB auto-save) and `.mbng` file import/export. */
import { get, set } from 'idb-keyval';
import { FILE_EXTENSION, parseProject, type ProjectFile } from './format';

const CURRENT_KEY = 'mb.currentProject';

export async function loadCurrent(): Promise<ProjectFile | null> {
  try {
    const raw = await get<string>(CURRENT_KEY);
    return raw ? parseProject(raw) : null;
  } catch {
    return null;
  }
}

export async function saveCurrent(p: ProjectFile): Promise<void> {
  try {
    await set(CURRENT_KEY, JSON.stringify(p));
  } catch {
    /* private mode or storage full: the explicit Save still works */
  }
}

const fileName = (p: ProjectFile) => `${p.name.replace(/[\/:*?"<>|]+/g, '_') || 'project'}${FILE_EXTENSION}`;

type SavePicker = (opts: object) => Promise<{ createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }> }>;

/** Save to a file: native "Save as" dialog when available, otherwise a download. */
export async function exportProject(p: ProjectFile): Promise<void> {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: fileName(p),
        types: [{ description: 'MATRIXblock', accept: { 'application/json': [FILE_EXTENSION] } }],
      });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      // Fall through to a plain download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(p);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask the user for a `.mbng` file; resolves null if they cancel. */
export function importProject(): Promise<ProjectFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${FILE_EXTENSION},application/json`;
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
