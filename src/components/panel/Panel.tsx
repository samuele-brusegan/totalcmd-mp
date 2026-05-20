import { TabBar } from './TabBar';
import { PathBar } from './PathBar';
import { FileListHeader } from './FileListHeader';
import { FileList } from './FileList';
import { usePanelStore } from '../../stores/panelStore';
import type { PanelSide } from '../../types';

interface PanelProps {
  side: PanelSide;
}

export function Panel({ side }: PanelProps) {
  const activeSide = usePanelStore((s) => s.activeSide);
  const isActive = activeSide === side;

  return (
    <div
      className={`flex flex-col h-full bg-[var(--color-bg-primary)] ${
        isActive ? 'ring-1 ring-[var(--color-accent)] ring-inset' : ''
      }`}
    >
      <TabBar side={side} />
      <PathBar side={side} />
      <FileListHeader side={side} />
      <FileList side={side} />
    </div>
  );
}
