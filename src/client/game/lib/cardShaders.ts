// GLSL for the level-up card screen, in Phaser 4's WebGL1 convention (a
// `precision` line, the `outTexCoord` 0..1 varying, custom uniforms, output to
// gl_FragColor). Used by Phaser Shader GameObjects in CardSelect.

// Balatro-style hypnotic background: polar swirl blending a few colours, slowly
// rotating. Uniforms: uTime, uResolution.
export const SWIRL_FRAG = `
precision mediump float;
varying vec2 outTexCoord;
uniform float uTime;
uniform vec2 uResolution;
uniform float uAlpha; // <1 lets the slowed game show through behind it
void main(void){
  vec2 uv = (outTexCoord - 0.5);
  uv.x *= uResolution.x / uResolution.y;
  float t = uTime * 0.25;
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float v = sin(a * 3.0 + r * 5.0 - t * 2.0)
          + sin(r * 9.0 - t * 1.5)
          + sin(a * 5.0 + t);
  v *= 0.333;
  vec3 c1 = vec3(0.16, 0.07, 0.32);
  vec3 c2 = vec3(0.85, 0.25, 0.45);
  vec3 c3 = vec3(0.10, 0.45, 0.75);
  vec3 col = mix(c1, c2, 0.5 + 0.5 * sin(v * 3.14159));
  col = mix(col, c3, 0.5 + 0.5 * cos(v * 3.14159 + r * 3.0));
  col *= 0.55 + 0.25 * sin(r * 12.0 - t * 3.0); // subtle radial banding
  gl_FragColor = vec4(col, uAlpha);
}`;

// Edition shimmer drawn additively over a card. uMode: 0 foil, 1 holographic,
// 2 polychrome. uTilt shifts the highlight as the card tilts under the cursor.
export const EDITION_FRAG = `
precision mediump float;
varying vec2 outTexCoord;
uniform float uTime;
uniform float uMode;
uniform vec2 uTilt;
void main(void){
  vec2 uv = outTexCoord;
  float t = uTime;
  float diag = (uv.x + uv.y) * 0.5 + uTilt.x * 0.35 - uTilt.y * 0.35;
  float bands = sin(diag * 16.0 - t * 1.5);
  float shimmer = smoothstep(0.25, 1.0, bands);
  vec3 col;
  if (uMode < 0.5) {
    // foil — cyan/blue reflective bands
    col = mix(vec3(0.0, 0.35, 0.8), vec3(0.4, 0.95, 1.0), shimmer) * shimmer * 0.6;
  } else if (uMode < 1.5) {
    // holographic — moving rainbow bands
    float h = diag * 3.0 + t * 0.3;
    col = (0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.66)))) * shimmer * 0.7;
  } else {
    // polychrome — full shifting rainbow wash
    float h = (uv.x * 0.6 + uv.y * 0.4) + t * 0.12 + uTilt.x * 0.2;
    col = (0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.66)))) * 0.5;
  }
  gl_FragColor = vec4(col, 1.0);
}`;
