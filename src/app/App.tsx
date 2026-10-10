import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BlocklyEditor, type EditorApi } from './BlocklyEditor';
import { TopBar } from './TopBar';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectHome } from './ProjectHome';
import { SettingsDialog } from './SettingsDialog';
import { ExportDialog } from './ExportDialog';
import { useApp } from './store';
import { connectBoard, connectedBoard, disconnectBoard, runProgram, stopProgram } from './engine';
import { FirmwareMismatch } from '../devices/ble/BleR4Device';
import { bluetoothAvailable } from '../devices/ble/webBluetooth';
import { isIOS } from '../platform';
import { unlockAudio } from './audio';
import { SimulatorPanel } from '../simulator/SimulatorPanel';
import { compile, CompileError } from '../ir/compile';
import { newProject, type ProjectFile } from '../project/format';
import { exportProject, importProject } from '../project/storage';
import { library } from '../project/library';
import type { BlockMode } from '../blocks/setup';
import type { Example } from '../examples';
import type { Lang } from '../i18n/strings';

export function App() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { project, projectKey, simOpen, message } = useApp();
  const app = useApp.getState;
  const editor = useRef<EditorApi>(null);
  const [booting, setBooting] = useState(true);
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualExport, setManualExport] = useState<{ text: string; fileName: string } | null>(null);

  // Reopen the project the student was last working on.
  useEffect(() => {
    void (async () => {
      await library.migrateLegacy();
      const id = await library.lastOpened();
      const p = id ? await library.load(id) : null;
      if (id && p) app().openProject(id, p);
      setBooting(false);
    })();
  }, [app]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => app().clearMessage(), 5000);
    return () => clearTimeout(timer);
  }, [message, app]);

  /** Flush pending edits of the open project before leaving it. */
  const saveOpen = async () => {
    const { project: p, projectId } = app();
    if (p && projectId && editor.current) await library.save(projectId, { ...p, workspace: editor.current.save() });
  };

  const open = async (p: ProjectFile, id?: string) => {
    stopProgram();
    await saveOpen();
    const projectId = id ?? (await library.create(p));
    app().openProject(projectId, p);
    setCreating(false);
  };

  const openById = async (id: string) => {
    const p = await library.load(id);
    if (p) await open(p, id);
    else app().showMessage('error', t('ui.openFailed'));
  };

  const goHome = async () => {
    stopProgram();
    await saveOpen();
    app().closeProject();
  };

  const run = () => {
    if (!project || !editor.current) return;
    unlockAudio();
    editor.current.clearHighlights();
    let program;
    try {
      program = compile(editor.current.save(), project.sensors);
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

  const toggleConnection = async () => {
    if (!bluetoothAvailable()) {
      app().showMessage('info', t(isIOS() ? 'ui.noBluetoothIOS' : 'ui.noBluetooth'));
      return;
    }
    if (connectedBoard()) {
      disconnectBoard();
      app().setConnection({ status: 'idle' });
      return;
    }
    app().setConnection({ status: 'connecting' });
    try {
      const board = await connectBoard(() => {
        app().setConnection({ status: 'idle' });
        app().showMessage('error', t('ui.connectionLost'));
      });
      app().setConnection({ status: 'connected', name: board.name, firmware: board.firmware });
      app().showMessage('info', t('ui.connected', { name: board.name }));
    } catch (e) {
      app().setConnection({ status: 'idle' });
      // The student closed the device chooser: nothing to report.
      if ((e as Error).name === 'NotFoundError') return;
      if (e instanceof FirmwareMismatch) app().showMessage('error', t('ui.firmwareMismatch', { version: e.firmware }));
      else app().showMessage('error', t('ui.connectFailed') + (e as Error).message);
    }
  };

  const importFile = async () => {
    try {
      const p = await importProject();
      if (p) await open(p);
    } catch (e) {
      app().showMessage('error', t('ui.openFailed') + (e as Error).message);
    }
  };

  const createBlank = (mode: BlockMode) => void open(newProject(t('ui.untitled'), mode));
  const createFromExample = (e: Example) =>
    void open({ ...newProject(t(`examples.${e.key}.title`), e.mode), workspace: structuredClone(e.workspace) });

  const exportFile = async () => {
    if (!project || !editor.current) return;
    const result = await exportProject({ ...project, workspace: editor.current.save() });
    if (result.kind === 'manual') setManualExport(result);
  };

  if (booting) return null;

  return (
    <div className={`app ${project ? `mode-${project.mode}` : 'at-home'}`}>
      <TopBar
        onHome={goHome}
        onNew={() => setCreating(true)}
        onOpen={importFile}
        onSave={() => void exportFile()}
        onSettings={() => setSettingsOpen(true)}
        onUndo={() => editor.current?.undo()}
        onRedo={() => editor.current?.redo()}
        onConnect={() => void toggleConnection()}
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
            onHistory={(h) => app().setHistory(h)}
          />
        ) : (
          <ProjectHome onOpen={(id) => void openById(id)} onNew={() => setCreating(true)} onImport={importFile} />
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

      {creating && (
        <NewProjectDialog onBlank={createBlank} onExample={createFromExample} onCancel={() => setCreating(false)} />
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {manualExport && (
        <ExportDialog fileName={manualExport.fileName} text={manualExport.text} onClose={() => setManualExport(null)} />
      )}
      {message && (
        <div className={`toast toast-${message.kind}`} role="alert" onClick={() => app().clearMessage()}>
          {message.text}
        </div>
      )}
    </div>
  );
}
