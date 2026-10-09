import { describe, expect, it } from 'vitest';
import { newProject, parseProject } from './format';

describe('project file format', () => {
  it('round-trips a project', () => {
    const p = newProject('My robot', 'word');
    expect(parseProject(JSON.stringify(p))).toEqual(p);
  });

  it('rejects files that are not MATRIXblock projects', () => {
    expect(() => parseProject('hello')).toThrow();
    expect(() => parseProject('{"format":"other"}')).toThrow();
    expect(() => parseProject(JSON.stringify({ ...newProject('x', 'icon'), version: 99 }))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...newProject('x', 'icon'), mode: 'python' }))).toThrow();
  });

  it('repairs bad drive ports and empty names', () => {
    const p = parseProject(JSON.stringify({ ...newProject('', 'icon'), drive: { left: 'M9', right: 'M3' } }));
    expect(p.drive).toEqual({ left: 'M1', right: 'M3' });
    expect(p.name).toBe('project');
  });
});
