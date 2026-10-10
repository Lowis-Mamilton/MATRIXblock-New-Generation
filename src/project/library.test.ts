import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectLibrary, type KeyValueStore } from './library';
import { newProject } from './format';

class MemoryStore implements KeyValueStore {
  data = new Map<string, unknown>();
  async get<T>(key: string) {
    return this.data.get(key) as T | undefined;
  }
  async set(key: string, value: unknown) {
    this.data.set(key, value);
  }
  async del(key: string) {
    this.data.delete(key);
  }
}

let store: MemoryStore;
let lib: ProjectLibrary;
let clock = 1000;

beforeEach(() => {
  store = new MemoryStore();
  clock = 1000;
  lib = new ProjectLibrary(store, () => clock++);
});

describe('ProjectLibrary', () => {
  it('creates, lists (newest first) and loads projects', async () => {
    const a = await lib.create(newProject('A', 'icon'));
    const b = await lib.create(newProject('B', 'word'));
    expect((await lib.list()).map((m) => m.name)).toEqual(['B', 'A']);
    expect((await lib.load(a))?.name).toBe('A');
    expect((await lib.list()).find((m) => m.id === b)?.mode).toBe('word');
  });

  it('saving moves a project to the top and updates its name', async () => {
    const a = await lib.create(newProject('A', 'icon'));
    await lib.create(newProject('B', 'icon'));
    await lib.save(a, { ...newProject('A2', 'icon') });
    const list = await lib.list();
    expect(list[0]).toMatchObject({ id: a, name: 'A2' });
  });

  it('removes projects and forgets the last-opened id', async () => {
    const a = await lib.create(newProject('A', 'icon'));
    await lib.setLastOpened(a);
    await lib.remove(a);
    expect(await lib.list()).toEqual([]);
    expect(await lib.load(a)).toBeNull();
    expect(await lib.lastOpened()).toBeNull();
  });

  it('duplicates a project under a new name', async () => {
    const a = await lib.create(newProject('A', 'word'));
    const copy = await lib.duplicate(a, 'A (copy)');
    expect(copy).not.toBe(a);
    expect((await lib.load(copy!))?.name).toBe('A (copy)');
    expect(await lib.list()).toHaveLength(2);
  });

  it('migrates the single auto-saved project from the first version', async () => {
    await store.set('mb.currentProject', JSON.stringify(newProject('Old', 'icon')));
    const id = await lib.migrateLegacy();
    expect(id).toBeTruthy();
    expect((await lib.list()).map((m) => m.name)).toEqual(['Old']);
    expect(await lib.lastOpened()).toBe(id);
    expect(store.data.has('mb.currentProject')).toBe(false);
    expect(await lib.migrateLegacy()).toBeNull();
  });
});
