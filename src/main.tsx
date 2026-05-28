import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { EditorWindow } from './components/editor/EditorWindow';
import './styles/globals.css';

function bootstrap() {
  // The internal editor opens as a separate Tauri window with a special URL
  // hash so we can mount a different React tree without bundling a second
  // entry-point.
  if (window.location.hash.startsWith('#editor')) {
    const params = new URLSearchParams(window.location.hash.slice('#editor?'.length));
    const filePath = params.get('path') || '';
    const displayName = params.get('name') || filePath.split(/[/\\]/).pop() || 'edit';
    const connectionId = params.get('connectionId');
    const remotePath = params.get('remotePath');
    const originalMtimeMs = Number(params.get('originalMtimeMs'));
    const remote =
      connectionId && remotePath && Number.isFinite(originalMtimeMs)
        ? { connectionId, remotePath, originalMtimeMs }
        : undefined;
    return (
      <EditorWindow filePath={filePath} displayName={displayName} remote={remote} />
    );
  }
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{bootstrap()}</StrictMode>
);
