// Low-resolution "3D pixel art" renderer: the scene is drawn into a small render target, then
// up-scaled with nearest filtering while a depth/normal edge pass adds crisp outlines.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export const FX_LAYER = 1;

const edgeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    tNormal: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector4() },
    normalEdge: { value: 0.28 },
    depthEdge: { value: 0.45 },
    vignette: { value: 0.35 },
    flash: { value: 0 },
    darkness: { value: 0 },
    tint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform sampler2D tNormal;
    uniform vec4 resolution;
    uniform float normalEdge;
    uniform float depthEdge;
    uniform float vignette;
    uniform float flash;
    uniform float darkness;
    uniform vec3 tint;
    varying vec2 vUv;

    float getDepth(int x, int y) { return texture2D(tDepth, vUv + vec2(x, y) * resolution.zw).r; }
    vec3 getNormal(int x, int y) { return texture2D(tNormal, vUv + vec2(x, y) * resolution.zw).rgb * 2.0 - 1.0; }

    float depthEdgeIndicator(float depth) {
      float diff = 0.0;
      diff += clamp(getDepth(1, 0) - depth, 0.0, 1.0);
      diff += clamp(getDepth(-1, 0) - depth, 0.0, 1.0);
      diff += clamp(getDepth(0, 1) - depth, 0.0, 1.0);
      diff += clamp(getDepth(0, -1) - depth, 0.0, 1.0);
      return floor(smoothstep(0.002, 0.006, diff) * 2.0) / 2.0;
    }

    float neighborNormalEdge(int x, int y, float depth, vec3 normal) {
      float depthDiff = getDepth(x, y) - depth;
      vec3 n = getNormal(x, y);
      float normalDiff = dot(normal - n, vec3(1.0, 1.0, 1.0));
      float normalIndicator = clamp(smoothstep(-0.01, 0.01, normalDiff), 0.0, 1.0);
      float depthIndicator = clamp(sign(depthDiff * 0.25 + 0.0025), 0.0, 1.0);
      return (1.0 - dot(normal, n)) * depthIndicator * normalIndicator;
    }

    float normalEdgeIndicator(float depth, vec3 normal) {
      float i = 0.0;
      i += neighborNormalEdge(0, -1, depth, normal);
      i += neighborNormalEdge(0, 1, depth, normal);
      i += neighborNormalEdge(-1, 0, depth, normal);
      i += neighborNormalEdge(1, 0, depth, normal);
      return step(0.1, i);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      float depth = getDepth(0, 0);
      vec3 normal = getNormal(0, 0);
      float dei = depth < 0.9999 ? depthEdgeIndicator(depth) : 0.0;
      float nei = (depth < 0.9999 && length(normal) > 0.5) ? normalEdgeIndicator(depth, normal) : 0.0;
      float s = dei > 0.0 ? (1.0 - depthEdge * dei) : (1.0 + normalEdge * nei);
      vec3 col = texel.rgb * s * tint;
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * dot(d, d) * 1.6;
      col = mix(col, vec3(0.0), darkness);
      col += flash;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export class PixelRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  pixelSize = 3;
  quality: 'low' | 'medium' | 'high' = 'medium';
  edges = true;
  private beauty: THREE.WebGLRenderTarget;
  private normals: THREE.WebGLRenderTarget;
  private normalMat = new THREE.MeshNormalMaterial();
  private quad: FullScreenQuad;
  readonly uniforms = edgeShader.uniforms;
  width = 1;
  height = 1;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'game-canvas';
    container.appendChild(this.canvas);

    const mkTarget = (withDepth: boolean) => {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      if (withDepth) rt.depthTexture = new THREE.DepthTexture(1, 1);
      return rt;
    };
    this.beauty = mkTarget(true);
    this.normals = mkTarget(false);
    const mat = new THREE.ShaderMaterial({ ...edgeShader, depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(mat);
    this.setQuality(this.quality);
  }

  setQuality(q: 'low' | 'medium' | 'high'): void {
    this.quality = q;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.edges = q !== 'low';
    this.resize(this.width, this.height);
  }

  resize(cssW: number, cssH: number): void {
    this.width = Math.max(1, cssW);
    this.height = Math.max(1, cssH);
    const targetLines = this.quality === 'high' ? 540 : this.quality === 'medium' ? 420 : 300;
    this.pixelSize = Math.max(1.25, Math.min(4, this.height / targetLines));
    const w = Math.max(1, Math.round(this.width / this.pixelSize));
    const h = Math.max(1, Math.round(this.height / this.pixelSize));
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.beauty.setSize(w, h);
    this.normals.setSize(w, h);
    this.uniforms.resolution.value.set(w, h, 1 / w, 1 / h);
  }

  get renderWidth(): number {
    return Math.round(this.width / this.pixelSize);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;
    r.setRenderTarget(this.beauty);
    r.render(scene, camera);
    if (this.edges) {
      const prevOverride = scene.overrideMaterial;
      const prevBg = scene.background;
      camera.layers.disable(FX_LAYER);
      scene.overrideMaterial = this.normalMat;
      scene.background = null;
      r.setRenderTarget(this.normals);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(scene, camera);
      scene.overrideMaterial = prevOverride;
      scene.background = prevBg;
      camera.layers.enable(FX_LAYER);
    }
    this.uniforms.tDiffuse.value = this.beauty.texture;
    this.uniforms.tDepth.value = this.beauty.depthTexture;
    this.uniforms.tNormal.value = this.normals.texture;
    this.uniforms.normalEdge.value = this.edges ? 0.12 : 0;
    this.uniforms.depthEdge.value = this.edges ? 0.4 : 0;
    r.setRenderTarget(null);
    this.quad.render(r);
  }
}
