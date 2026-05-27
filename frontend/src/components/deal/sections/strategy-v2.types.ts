import { createContext } from 'react';

export interface HoverCtx {
  hoveredEvidenceRef: string | null;
  setHoveredEvidenceRef: (ref: string | null) => void;
}

export const HoverContext = createContext<HoverCtx>({
  hoveredEvidenceRef: null,
  setHoveredEvidenceRef: () => {},
});
