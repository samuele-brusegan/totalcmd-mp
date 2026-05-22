import { usePanelStore } from '../../stores/panelStore';
import { useUIStore } from '../../stores/uiStore';

interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  separator?: boolean;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

export function MenuBar() {
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const activeSide = usePanelStore((s) => s.activeSide);
  const getActiveTab = usePanelStore((s) => s.getActiveTab);
  const getSelectedPaths = usePanelStore((s) => s.getSelectedPaths);
  const openDialog = useUIStore((s) => s.openDialog);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const menus: Menu[] = [
    {
      label: 'File',
      items: [
        { label: 'New Tab', shortcut: 'Ctrl+T', action: () => usePanelStore.getState().addTab(activeSide, getActiveTab(activeSide)?.currentPath || '/') },
        { label: 'Close Tab', shortcut: 'Ctrl+W', action: () => usePanelStore.getState().closeTab(activeSide, usePanelStore.getState()[activeSide].activeTabIndex) },
        { label: 'Refresh', shortcut: 'F2', action: () => refreshPanel(activeSide), separator: true },
        { label: 'Quick Connect...', shortcut: 'Ctrl+Q', action: () => openDialog('quick-connect') },
        { label: 'Connection Manager...', shortcut: 'Ctrl+P', action: () => openDialog('connection-manager') },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => usePanelStore.getState().selectAll(activeSide) },
        { label: 'Invert Selection', shortcut: 'Num *', action: () => usePanelStore.getState().invertSelection(activeSide) },
        { label: 'Quick Filter', shortcut: 'Ctrl+S', action: () => openDialog('quick-filter'), separator: true },
        { label: 'Search Files...', shortcut: 'Ctrl+F', action: () => openDialog('search') },
        { label: 'Multi-Rename...', shortcut: 'Ctrl+M', action: () => {
          const paths = getSelectedPaths(activeSide);
          if (paths.length > 0) openDialog('multi-rename', { paths });
        }},
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'View File', shortcut: 'F3', action: () => {
          const tab = getActiveTab(activeSide);
          const file = tab?.files[tab.cursorIndex];
          if (file && !file.isDirectory) openDialog('file-viewer', { path: file.path });
        }},
        { label: 'Toggle Theme', action: toggleTheme, separator: true },
        { label: 'Settings...', action: () => openDialog('settings') },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Compare Directories', action: () => openDialog('dir-compare') },
        { label: 'Change Permissions...', action: () => {
          const tab = getActiveTab(activeSide);
          const file = tab?.files[tab.cursorIndex];
          if (file) openDialog('chmod', {
            path: file.path,
            permissions: file.permissions,
            isRemote: tab?.isRemote,
            connectionId: tab?.connectionId,
          });
        }},
        { label: 'Drive Selector (Left)', shortcut: 'Alt+F1', action: () => openDialog('drive-selector', { side: 'left' }) },
        { label: 'Drive Selector (Right)', shortcut: 'Alt+F2', action: () => openDialog('drive-selector', { side: 'right' }) },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Help', shortcut: 'F1', action: () => openDialog('help') },
        { label: 'About TotalCMD-MP', action: () => openDialog('help') },
      ],
    },
  ];

  return (
    <div className="flex items-center h-7 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-1 text-xs">
      {menus.map((menu) => (
        <div key={menu.label} className="relative group">
          <button className="px-3 py-1 hover:bg-[var(--color-bg-hover)] rounded text-[var(--color-text-secondary)]">
            {menu.label}
          </button>
          <div className="absolute left-0 top-full hidden group-hover:block bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-lg z-50 min-w-[200px]">
            {menu.items.map((item, i) => (
              <div key={i}>
                {item.separator && i > 0 && (
                  <div className="border-t border-[var(--color-border)] my-0.5" />
                )}
                <button
                  onClick={item.action}
                  className="flex items-center justify-between w-full text-left px-3 py-1.5 hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="text-[10px] text-[var(--color-text-muted)] ml-4">{item.shortcut}</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
