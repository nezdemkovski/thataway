import { useEffect, useRef, useState } from "react";

/**
 * The sprite with depth: a WebGL quad that displaces each pixel by its depth toward the
 * direction of a small turn or tilt, and moves the amber rim light with it, so a flat picture
 * reads as a miniature that turns a few degrees with the map instead of a card.
 */
export interface ParallaxControls {
  /** Turn of the map relative to the sprite's own view, -1 (left) .. 1 (right) */
  yaw: number;
  /** Tilt of the phone, -1 (looking from below) .. 1 (looking down) */
  pitch: number;
  /** How far the nearest point moves at full yaw, as a fraction of the width */
  amplitude: number;
  /** Where the rim light comes from, degrees, 0 is the right, 90 the top */
  lightAngle: number;
  rim: number;
  /** The map plane's vertical squash, 0.55 (phone upright) .. 0.95 (held flat) */
  squash: number;
  showDepth: boolean;
}

export const DEFAULT_CONTROLS: ParallaxControls = {
  yaw: 0,
  pitch: 0,
  amplitude: 0.035,
  lightAngle: 30,
  rim: 0.6,
  squash: 0.7,
  showDepth: false,
};

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uShift;      // where the nearest point moves, in uv
uniform vec3 uLight;      // direction the rim light comes from
uniform float uRim;
uniform float uShowDepth;
uniform vec2 uTexel;

float depthAt(vec2 uv) {
  return texture(uDepth, clamp(uv, 0.0, 1.0)).r;
}

void main() {
  // Iterative parallax: find the source pixel that lands here once displaced by its depth.
  // Depth 1 is nearest and moves the most; the picture's middle depth stays put.
  vec2 p = vUv;
  for (int i = 0; i < 6; i++) {
    float d = depthAt(p);
    p = vUv - uShift * (d - 0.5);
  }
  vec4 color = texture(uColor, clamp(p, 0.0, 1.0));
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) color = vec4(0.0);
  float d = depthAt(p);
  if (uShowDepth > 0.5) {
    outColor = vec4(vec3(d) * color.a, color.a);
    return;
  }
  // A normal from the depth's slope: faces turned toward the light catch the rim
  float dx = depthAt(p + vec2(uTexel.x, 0.0)) - depthAt(p - vec2(uTexel.x, 0.0));
  float dy = depthAt(p + vec2(0.0, uTexel.y)) - depthAt(p - vec2(0.0, uTexel.y));
  vec3 n = normalize(vec3(-dx * 6.0, dy * 6.0, 0.25));
  float facing = max(dot(n, uLight), 0.0);
  float edge = smoothstep(0.02, 0.2, length(vec2(dx, dy)));
  vec3 amber = vec3(1.0, 0.698, 0.141);
  vec3 lit = color.rgb + amber * uRim * facing * edge * color.a;
  outColor = vec4(lit, color.a);
}`;

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader failed");
  }
  return shader;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error(`could not load ${src}`)));
    img.src = src;
  });

export function ParallaxView({
  color,
  depth,
  controls,
  size = 520,
}: {
  color: string;
  depth: string;
  controls: ParallaxControls;
  size?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState<{
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    aspect: number;
    texel: [number, number];
  } | null>(null);

  // Textures and the program, once per picture
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      const [img, dep] = await Promise.all([loadImage(color), loadImage(depth)]);
      if (cancelled) return;
      const gl = el.getContext("webgl2", { premultipliedAlpha: true })!;
      const program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      gl.useProgram(program);
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      const upload = (unit: number, image: HTMLImageElement, name: string) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(program, name), unit);
      };
      upload(0, img, "uColor");
      upload(1, dep, "uDepth");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      setReady({
        gl,
        program,
        aspect: img.width / img.height,
        texel: [1 / img.width, 1 / img.height],
      });
    })().catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [color, depth]);

  // A frame per control change
  useEffect(() => {
    if (!ready || !canvas.current) return;
    const { gl, program, aspect, texel } = ready;
    const el = canvas.current;
    const w = aspect >= 1 ? size : Math.round(size * aspect);
    const h = aspect >= 1 ? Math.round(size / aspect) : size;
    if (el.width !== w || el.height !== h) {
      el.width = w;
      el.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    const a = controls.lightAngle * (Math.PI / 180);
    gl.uniform2f(
      gl.getUniformLocation(program, "uShift"),
      controls.yaw * controls.amplitude,
      -controls.pitch * controls.amplitude * 0.6,
    );
    gl.uniform3f(gl.getUniformLocation(program, "uLight"), Math.cos(a), Math.sin(a), 0.35);
    gl.uniform1f(gl.getUniformLocation(program, "uRim"), controls.rim);
    gl.uniform1f(gl.getUniformLocation(program, "uShowDepth"), controls.showDepth ? 1 : 0);
    gl.uniform2f(gl.getUniformLocation(program, "uTexel"), texel[0], texel[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [ready, controls, size]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* The pool of shadow under its feet flattens with the plane */}
      <div
        className="absolute left-1/2 rounded-full bg-black/60 blur-md"
        style={{
          width: size * 0.6,
          height: size * 0.12 * controls.squash,
          transform: "translate(-50%, 50%)",
          bottom: 0,
        }}
      />
      <canvas ref={canvas} className="absolute bottom-0 left-1/2 -translate-x-1/2" />
    </div>
  );
}
