export type DockSide = 'left' | 'right' | null;
export function previewPosition(x: number, y: number, width: number, height: number, tileWidth: number, tileHeight: number, dock = false) {
  const maxX = Math.max(0, width - tileWidth), maxY = Math.max(0, height - tileHeight);
  const side: DockSide = dock && x < -tileWidth * .25 ? 'left' : dock && x > maxX + tileWidth * .25 ? 'right' : null;
  return { x: side === 'left' ? -tileWidth - 8 : side === 'right' ? width + 8 : Math.min(maxX, Math.max(0, x)), y: Math.min(maxY, Math.max(0, y)), side };
}
