import { Scene, type GameObjects } from 'phaser';
import { startBenchReadout } from './fpsReadout';

// Custom-GLSL shader showcase + fillrate benchmark. Phaser 4 renders a full-screen
// fragment shader via `this.add.shader()` (a ShaderQuad), driven by `uTime` /
// `uResolution` uniforms. Tap / click to cycle through the options below — some
// are eye-candy, some are deliberately heavy (raymarch, fractal) to stress the GPU.
//
// Phaser 4 GLSL convention: WebGL1-style — a `precision` line, the `outTexCoord`
// (0..1) varying, custom uniforms, output to `gl_FragColor`.
// Docs: https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Shader%20Guide/Phaser%204%20Shader%20Guide.md

type ShaderOption = { name: string; heavy: boolean; src: string };

const HEAD_MED = 'precision mediump float;\nvarying vec2 outTexCoord;\nuniform float uTime;\nuniform vec2 uResolution;\n';
const HEAD_HIGH = 'precision highp float;\nvarying vec2 outTexCoord;\nuniform float uTime;\nuniform vec2 uResolution;\n';

const SHADERS: ShaderOption[] = [
  {
    name: 'Plasma',
    heavy: false,
    src: `${HEAD_MED}
void main(void){
  float t=uTime;
  vec2 p=(outTexCoord-0.5)*vec2(uResolution.x/uResolution.y,1.0)*6.0;
  float v=sin(p.x+t)+sin((p.y+t)*0.5)+sin((p.x+p.y+t)*0.5);
  vec2 c=p+vec2(sin(t*0.5),cos(t*0.33))*2.0;
  v+=sin(sqrt(c.x*c.x+c.y*c.y+1.0)-t);
  v*=0.5;
  vec3 col=vec3(sin(v*3.14159),sin(v*3.14159+2.094),sin(v*3.14159+4.188))*0.5+0.5;
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    name: 'Kaleido Tunnel',
    heavy: false,
    src: `${HEAD_MED}
void main(void){
  vec2 p=(outTexCoord-0.5)*vec2(uResolution.x/uResolution.y,1.0);
  float a=atan(p.y,p.x); float r=length(p);
  float k=6.0; a=mod(a,6.28318/k); a=abs(a-3.14159/k);
  vec2 uv=vec2(0.3/max(r,0.001)+uTime, a);
  float c=sin(uv.x*10.0)*sin(uv.y*8.0+uTime);
  vec3 col=0.5+0.5*cos(uTime+c+vec3(0.0,2.0,4.0));
  col*=smoothstep(0.0,0.35,r);
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    name: 'Julia Fractal',
    heavy: true,
    src: `${HEAD_HIGH}
void main(void){
  vec2 p=(outTexCoord-0.5)*vec2(uResolution.x/uResolution.y,1.0)*2.5;
  vec2 c=vec2(0.7885*cos(uTime*0.4),0.7885*sin(uTime*0.4));
  vec2 z=p; float it=0.0; const float N=90.0;
  for(float n=0.0;n<N;n++){
    z=vec2(z.x*z.x-z.y*z.y,2.0*z.x*z.y)+c;
    it=n;
    if(dot(z,z)>4.0) break;
  }
  float t=it/N;
  vec3 col=0.5+0.5*cos(3.0*t+vec3(0.0,2.0,4.0)+uTime*0.5);
  if(it>=N-1.0) col=vec3(0.02);
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    name: 'Raymarch 3D (heavy)',
    heavy: true,
    src: `${HEAD_HIGH}
float sdSphere(vec3 p,float r){return length(p)-r;}
float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y);return length(q)-t.y;}
float map(vec3 p){
  float ca=cos(uTime*0.3),sa=sin(uTime*0.3);
  p.xz=mat2(ca,-sa,sa,ca)*p.xz;
  float s=sdSphere(p-vec3(sin(uTime)*1.3,0.0,0.0),0.7);
  float t=sdTorus(p,vec2(1.6,0.35));
  return min(s,t);
}
vec3 calcN(vec3 p){vec2 e=vec2(0.001,0.0);
  return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
void main(void){
  vec2 uv=(outTexCoord-0.5)*vec2(uResolution.x/uResolution.y,1.0)*2.0;
  vec3 ro=vec3(0.0,0.0,-4.0);
  vec3 rd=normalize(vec3(uv,1.5));
  float t=0.0; bool hit=false;
  for(int i=0;i<90;i++){
    vec3 p=ro+rd*t; float d=map(p);
    if(d<0.001){hit=true;break;}
    t+=d; if(t>20.0) break;
  }
  vec3 col=vec3(0.04,0.05,0.09);
  if(hit){
    vec3 p=ro+rd*t; vec3 n=calcN(p);
    vec3 l=normalize(vec3(0.8,0.7,-0.6));
    float diff=max(dot(n,l),0.0);
    vec3 base=0.5+0.5*cos(p.y+uTime+vec3(0.0,2.0,4.0));
    col=base*diff+vec3(0.08);
  }
  gl_FragColor=vec4(col,1.0);
}`,
  },
  {
    name: 'fBm Clouds',
    heavy: true,
    src: `${HEAD_HIGH}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<6;i++){v+=a*noise(p);p*=2.0;a*=0.5;}return v;}
void main(void){
  vec2 uv=outTexCoord*vec2(uResolution.x/uResolution.y,1.0)*3.0;
  float f=fbm(uv+vec2(uTime*0.1,0.0));
  f=fbm(uv+f+vec2(0.0,uTime*0.05));
  vec3 sky=mix(vec3(0.2,0.4,0.7),vec3(0.95,0.97,1.0),f);
  gl_FragColor=vec4(sky,1.0);
}`,
  },
];

export class ShaderDemo extends Scene {
  private shader?: GameObjects.Shader;
  private label!: GameObjects.Text;
  private index = 0;

  constructor() {
    super('ShaderDemo');
  }

  create() {
    this.index = 0;
    this.build();

    this.label = this.add
      .text(this.scale.width / 2, 16, '', {
        fontFamily: 'ui-monospace, monospace',
        fontSize: 18,
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.updateLabel();

    // Tap / click anywhere to cycle to the next shader.
    this.input.on('pointerdown', () => {
      this.index = (this.index + 1) % SHADERS.length;
      this.build();
      this.updateLabel();
    });

    this.scale.on('resize', this.onResize, this);
    startBenchReadout(this, 'demo-shader', this.index + 1);
  }

  private build() {
    this.shader?.destroy();
    const { width, height } = this.scale;
    const opt = SHADERS[this.index]!;
    this.shader = this.add
      .shader(
        {
          name: `demo-${opt.name}`,
          fragmentSource: opt.src,
          initialUniforms: { uTime: 0, uResolution: [width, height] },
        },
        width / 2,
        height / 2,
        width,
        height
      )
      .setDepth(0);
  }

  private updateLabel() {
    const opt = SHADERS[this.index]!;
    this.label?.setText(`✨ ${opt.name}${opt.heavy ? '  (heavy)' : ''}   ·  tap to switch (${this.index + 1}/${SHADERS.length})`);
  }

  private onResize() {
    const { width, height } = this.scale;
    this.shader?.setPosition(width / 2, height / 2);
    this.shader?.setDisplaySize(width, height);
    this.shader?.setUniform('uResolution', [width, height]);
    this.label?.setPosition(width / 2, 16);
  }

  override update(time: number) {
    this.shader?.setUniform('uTime', time / 1000);
  }

  shutdown() {
    this.scale.off('resize', this.onResize, this);
  }
}
