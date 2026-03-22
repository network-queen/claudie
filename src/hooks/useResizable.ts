import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizableOptions {
  direction: 'horizontal' | 'vertical';
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  inverted?: boolean; // drag up = grow (for bottom panels)
  storageKey?: string;
}

export function useResizable({ direction, initialSize, minSize = 100, maxSize = 800, inverted = false, storageKey }: UseResizableOptions) {
  const [size, setSize] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`claudie-resize-${storageKey}`);
        if (saved) return Math.max(minSize, Math.min(maxSize, parseInt(saved, 10)));
      } catch {}
    }
    return initialSize;
  });

  const dragging = useRef(false);
  const startPos = useRef(0);
  const startSize = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSize.current = size;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [size, direction]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const pos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = pos - startPos.current;
      const newSize = Math.max(minSize, Math.min(maxSize, startSize.current + (inverted ? -delta : delta)));
      setSize(newSize);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (storageKey) {
        try { localStorage.setItem(`claudie-resize-${storageKey}`, String(size)); } catch {}
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [direction, minSize, maxSize, inverted, size, storageKey]);

  return { size, onMouseDown };
}
