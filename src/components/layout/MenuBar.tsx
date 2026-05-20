import { usePanelStore } from '../../stores/panelStore';
import { useUIStore } from '../../stores/uiStore';

export function MenuBar() {
  const refreshPanel = usePanelStore((s) => s.refreshPanel);
  const activeSide = usePanelStore((s) => s.activeSide);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const menus = [
    {
      label: 'File',
      items: [
        { label: 'Refresh', action: () => refreshPanel(activeSide) },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Toggle Theme', action: toggleTheme },
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
          <div className="absolute left-0 top-full hidden group-hover:block bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-lg z-50 min-w-[160px]">
            {menu.items.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="block w-full text-left px-3 py-1.5 hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
