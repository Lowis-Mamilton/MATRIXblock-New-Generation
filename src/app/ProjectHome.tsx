import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { library, type ProjectMeta } from '../project/library';
import { IconPreview, WordPreview } from './NewProjectDialog';

interface Props {
  onOpen(id: string): void;
  onNew(): void;
  onImport(): void;
}

function useRelativeTime() {
  const { t, i18n } = useTranslation();
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
  return (ms: number) => {
    const s = Math.round((ms - Date.now()) / 1000);
    if (Math.abs(s) < 60) return t('ui.justNow');
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [
      ['second', 60],
      ['minute', 60],
      ['hour', 24],
      ['day', 30],
      ['month', 12],
    ];
    let v = s;
    for (const [unit, size] of steps) {
      if (Math.abs(v) < size) return rtf.format(v, unit);
      v = Math.round(v / size);
    }
    return rtf.format(v, 'year');
  };
}

/** "My projects": every project saved in this browser. */
export function ProjectHome({ onOpen, onNew, onImport }: Props) {
  const { t } = useTranslation();
  const ago = useRelativeTime();
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);

  const refresh = () => void library.list().then(setProjects);
  useEffect(refresh, []);

  const duplicate = async (p: ProjectMeta) => {
    await library.duplicate(p.id, t('ui.copyOf', { name: p.name }));
    refresh();
  };
  const remove = async (p: ProjectMeta) => {
    if (!window.confirm(t('ui.confirmDelete', { name: p.name }))) return;
    await library.remove(p.id);
    refresh();
  };

  return (
    <div className="home">
      <div className="home-head">
        <h1>{t('ui.myProjects')}</h1>
        <button type="button" className="secondary" onClick={onImport}>{t('ui.openFile')}</button>
        <button type="button" className="primary" onClick={onNew}>{t('ui.newProject')}</button>
      </div>

      {projects && projects.length === 0 && (
        <div className="home-empty">
          <p>{t('ui.noProjects')}</p>
          <button type="button" className="primary" onClick={onNew}>{t('ui.newProject')}</button>
        </div>
      )}

      <ul className="project-grid">
        {projects?.map((p) => (
          <li key={p.id} className="project-card">
            <button type="button" className="project-open" onClick={() => onOpen(p.id)}>
              <span className="project-thumb">{p.mode === 'icon' ? <IconPreview /> : <WordPreview />}</span>
              <strong>{p.name}</strong>
              <span className="project-meta">
                {t('ui.projectMeta', { mode: t(p.mode === 'icon' ? 'ui.iconMode' : 'ui.wordMode'), when: ago(p.updated) })}
              </span>
            </button>
            <div className="project-actions">
              <button type="button" onClick={() => duplicate(p)}>{t('ui.duplicate')}</button>
              <button type="button" className="danger" onClick={() => remove(p)}>{t('ui.delete')}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
