import type { CameraEffect } from './callEffects';
/** Two GPU passes for a separable Gaussian blur. No full video-frame readback,
 * CSS blur, or per-frame React updates. Masks are uploaded only when changed. */
export function createCallFrameRenderer(canvas: HTMLCanvasElement, effect: CameraEffect) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) throw new Error('Camera effects need graphics acceleration. Your natural camera stays on.');
  const vertex = `attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision mediump float; varying vec2 uv;
    uniform sampler2D camera, mask, blurred; uniform vec2 stepSize;
    uniform int pass, tone; uniform bool useBlur, maskReady;
    vec4 blurCamera(){vec4 c=texture2D(camera,uv)*.227027;
      c+=(texture2D(camera,uv+stepSize*1.384615)+texture2D(camera,uv-stepSize*1.384615))*.316216;
      c+=(texture2D(camera,uv+stepSize*3.230769)+texture2D(camera,uv-stepSize*3.230769))*.070270;return c;}
    vec4 blurBackground(){vec4 c=texture2D(blurred,uv)*.227027;
      c+=(texture2D(blurred,uv+stepSize*1.384615)+texture2D(blurred,uv-stepSize*1.384615))*.316216;
      c+=(texture2D(blurred,uv+stepSize*3.230769)+texture2D(blurred,uv-stepSize*3.230769))*.070270;return c;}
    void main(){if(pass==0){gl_FragColor=blurCamera();return;}
      vec4 original=texture2D(camera,uv);vec3 color=original.rgb;
      if(useBlur){float person=maskReady?texture2D(mask,uv).a:0.;color=mix(blurBackground().rgb,color,person);}
      float luma=dot(color,vec3(.2126,.7152,.0722));
      if(tone==1)color=mix(vec3(luma),color,.94)*.9964+.03;
      if(tone==2)color=(mix(vec3(luma),color,1.08)*1.08-.5)*.97+.5;
      if(tone==3)color*=vec3(1.07,1.01,.94);
      if(tone==4)color=mix(vec3(luma),color,.85)*vec3(.98,1.02,1.07);
      if(tone==5)color=vec3((luma-.5)*1.06+.5);
      gl_FragColor=vec4(clamp(color,0.,1.),1.);}`;
  const shaders: WebGLShader[] = [];
  const compile = (source: string, type: number) => {
    const shader = gl.createShader(type)!; shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Camera effects could not initialize.');
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(vertex, gl.VERTEX_SHADER)); gl.attachShader(program, compile(fragment, gl.FRAGMENT_SHADER)); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Camera effects could not initialize.');
  gl.useProgram(program);
  const buffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const textures: WebGLTexture[] = [];
  for (let unit = 0; unit < 3; unit++) {
    const texture = gl.createTexture()!; textures.push(texture); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0]));
  }
  const width = Math.max(1, Math.round(canvas.width / 4)), height = Math.max(1, Math.round(canvas.height / 4));
  gl.activeTexture(gl.TEXTURE2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const framebuffer = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[2], 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Background effects are unavailable.');
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const pass = uniform('pass'), step = uniform('stepSize'), ready = uniform('maskReady');
  gl.uniform1i(uniform('camera'), 0); gl.uniform1i(uniform('mask'), 1); gl.uniform1i(uniform('blurred'), 2);
  gl.uniform1i(uniform('useBlur'), effect.blur ? 1 : 0);
  gl.uniform1i(uniform('tone'), ['original','soft','glow','warm','cool','mono'].indexOf(effect.filter));
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  let stopped = false;
  return {
    draw(video: HTMLVideoElement, mask: HTMLCanvasElement | null, maskReady: boolean) {
      if (stopped || gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures[0]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      if (mask) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures[1]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask); }
      gl.uniform1i(ready, maskReady ? 1 : 0);
      if (effect.blur) {
        // A texture attached to the draw framebuffer must not remain bound to
        // any sampler, even when that sampler's shader branch is inactive.
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, textures[0]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); gl.viewport(0, 0, width, height);
        gl.uniform1i(pass, 0); gl.uniform2f(step, 3 / canvas.width, 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, textures[2]);
      gl.uniform1i(pass, 1); gl.uniform2f(step, 0, 1.5 / height); gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      if (stopped) return; stopped = true;
      textures.forEach(texture => gl.deleteTexture(texture)); gl.deleteFramebuffer(framebuffer); gl.deleteBuffer(buffer);
      shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
