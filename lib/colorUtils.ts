export const hexToRgba = (hex: string, alpha = 1) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt('0x' + hex[1] + hex[1]);
      g = parseInt('0x' + hex[2] + hex[2]);
      b = parseInt('0x' + hex[3] + hex[3]);
    } else if (hex.length === 7) {
      r = parseInt('0x' + hex[1] + hex[2]);
      g = parseInt('0x' + hex[3] + hex[4]);
      b = parseInt('0x' + hex[5] + hex[6]);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const hexToHsv = (hex: string) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt('0x' + hex[1] + hex[1]);
      g = parseInt('0x' + hex[2] + hex[2]);
      b = parseInt('0x' + hex[3] + hex[3]);
    } else if (hex.length === 7) {
      r = parseInt('0x' + hex[1] + hex[2]);
      g = parseInt('0x' + hex[3] + hex[4]);
      b = parseInt('0x' + hex[5] + hex[6]);
    }
    
    r /= 255;
    g /= 255;
    b /= 255;
  
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
  
    const d = max - min;
    s = max === 0 ? 0 : d / max;
  
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
  
    return { h: h * 360, s: s * 100, v: v * 100 };
};

export const hsvToHex = (h: number, s: number, v: number) => {
    let r = 0, g = 0, b = 0;
    let i, f, p, q, t;
    
    h = ((h % 360) + 360) % 360;
    h /= 60; // sector 0 to 5; the right end of the hue strip wraps to red
    s /= 100;
    v /= 100;

    i = Math.floor(h);
    f = h - i; // factorial part of h
    p = v * (1 - s);
    q = v * (1 - s * f);
    t = v * (1 - s * (1 - f));
  
    switch (i) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      default: r = v; g = p; b = q; break;
    }
  
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
  
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Keep user-selected pastel accents readable on white surfaces and buttons. */
export function accentAppearance(color: string) {
    const hex = /^#[\da-f]{6}$/i.test(color) ? color : '#c33367';
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const toHex = (values: number[]) => '#' + values.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    const luminance = (values: number[]) => values.map(v => { const x = v / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const ratio = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
    const white = [255, 255, 255], ink = [16, 19, 51], black = [0, 0, 0];
    let start = channels.map(v => v + (255 - v) * .05);
    let foreground = white;
    if (Math.min(ratio(channels, white), ratio(start, white)) < 4.6) foreground = Math.min(ratio(channels, ink), ratio(start, ink)) >= 4.6 ? ink : black;
    if (Math.min(ratio(channels, foreground), ratio(start, foreground)) < 4.6) { start = channels; foreground = ratio(channels, white) >= 4.6 ? white : black; }
    let text = channels;
    while (ratio(text, white) < 4.6) text = text.map(v => v * .9);
    return { foreground: toHex(foreground), start: toHex(start), ink: toHex(text), light: toHex(channels.map(v => v * .08 + 255 * .92)) };
}
