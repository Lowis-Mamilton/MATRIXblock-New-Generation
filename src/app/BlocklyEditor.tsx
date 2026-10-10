import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import * as Blockly from 'blockly/core';
import '../blocks/icon/blocks';
import '../blocks/word/blocks';
import { workspaceOptions, type BlockMode } from '../blocks/setup';
import type { SWorkspace } from '../ir/compile';
import type { Lang } from '../i18n/strings';

export interface EditorApi {
  /** Current workspace state, serialized. */
  save(): SWorkspace;
  highlight(blockId: string, on: boolean): void;
  clearHighlights(): void;
  select(blockId: string): void;
  undo(): void;
  redo(): void;
}

interface Props {
  mode: BlockMode;
  lang: Lang;
  initial: SWorkspace;
  onChange(ws: SWorkspace): void;
  onHistory?(h: { canUndo: boolean; canRedo: boolean }): void;
  ref?: Ref<EditorApi>;
}

/**
 * Hosts a Blockly workspace. It is re-created when the mode or language
 * changes (block text is baked in at creation), carrying the current blocks over.
 */
export function BlocklyEditor({ mode, lang, initial, onChange, onHistory, ref }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ws = useRef<Blockly.WorkspaceSvg | null>(null);
  const state = useRef(initial);
  const highlighted = useRef(new Set<string>());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onHistoryRef = useRef(onHistory);
  onHistoryRef.current = onHistory;

  useImperativeHandle(ref, () => ({
    save: () => (ws.current ? (Blockly.serialization.workspaces.save(ws.current) as SWorkspace) : state.current),
    highlight(id, on) {
      if (!ws.current?.getBlockById(id)) return;
      ws.current.highlightBlock(id, on);
      if (on) highlighted.current.add(id);
      else highlighted.current.delete(id);
    },
    clearHighlights() {
      for (const id of highlighted.current) {
        if (ws.current?.getBlockById(id)) ws.current.highlightBlock(id, false);
      }
      highlighted.current.clear();
    },
    undo: () => ws.current?.undo(false),
    redo: () => ws.current?.undo(true),
    select(id) {
      const block = ws.current?.getBlockById(id);
      if (block) {
        Blockly.common.setSelected(block);
        ws.current?.centerOnBlock(id);
      }
    },
  }));

  useEffect(() => {
    const div = host.current!;
    const workspace = Blockly.inject(div, workspaceOptions(mode, lang));
    ws.current = workspace;
    if (import.meta.env.DEV) Object.assign(window, { __mbWorkspace: workspace, __mbBlockly: Blockly });
    Blockly.Events.disable();
    try {
      Blockly.serialization.workspaces.load(state.current as object, workspace);
    } catch (e) {
      console.error('[MATRIXblock] could not load blocks', e);
    } finally {
      Blockly.Events.enable();
    }
    workspace.scrollCenter();

    const listener = (e: Blockly.Events.Abstract) => {
      onHistoryRef.current?.({
        canUndo: workspace.getUndoStack().length > 0,
        canRedo: workspace.getRedoStack().length > 0,
      });
      if (e.isUiEvent) return;
      const saved = Blockly.serialization.workspaces.save(workspace) as SWorkspace;
      state.current = saved;
      onChangeRef.current(saved);
    };
    workspace.addChangeListener(listener);

    const resize = new ResizeObserver(() => Blockly.svgResize(workspace));
    resize.observe(div);

    return () => {
      resize.disconnect();
      state.current = Blockly.serialization.workspaces.save(workspace) as SWorkspace;
      highlighted.current.clear();
      workspace.dispose();
      ws.current = null;
    };
  }, [mode, lang]);

  return <div ref={host} className={`editor editor-${mode}`} />;
}
