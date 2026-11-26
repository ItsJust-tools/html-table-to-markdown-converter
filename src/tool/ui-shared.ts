import { DEFAULT_STATE, type Alignment, type ToolState } from './types';

export const ALIGNMENTS: { value: Alignment; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.html === 'string' && typeof v.alignment === 'string' && DEFAULT_STATE !== undefined
  );
}
