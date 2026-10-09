import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlocklyEditor, type EditorApi } from './BlocklyEditor';
import { TopBar } from './TopBar';
import { ModePicker } from './ModePicker';
import { SettingsDialog } from './SettingsDialog';
import { useApp } from './store';
import { runProgram, stopProgram } from './engine';
import { unlockAudio } from './audio';
import { SimulatorPanel } from '../simulator/SimulatorPanel';
import { compile, CompileError } from '../ir/compile';
import { newProject } from '../project/format';
import { exportProject, importProject, loadCurrent } from '../project/storage';
import type { BlockMode } from '../blocks/setup';
import type { Lang } from '../i18n/strings';

export function App() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { project, projectKey, simOpen, message } = useApp();
  const app = useApp.getState;
  const editor = useRef<EditorApi>(null);
  const [booting, setBooting] = useState(true);
  const [picking, setPicking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void loadCurrent().then((p) => {
      if (p) app().loadProject(p);
      setBooting(false);
    });
  }, [app]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => app().clearMessage(), 5000);
    return () => clearTimeout(timer);
  }, [message, app]);

  const run = () => {
    if (!project || !editor.current) return;
    unlockAudio();
    editor.current.clearHighlights();
    let program;
    try {
      program = compile(editor.current.save());
    } catch (e) {
      if (e instanceof CompileError) editor.current.select(e.blockId);
      app().showMessage('error', t('ui.compileError') + (e as Error).message);
      return;
    }
    void runProgram(program, project.drive, {
      onHighlight: (id, on) => editor.current?.highlight(id, on),
      onRunningChange: (running) => {
        app().setRunning(running);
        if (!running) editor.current?.clearHighlights();
      },
    });
  };

  const create = (mode: BlockMode) => {
    stopProgram();
    app().loadProject(newProject(t('ui.untitled'), mode));
    setPicking(false);
  };

  const open = async () => {
    try {
      const p = await importProject();
      if (p) {
        stopProgram();
        app().loadProject(p);
      }
    } catch (e) {
      app().showMessage('error', t('ui.openFailed') + (e as Error).message);
    }
  };

  const save = () => {
    if (project && editor.current) void exportProject({ ...project, workspace: editor.current.save() });
  };

  const startNew = () => {
    if (!project || window.confirm(t('ui.confirmNew'))) setPicking(true);
  };

  if (booting) return null;

  return (
    <div className={`app ${project ? `mode-${project.mode}` : ''}`}>
      <TopBar
        onNew={startNew}
        onOpen={open}
        onSave={save}
        onSettings={() => setSettingsOpen(true)}
        onRun={run}
        onStop={stopProgram}
      />
      <main className={`main ${simOpen ? 'sim-open' : ''}`}>
        {project ? (
          <BlocklyEditor
            key={projectKey}
            ref={editor}
            mode={project.mode}
            lang={lang}
            initial={project.workspace}
            onChange={(ws) => app().updateWorkspace(ws)}
          />
        ) : (
          <div className="editor" />
        )}
        <aside className="sim-panel" aria-label={t('ui.simulator')}>
          <button
            type="button"
            className="sim-toggle"
            onClick={() => app().toggleSim()}
            aria-expanded={simOpen}
            title={simOpen ? t('ui.hideSimulator') : t('ui.showSimulator')}
          >
            <span aria-hidden>{simOpen ? '›' : '‹'}</span>
            <span className="sim-toggle-label">{t('ui.simulator')}</span>
          </button>
          {simOpen && <SimulatorPanel />}
        </aside>
      </main>

      {(picking || !project) && <ModePicker onPick={create} onCancel={project ? () => setPicking(false) : undefined} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {message && (
        <div className={`toast toast-${message.kind}`} role="alert" onClick={() => app().clearMessage()}>
          {message.text}
        </div>
      )}
    </div>
  );
}
