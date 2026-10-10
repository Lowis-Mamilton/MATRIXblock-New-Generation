import { create } from 'zustand';
import type { ProjectFile } from '../project/format';
import type { SWorkspace } from '../ir/compile';
import type { DriveConfig, SensorConfig } from '../ir/types';
import { library } from '../project/library';

interface AppState {
  /** The open project, or null on the "My projects" home screen. */
  project: ProjectFile | null;
  projectId: string | null;
  /** Bumped when a different project is opened so the editor re-mounts. */
  projectKey: number;
  running: boolean;
  /** Simulator open beside the editor (wide screens). */
  sideOpen: boolean;
  /** Simulator sheet expanded (narrow screens). */
  sheetOpen: boolean;
  history: { canUndo: boolean; canRedo: boolean };
  /** BLE board connection. */
  connection: { status: 'idle' | 'connecting' | 'connected'; name?: string; firmware?: string };
  message: { kind: 'error' | 'info'; text: string } | null;

  openProject(id: string, p: ProjectFile): void;
  closeProject(): void;
  updateWorkspace(ws: SWorkspace): void;
  rename(name: string): void;
  setDrive(drive: DriveConfig): void;
  setSensors(sensors: SensorConfig): void;
  setRunning(running: boolean): void;
  setHistory(history: { canUndo: boolean; canRedo: boolean }): void;
  setConnection(connection: AppState['connection']): void;
  toggleSide(): void;
  toggleSheet(): void;
  showMessage(kind: 'error' | 'info', text: string): void;
  clearMessage(): void;
}

export const useApp = create<AppState>((set, get) => {
  const patch = (fields: Partial<ProjectFile>) => {
    const p = get().project;
    if (p) set({ project: { ...p, ...fields } });
  };
  return {
    project: null,
    projectId: null,
    projectKey: 0,
    running: false,
    sideOpen: true,
    sheetOpen: false,
    history: { canUndo: false, canRedo: false },
    connection: { status: 'idle' },
    message: null,

    openProject: (projectId, project) => {
      set({ project, projectId, projectKey: get().projectKey + 1, history: { canUndo: false, canRedo: false } });
      void library.setLastOpened(projectId);
    },
    closeProject: () => {
      set({ project: null, projectId: null });
      void library.setLastOpened(null);
    },
    updateWorkspace: (workspace) => patch({ workspace }),
    rename: (name) => patch({ name }),
    setDrive: (drive) => patch({ drive }),
    setSensors: (sensors) => patch({ sensors }),
    setRunning: (running) => set({ running }),
    setHistory: (history) => set({ history }),
    setConnection: (connection) => set({ connection }),
    toggleSide: () => set({ sideOpen: !get().sideOpen }),
    toggleSheet: () => set({ sheetOpen: !get().sheetOpen }),
    showMessage: (kind, text) => set({ message: { kind, text } }),
    clearMessage: () => set({ message: null }),
  };
});

// Auto-save the open project shortly after every change.
let timer: ReturnType<typeof setTimeout> | undefined;
useApp.subscribe((state, prev) => {
  if (!state.project || !state.projectId || state.project === prev.project) return;
  // Opening a project is not a change worth saving (it would reorder the list).
  if (state.projectKey !== prev.projectKey) return;
  clearTimeout(timer);
  const { project, projectId } = state;
  timer = setTimeout(() => void library.save(projectId, project), 400);
});
