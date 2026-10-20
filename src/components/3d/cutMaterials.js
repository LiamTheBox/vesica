import * as THREE from 'three'

// Materials for the inside of the organ: the muscle wall and the urine.
//
// Both are drawn on the back faces of their meshes. With the near half clipped away
// (cutaway) those back faces fill exactly the cut opening, so a shader that shades them
// as if they were the flat cut face gives a solid cross-section: each fragment finds
// where its view ray crosses the cut plane and uses that point for its pattern, and the
// distance on to the back face as the depth of material behind the cut (Beer–Lambert
// colour for the urine). Without the cutaway, the wall tissue is what shows through
// the translucent membrane wherever there's no urine: a bladder holds no air.

const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  #include <clipping_planes_pars_vertex>
  varying vec3 vWorld;
  void main() {
    #include <begin_vertex>
    #include <project_vertex>
    vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #include <clipping_planes_vertex>
    #include <fog_vertex>
  }
`

// Shared: the cut-plane point behind this fragment, and how much material lies behind it.
const cutPars = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  #include <clipping_planes_pars_fragment>
  uniform vec4 uCut; // world plane: dot(n, p) + w = 0, n pointing away from the camera
  uniform float uCutOn;
  uniform float uTime;
  varying vec3 vWorld;
  const vec3 KEY_LIGHT = vec3(0.38, 0.77, 0.51); // the scene's main light (6, 12, 8), normalised

  vec3 cutPoint(out float depth) {
    if (uCutOn < 0.5) {
      depth = 0.0;
      return vWorld;
    }
    vec3 ray = vWorld - cameraPosition;
    float denom = dot(uCut.xyz, ray);
    float t = abs(denom) > 1e-6 ? clamp(-(dot(uCut.xyz, cameraPosition) + uCut.w) / denom, 0.0, 1.0) : 1.0;
    vec3 p = cameraPosition + ray * t;
    depth = length(vWorld - p);
    return p;
  }

  // Cheap hashes (no sin), for the noise below.
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  vec2 hash22(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.xx + q.yz) * q.zy);
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  // Facing the camera on the cut; the back face's own (flat) normal otherwise.
  vec3 faceNormal() {
    if (uCutOn > 0.5) return -uCut.xyz;
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    return dot(n, cameraPosition - vWorld) < 0.0 ? -n : n;
  }
`

