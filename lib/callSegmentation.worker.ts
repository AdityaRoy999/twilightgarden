import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
let segmenter: ImageSegmenter | undefined;
// Imported only when background blur is chosen. CPU inference runs off the UI thread.
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      if (!await FilesetResolver.isSimdSupported(true)) throw new Error('Background blur requires WebAssembly SIMD.');
      const files = await FilesetResolver.forVisionTasks(`${data.base}call-effects/wasm`, true);
      segmenter = await ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${data.base}call-effects/selfie_segmenter.tflite`, delegate: 'CPU' },
        runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame' && segmenter) {
      const bitmap: ImageBitmap = data.bitmap;
      try {
        segmenter.segmentForVideo(bitmap, data.now, result => {
          const mask = result.confidenceMasks?.[0];
          if (!mask) throw new Error('Missing segmentation mask');
          const values = mask.getAsFloat32Array(), pixels = new Uint8ClampedArray(values.length * 4);
          for (let i = 0; i < values.length; i++) {
            pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = 255;
            pixels[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (values[i] - .25) / .5)) * 255);
          }
          self.postMessage({ type: 'mask', width: mask.width, height: mask.height, pixels: pixels.buffer }, { transfer: [pixels.buffer] });
        });
      } finally { bitmap.close(); }
    }
  } catch (error) { console.error('Local camera segmentation:', error); self.postMessage({ type: 'error' }); }
};
