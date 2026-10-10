/**
 * The student's projects on this computer: an index of project metadata plus
 * one stored document per project, in IndexedDB.
 */
import { del, get, set } from 'idb-keyval';
import { parseProject, type ProjectFile } from './format';
import type { BlockMode } from '../blocks/setup';

export interface ProjectMeta {
  id: string;
  name: string;
  mode: BlockMode;
  /** Last change, ms since epoch. */
  updated: number;
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

const INDEX_KEY = 'mb.projects';
const LAST_KEY = 'mb.lastOpened';
const LEGACY_KEY = 'mb.currentProject';
const docKey = (id: string) => `mb.project.${id}`;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export class ProjectLibrary {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly now: () => number = Date.now,
  ) {}

  async list(): Promise<ProjectMeta[]> {
    const index = (await this.kv.get<ProjectMeta[]>(INDEX_KEY)) ?? [];
    return [...index].sort((a, b) => b.updated - a.updated);
  }

  async load(id: string): Promise<ProjectFile | null> {
    const raw = await this.kv.get<string>(docKey(id));
    if (!raw) return null;
    try {
      return parseProject(raw);
    } catch {
      return null;
    }
  }

  async create(p: ProjectFile): Promise<string> {
    const id = newId();
    await this.save(id, p);
    return id;
  }

  async save(id: string, p: ProjectFile): Promise<void> {
    await this.kv.set(docKey(id), JSON.stringify(p));
    const index = (await this.kv.get<ProjectMeta[]>(INDEX_KEY)) ?? [];
    const meta: ProjectMeta = { id, name: p.name, mode: p.mode, updated: this.now() };
    await this.kv.set(INDEX_KEY, [...index.filter((m) => m.id !== id), meta]);
  }

  async duplicate(id: string, name: string): Promise<string | null> {
    const p = await this.load(id);
    return p ? this.create({ ...p, name }) : null;
  }

  async remove(id: string): Promise<void> {
    await this.kv.del(docKey(id));
    const index = (await this.kv.get<ProjectMeta[]>(INDEX_KEY)) ?? [];
    await this.kv.set(INDEX_KEY, index.filter((m) => m.id !== id));
    if ((await this.lastOpened()) === id) await this.kv.del(LAST_KEY);
  }

  async lastOpened(): Promise<string | null> {
    return (await this.kv.get<string>(LAST_KEY)) ?? null;
  }

  async setLastOpened(id: string | null): Promise<void> {
    if (id) await this.kv.set(LAST_KEY, id);
    else await this.kv.del(LAST_KEY);
  }

  /** Move the single auto-saved project of v0.1 into the library (once). */
  async migrateLegacy(): Promise<string | null> {
    const raw = await this.kv.get<string>(LEGACY_KEY);
    if (!raw) return null;
    await this.kv.del(LEGACY_KEY);
    try {
      const id = await this.create(parseProject(raw));
      await this.setLastOpened(id);
      return id;
    } catch {
      return null;
    }
  }
}

/** The browser's library. Storage errors (private mode, quota) are swallowed. */
const idb: KeyValueStore = {
  get: async (k) => {
    try {
      return await get(k);
    } catch {
      return undefined;
    }
  },
  set: async (k, v) => {
    try {
      await set(k, v);
    } catch {
      /* the explicit Save to file still works */
    }
  },
  del: async (k) => {
    try {
      await del(k);
    } catch {
      /* ignore */
    }
  },
};

export const library = new ProjectLibrary(idb);
