import type { BlockMode } from '../blocks/setup';
import type { SWorkspace } from '../ir/compile';
import { MOTOR_PORTS, type DriveConfig } from '../ir/types';

export const FILE_EXTENSION = '.mbng';
export const FILE_FORMAT = 'matrixblock-ng';
export const FILE_VERSION = 1;

/** Everything that makes up a project; also the `.mbng` file body. */
export interface ProjectFile {
  format: typeof FILE_FORMAT;
  version: number;
  name: string;
  mode: BlockMode;
  drive: DriveConfig;
  workspace: SWorkspace;
}

export const DEFAULT_DRIVE: DriveConfig = { left: 'M1', right: 'M2' };

export function newProject(name: string, mode: BlockMode): ProjectFile {
  const start = mode === 'icon' ? 'i_start' : 'w_when_start';
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    name,
    mode,
    drive: { ...DEFAULT_DRIVE },
    workspace: { blocks: { blocks: [{ type: start, id: 'start', x: 60, y: 60 } as never] } },
  };
}

/** Validate untrusted JSON (a file the user opened) and return a project. */
export function parseProject(text: string): ProjectFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not JSON');
  }
  const p = data as Partial<ProjectFile>;
  if (!p || typeof p !== 'object' || p.format !== FILE_FORMAT) throw new Error('not a MATRIXblock project');
  if (typeof p.version !== 'number' || p.version > FILE_VERSION) throw new Error('made by a newer version');
  if (p.mode !== 'icon' && p.mode !== 'word') throw new Error('unknown block mode');
  if (!p.workspace || typeof p.workspace !== 'object') throw new Error('missing blocks');
  const port = (v: unknown, fallback: DriveConfig['left']) =>
    MOTOR_PORTS.includes(v as never) ? (v as DriveConfig['left']) : fallback;
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    name: typeof p.name === 'string' && p.name.trim() ? p.name : 'project',
    mode: p.mode,
    drive: { left: port(p.drive?.left, DEFAULT_DRIVE.left), right: port(p.drive?.right, DEFAULT_DRIVE.right) },
    workspace: p.workspace,
  };
}