const finish = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
`

const urineFragment = /* glsl */ `
  ${cutPars}
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uLining;

  // Light rippling through liquid: a network of thin bright lines along the borders of
  // drifting cells (distance to the second-nearest point minus the nearest).
  float causticNet(vec2 x, float t) {
    vec2 cell = floor(x);
    vec2 f = fract(x);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = 0.5 + 0.4 * sin(t + 6.2831 * hash22(cell + g));
        float d = length(g + o - f);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    float edge = 1.0 - smoothstep(0.0, 0.2, d2 - d1);
    return edge * edge;
  }

  // Coordinates within the cut plane, so the pattern lies flat on the cut.
  vec2 planeCoords(vec3 p) {
    vec3 n = uCut.xyz;
    vec3 u = normalize(abs(n.y) < 0.95 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
    return vec2(dot(p, u), dot(p, cross(u, n)));
  }

  // A sparse field of tiny bubbles rising through the liquid, each with a bright rim.
  float bubbles(vec3 p, float t) {
    vec3 q = p * 2.0;
    q.y -= t * 0.3;
    vec3 cell = floor(q);
    if (hash31(cell) < 0.82) return 0.0;
    vec3 offset = vec3(hash31(cell + 1.3), hash31(cell + 2.7), hash31(cell + 4.1)) - 0.5;
    float r = 0.05 + 0.05 * hash31(cell + 5.9);
    float d = length(fract(q) - 0.5 - offset * 0.6);
    return (1.0 - smoothstep(r * 0.6, r, d)) * (0.45 + 0.55 * smoothstep(r * 0.3, r * 0.8, d));
  }

  void main() {
    #include <clipping_planes_fragment>
    float depth;
    vec3 p = cutPoint(depth);
    // Deeper behind the cut means more liquid to look through: richer, darker amber.
    float absorbed = 1.0 - exp(-depth * 0.7);
    vec3 col = mix(uShallow, uDeep, absorbed);
    // Lit from above: brighter near the top of the bladder.
    col *= mix(0.78, 1.1, smoothstep(-3.0, 3.0, p.y));
    // Bend the network into curves and let it fade in and out across the cut.
    vec2 uv = planeCoords(p) * 1.8;
    vec2 warp = vec2(valueNoise(vec3(uv * 0.6, uTime * 0.15)), valueNoise(vec3(uv * 0.6 + 5.2, uTime * 0.15))) - 0.5;
    float light = causticNet(uv + warp * 1.6, uTime * 0.8);
    light *= smoothstep(0.3, 0.75, valueNoise(vec3(uv * 0.35, uTime * 0.1 + 3.0)));
    col += uShallow * light * (0.2 + 0.2 * (1.0 - absorbed));
    col += vec3(1.0, 0.96, 0.82) * bubbles(p, uTime) * 0.5;
    // The lining (urothelium) where the urine meets the wall.
    col = mix(col, uLining, (1.0 - smoothstep(0.02, 0.14, depth)) * 0.75);
    // A wet sheen from the key light on the flat cut.
    vec3 n = faceNormal();
    vec3 h = normalize(KEY_LIGHT + normalize(cameraPosition - p));
    col += pow(max(dot(n, h), 0.0), 40.0) * 0.22;
    gl_FragColor = vec4(col, 1.0);
    ${finish}
  }
`

const tissueFragment = /* glsl */ `
  ${cutPars}
  uniform vec3 uMuscle;
  uniform vec3 uMuscleDark;
  uniform vec3 uSerosa;

  void main() {
    #include <clipping_planes_fragment>
    float light = 0.6 + 0.4 * max(dot(faceNormal(), KEY_LIGHT), 0.0);
    // Uncut, it's only seen dimly through the membrane: skip the detail.
    if (uCutOn < 0.5) {
      gl_FragColor = vec4(mix(uMuscleDark, uMuscle, 0.65) * light, 1.0);
      ${finish}
      return;
    }
    float depth;
    vec3 p = cutPoint(depth);
    // Detrusor fibre bundles run in interlacing directions: noise stretched along two
    // directions, blended by a slow field, plus a soft mottle.
    float field = valueNoise(p * 0.9);
    float f1 = valueNoise(vec3(p.x * 14.0, p.y * 1.6, p.z * 14.0));
    float f2 = valueNoise(vec3(p.x * 1.6 + p.y, p.y * 14.0, p.z * 14.0));
    float fibre = mix(f1, f2, smoothstep(0.35, 0.65, field));
    float mottle = valueNoise(p * 3.0);
    vec3 col = mix(uMuscleDark, uMuscle, 0.45 + 0.4 * fibre + 0.15 * mottle);
    // The darker outer layer (serosa) just under the wall's outside.
    col = mix(col, uSerosa, (1.0 - smoothstep(0.0, 0.16, depth)) * 0.75);
    gl_FragColor = vec4(col * light, 1.0);
    ${finish}
  }
`

function cutMaterial(fragmentShader, colors) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uCut: { value: new THREE.Vector4(0, 0, -1, 0) }, uCutOn: { value: 0 }, uTime: { value: 0 } },
  ])
  for (const [name, hex] of Object.entries(colors)) uniforms[name] = { value: new THREE.Color(hex) }
  return new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.BackSide, fog: true, clipping: true })
}

export function createCutMaterials() {
  const urine = cutMaterial(urineFragment, { uShallow: 0xfcd34d, uDeep: 0xb45309, uLining: 0xf4a8b8 })
  const tissue = cutMaterial(tissueFragment, { uMuscle: 0xc53652, uMuscleDark: 0x8c1c36, uSerosa: 0x4c0519 })
  let flowTime = 0

  return {
    urine,
    tissue,
    setClipping(planes) {
      urine.clippingPlanes = planes
      tissue.clippingPlanes = planes
    },
    // Per frame: the cut plane (world space), and the liquid's colour and motion.
    update(sim, dt, plane, cutOn) {
      // The liquid's patterns move faster while it's being sloshed about.
      flowTime += dt * (0.6 + Math.min(1, sim.jiggleIntensity) * 2.5)
      const h = sim.hydration // well hydrated = paler
      urine.uniforms.uShallow.value.setRGB(1.0, 0.78 + h * 0.14, 0.16 + h * 0.36, THREE.SRGBColorSpace)
      urine.uniforms.uDeep.value.setRGB(0.74, 0.3 + h * 0.2, 0.02 + h * 0.08, THREE.SRGBColorSpace)
      for (const material of [urine, tissue]) {
        material.uniforms.uCut.value.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
        material.uniforms.uCutOn.value = cutOn ? 1 : 0
        material.uniforms.uTime.value = flowTime
      }
    },
  }
}
