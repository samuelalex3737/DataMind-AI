(function () {
  const canvas = document.getElementById('dm-shader-bg');
  if (!canvas) return;

  const gl = canvas.getContext('webgl');
  if (!gl) {
    console.warn('DataMind: WebGL not supported, shader background skipped.');
    return;
  }

  // ── Vertex Shader ─────────────────────────────────────────────────────────
  const vsSource = `
    attribute vec4 aVertexPosition;
    void main() {
      gl_Position = aVertexPosition;
    }
  `;

  // ── Fragment Shader — DataMind colour palette ──────────────────────────────
  const fsSource = `
    precision highp float;
    uniform vec2  iResolution;
    uniform float iTime;

    const float overallSpeed      = 0.15;
    const float gridSmoothWidth   = 0.015;
    const float axisWidth         = 0.05;
    const float majorLineWidth    = 0.025;
    const float minorLineWidth    = 0.0125;
    const float majorLineFreq     = 5.0;
    const float minorLineFreq     = 1.0;
    const float scale             = 5.0;

    /* ── Cyan accent #00d4ff ── */
    const vec4  lineColor         = vec4(0.0, 0.831, 1.0, 1.0);

    const float minLineWidth      = 0.01;
    const float maxLineWidth      = 0.18;
    const float lineSpeed         = 1.0  * overallSpeed;
    const float lineAmplitude     = 1.0;
    const float lineFrequency     = 0.2;
    const float warpSpeed         = 0.2  * overallSpeed;
    const float warpFrequency     = 0.5;
    const float warpAmplitude     = 1.0;
    const float offsetFrequency   = 0.5;
    const float offsetSpeed       = 1.33 * overallSpeed;
    const float minOffsetSpread   = 0.6;
    const float maxOffsetSpread   = 2.0;
    const int   linesPerGroup     = 16;

    #define drawCircle(pos, radius, coord) \
      smoothstep(radius + gridSmoothWidth, radius, length(coord - (pos)))
    #define drawSmoothLine(pos, halfWidth, t) \
      smoothstep(halfWidth, 0.0, abs(pos - (t)))
    #define drawCrispLine(pos, halfWidth, t) \
      smoothstep(halfWidth + gridSmoothWidth, halfWidth, abs(pos - (t)))
    #define drawPeriodicLine(freq, width, t) \
      drawCrispLine(freq / 2.0, width, abs(mod(t, freq) - (freq) / 2.0))

    float random(float t) {
      return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;
    }

    float getPlasmaY(float x, float hFade, float offset) {
      return random(x * lineFrequency + iTime * lineSpeed) * hFade * lineAmplitude + offset;
    }

    void main() {
      vec2 fragCoord = gl_FragCoord.xy;
      vec2 uv    = fragCoord / iResolution.xy;
      vec2 space = (fragCoord - iResolution.xy * 0.5) / iResolution.x * 2.0 * scale;

      float hFade = 1.0 - (cos(uv.x * 6.28318) * 0.5 + 0.5);
      float vFade = 1.0 - (cos(uv.y * 6.28318) * 0.5 + 0.5);

      /* subtle warp */
      space.y += random(space.x * warpFrequency + iTime * warpSpeed) * warpAmplitude * (0.5 + hFade);
      space.x += random(space.y * warpFrequency + iTime * warpSpeed + 2.0) * warpAmplitude * hFade;

      vec4 lines = vec4(0.0);

      /* ── Background gradient: #161a24 → #1a1a2e ── */
      vec4 bgColor1 = vec4(0.086, 0.102, 0.141, 1.0);
      vec4 bgColor2 = vec4(0.102, 0.102, 0.180, 1.0);

      for (int l = 0; l < linesPerGroup; l++) {
        float nli          = float(l) / float(linesPerGroup);
        float offsetTime   = iTime * offsetSpeed;
        float offsetPos    = float(l) + space.x * offsetFrequency;
        float rand         = random(offsetPos + offsetTime) * 0.5 + 0.5;
        float halfWidth    = mix(minLineWidth, maxLineWidth, rand * hFade) * 0.5;
        float offset       = random(offsetPos + offsetTime * (1.0 + nli))
                             * mix(minOffsetSpread, maxOffsetSpread, hFade);
        float linePos      = getPlasmaY(space.x, hFade, offset);
        float line         = drawSmoothLine(linePos, halfWidth, space.y) * 0.5
                           + drawCrispLine(linePos, halfWidth * 0.15, space.y);

        float circleX      = mod(float(l) + iTime * lineSpeed, 25.0) - 12.0;
        vec2  circlePos    = vec2(circleX, getPlasmaY(circleX, hFade, offset));
        float circle       = drawCircle(circlePos, 0.01, space) * 4.0;

        lines += (line + circle) * lineColor * rand;
      }

      vec4 fragColor  = mix(bgColor1, bgColor2, uv.x);
      fragColor      *= vFade;
      fragColor.a     = 1.0;
      fragColor      += lines;

      gl_FragColor = fragColor;
    }
  `;

  // ── Compile helpers ────────────────────────────────────────────────────────
  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vs, fs) {
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  // ── Build program ──────────────────────────────────────────────────────────
  const vs      = compileShader(gl, gl.VERTEX_SHADER,   vsSource);
  const fs      = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = createProgram(gl, vs, fs);
  if (!program) return;

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]),
    gl.STATIC_DRAW
  );

  const aPos       = gl.getAttribLocation(program,  'aVertexPosition');
  const uRes       = gl.getUniformLocation(program, 'iResolution');
  const uTime      = gl.getUniformLocation(program, 'iTime');

  // ── Resize ─────────────────────────────────────────────────────────────────
  function resize() {
    const parent = canvas.parentElement;
    canvas.width  = parent ? parent.offsetWidth  : window.innerWidth;
    canvas.height = parent ? parent.offsetHeight : window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Render loop ────────────────────────────────────────────────────────────
  const startTime = Date.now();
  let isRendering = false;

  function render() {
    // Stop rendering if canvas is no longer visible (dashboard loaded)
    if (!canvas.isConnected || canvas.offsetParent === null) {
      isRendering = false;
      return;
    }
    isRendering = true;

    const t = (Date.now() - startTime) / 1000;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPos);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  window.startLandingShader = function() {
    if (!isRendering) {
      resize();
      requestAnimationFrame(render);
    }
  };

  requestAnimationFrame(render);
})();
