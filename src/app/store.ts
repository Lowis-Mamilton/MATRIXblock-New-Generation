import { create } from 'zustand';
import type { ProjectFile } from '../project/format';
import type { SWorkspace } from '../ir/compile';
import type { DriveConfig } from '../ir/types';
import { saveCurrent } from '../project/storage';

interface AppState {
  project: ProjectFile | null;
  /** Bumped when a different project is loaded so the editor re-mounts. */
  projectKey: number;
  running: boolean;
  simOpen: boolean;
  message: { kind: 'error' | 'info'; text: string } | null;

  loadProject(p: ProjectFile): void;
  updateWorkspace(ws: SWorkspace): void;
  rename(name: string): void;
  setDrive(drive: DriveConfig): void;
  setRunning(running: boolean): void;
  toggleSim(): void;
  showMessage(kind: 'error' | 'info', text: string): void;
  clearMessage(): void;
}

export const useApp = create<AppState>((set, get) => ({
  project: null,
  projectKey: 0,
  running: false,
  simOpen: true,
  message: null,

  loadProject: (project) => set({ project, projectKey: get().projectKey + 1 }),
  updateWorkspace: (workspace) => {
    const p = get().project;
    if (p) set({ project: { ...p, workspace } });
  },
  rename: (name) => {
    const p = get().project;
    if (p) set({ project: { ...p, name } });
  },
  setDrive: (drive) => {
    const p = get().project;
    if (p) set({ project: { ...p, drive } });
  },
  setRunning: (running) => set({ running }),
  toggleSim: () => set({ simOpen: !get().simOpen }),
  showMessage: (kind, text) => set({ message: { kind, text } }),
  clearMessage: () => set({ message: null }),
}));

// Auto-save the current project shortly after every change.
let timer: ReturnType<typeof setTimeout> | undefined;
useApp.subscribe((state, prev) => {
  if (!state.project || state.project === prev.project) return;
  clearTimeout(timer);
  const p = state.project;
  timer = setTimeout(() => void saveCurrent(p), 400);
});
