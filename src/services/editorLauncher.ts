import { useSettingsStore } from '../stores/settingsStore';
import {
  prepareRemoteForEdit,
  spawnExternalEditor,
} from './editor';

interface OpenEditorOptions {
  filePath: string;
  displayName?: string;
  remote?: { connectionId: string; remotePath: string };
}

async function openInternalWindow(args: {
  localPath: string;
  displayName: string;
  remote?: { connectionId: string; remotePath: string; originalMtimeMs: number };
}): Promise<void> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const params = new URLSearchParams();
  params.set('path', args.localPath);
  params.set('name', args.displayName);
  if (args.remote) {
    params.set('connectionId', args.remote.connectionId);
    params.set('remotePath', args.remote.remotePath);
    params.set('originalMtimeMs', String(args.remote.originalMtimeMs));
  }
  const label = `editor-${Date.now()}`;
  const url = `index.html#editor?${params.toString()}`;
  new WebviewWindow(label, {
    url,
    title: `Edit — ${args.displayName}`,
    width: 900,
    height: 700,
    decorations: false,
    center: true,
  });
}

export async function openEditor(opts: OpenEditorOptions): Promise<void> {
  const { editorMode, externalEditorCommand } = useSettingsStore.getState();
  const displayName =
    opts.displayName ?? opts.filePath.split(/[/\\]/).pop() ?? 'edit';

  // For remote files we need a local temp copy first.
  let localPath = opts.filePath;
  let originalMtimeMs: number | undefined;
  if (opts.remote) {
    const session = await prepareRemoteForEdit(
      opts.remote.connectionId,
      opts.remote.remotePath
    );
    localPath = session.localPath;
    originalMtimeMs = session.originalMtimeMs;
  }

  if (editorMode === 'external') {
    if (!externalEditorCommand.trim()) {
      throw new Error('External editor command not configured (Settings → Editor)');
    }
    await spawnExternalEditor(externalEditorCommand, localPath);
    // Note: for external + remote, we don't auto-upload because we cannot
    // reliably wait for the user to close the editor (it may detach).
    // The internal editor handles re-upload automatically.
    return;
  }

  await openInternalWindow({
    localPath,
    displayName,
    remote:
      opts.remote && originalMtimeMs !== undefined
        ? {
            connectionId: opts.remote.connectionId,
            remotePath: opts.remote.remotePath,
            originalMtimeMs,
          }
        : undefined,
  });
}
