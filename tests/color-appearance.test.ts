import { expect, it } from 'vitest';
import { accentAppearance, hsvToHex } from '../lib/colorUtils';
function luminance(hex: string) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((total, x, i) => total + x * [.2126, .7152, .0722][i], 0); }
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
it('wraps the hue strip endpoint to the same red as its start', () => {
  expect(hsvToHex(360, 100, 100)).toBe('#ff0000');
  expect(hsvToHex(0, 100, 100)).toBe('#ff0000');
});
it.each(['#c33367', '#f59ac2', '#90eacb', '#ffcf85', '#ffffff', '#000000', '#777777', '#767676'])('keeps buttons and accent text readable with %s', color => {
  const result = accentAppearance(color);
  expect(contrast(result.foreground, color)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(result.foreground, result.start)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(result.ink, '#ffffff')).toBeGreaterThanOrEqual(4.5);
});
