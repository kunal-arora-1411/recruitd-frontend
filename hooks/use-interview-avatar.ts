"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { VoiceStatus } from "@/lib/types";

// ─── Internal Types ───────────────────────────────────────────────────────────

interface MorphMap {
  // Fallback jaw (used only when no RPM visemes are found)
  jawOpen:      number | undefined;
  // ─ Brow expressions ─────────────────────────────────────────────────────
  browInnerUp:  number | undefined; // inner brows up — concern / mild surprise
  browOuterUpL: number | undefined; // outer left brow up — engaged / questioning
  browOuterUpR: number | undefined; // outer right brow up
  browDownL:    number | undefined; // left brow down/furrow — focus / thinking
  browDownR:    number | undefined; // right brow down/furrow
  // ─ Eye expressions ──────────────────────────────────────────────────────
  eyeBlinkL:    number | undefined; // blink (driven by blink state machine)
  eyeBlinkR:    number | undefined;
  eyeWideL:     number | undefined; // wide open — alert / attentive
  eyeWideR:     number | undefined;
  eyeSquintL:   number | undefined; // soft squint — warm smile / focused
  eyeSquintR:   number | undefined;
  // ─ Mouth expressions ────────────────────────────────────────────────────
  mouthSmile:   number | undefined; // general / symmetric smile
  mouthSmileL:  number | undefined; // left mouth corner lift
  mouthSmileR:  number | undefined; // right mouth corner lift
  mouthFrownL:  number | undefined; // left corner down — concern
  mouthFrownR:  number | undefined; // right corner down
  mouthPucker:  number | undefined; // lip pucker — thinking / considering
  // RPM / OVR standard visemes (15 shapes)
  viseme_sil: number | undefined;
  viseme_PP:  number | undefined;
  viseme_FF:  number | undefined;
  viseme_TH:  number | undefined;
  viseme_DD:  number | undefined;
  viseme_kk:  number | undefined;
  viseme_CH:  number | undefined;
  viseme_SS:  number | undefined;
  viseme_nn:  number | undefined;
  viseme_RR:  number | undefined;
  viseme_aa:  number | undefined;
  viseme_E:   number | undefined;
  viseme_I:   number | undefined;
  viseme_O:   number | undefined;
  viseme_U:   number | undefined;
}

/** 15 viseme weights used by the FFT classifier. */
interface VisemeWeights {
  sil: number; PP: number; FF: number; TH: number; DD: number;
  kk:  number; CH: number; SS: number; nn: number; RR: number;
  aa:  number; E:  number; I:  number; O:  number; U:  number;
}

interface AvatarRefs {
  renderer:   THREE.WebGLRenderer;
  scene:      THREE.Scene;
  camera:     THREE.PerspectiveCamera;
  clock:      THREE.Clock;
  headMesh:   THREE.Mesh | null;
  morphMap:   MorphMap;
  avatarRoot: THREE.Object3D | null;
  mixer:      THREE.AnimationMixer | null;
  /** True when RPM viseme morph targets were discovered; false = jaw-only fallback. */
  hasVisemes: boolean;
}

interface BlinkState {
  phase: "open" | "closing" | "opening";
  timer: number; // seconds until next phase transition
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MORPH_ALIASES: Record<keyof MorphMap, string[]> = {
  // Legacy jaw fallback
  jawOpen:      ["jawOpen", "Jaw_Open", "jaw_open", "mouthOpen"],
  // Brow
  browInnerUp:  ["browInnerUp", "BrowInnerUp", "brow_inner_up"],
  browOuterUpL: ["browOuterUpLeft",  "browOuterUp_L", "BrowUp_L"],
  browOuterUpR: ["browOuterUpRight", "browOuterUp_R", "BrowUp_R"],
  browDownL:    ["browDownLeft",  "browDown_L", "BrowDown_L"],
  browDownR:    ["browDownRight", "browDown_R", "BrowDown_R"],
  // Eyes
  eyeBlinkL:    ["eyeBlinkLeft",  "Eye_Blink_L", "blinkLeft",  "Blink_L"],
  eyeBlinkR:    ["eyeBlinkRight", "Eye_Blink_R", "blinkRight", "Blink_R"],
  eyeWideL:     ["eyeWideLeft",  "eyeWide_L", "EyeWide_L"],
  eyeWideR:     ["eyeWideRight", "eyeWide_R", "EyeWide_R"],
  eyeSquintL:   ["eyeSquintLeft",  "eyeSquint_L", "EyeSquint_L"],
  eyeSquintR:   ["eyeSquintRight", "eyeSquint_R", "EyeSquint_R"],
  // Mouth expressions
  mouthSmile:   ["mouthSmile",  "Mouth_Smile",  "smile"],
  mouthSmileL:  ["mouthSmileLeft",  "mouthCornerPullL", "mouthCorner_L"],
  mouthSmileR:  ["mouthSmileRight", "mouthCornerPullR", "mouthCorner_R"],
  mouthFrownL:  ["mouthFrownLeft",  "mouthFrown_L"],
  mouthFrownR:  ["mouthFrownRight", "mouthFrown_R"],
  mouthPucker:  ["mouthPucker", "Mouth_Pucker", "lip_pucker"],
  // RPM visemes — exact names as exported by Ready Player Me
  viseme_sil: ["viseme_sil"],
  viseme_PP:  ["viseme_PP"],
  viseme_FF:  ["viseme_FF"],
  viseme_TH:  ["viseme_TH"],
  viseme_DD:  ["viseme_DD"],
  viseme_kk:  ["viseme_kk"],
  viseme_CH:  ["viseme_CH"],
  viseme_SS:  ["viseme_SS"],
  viseme_nn:  ["viseme_nn"],
  viseme_RR:  ["viseme_RR"],
  viseme_aa:  ["viseme_aa", "A"],
  viseme_E:   ["viseme_E"],
  viseme_I:   ["viseme_I"],
  viseme_O:   ["viseme_O"],
  viseme_U:   ["viseme_U"],
};

/** The 15 viseme keys that map directly onto MorphMap fields. */
const VISEME_KEYS: Array<[keyof VisemeWeights, keyof MorphMap]> = [
  ["sil", "viseme_sil"], ["PP",  "viseme_PP"],  ["FF",  "viseme_FF"],
  ["TH",  "viseme_TH"],  ["DD",  "viseme_DD"],  ["kk",  "viseme_kk"],
  ["CH",  "viseme_CH"],  ["SS",  "viseme_SS"],  ["nn",  "viseme_nn"],
  ["RR",  "viseme_RR"],  ["aa",  "viseme_aa"],  ["E",   "viseme_E"],
  ["I",   "viseme_I"],   ["O",   "viseme_O"],   ["U",   "viseme_U"],
];

// Per-frame lerp factors (at 60 fps)
const LERP_VISEME = 0.30; // viseme blending — responsive but not jittery
const LERP_JAW    = 0.35; // fallback jaw-only mode
const LERP_EXPR   = 0.06; // emotion expressions fade gradually

// Blink timing (seconds)
const BLINK_CLOSE_DURATION = 0.08;
const BLINK_OPEN_DURATION  = 0.12;
const BLINK_MIN_INTERVAL   = 3.0;
const BLINK_MAX_INTERVAL   = 5.0;

// Silence weights (rest pose)
const VISEME_SILENCE: VisemeWeights = {
  sil: 1, PP: 0, FF: 0, TH: 0, DD: 0,
  kk: 0,  CH: 0, SS: 0, nn: 0, RR: 0,
  aa: 0,  E: 0,  I: 0,  O: 0,  U: 0,
};

// ─── Pure Functions ───────────────────────────────────────────────────────────

/**
 * Rotate upper arm bones from T-pose to a relaxed side-hanging position.
 * Called only when the GLB has no animations to drive the skeleton.
 */
function poseArmsDown(scene: THREE.Scene): void {
  const bones: THREE.Bone[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Bone) bones.push(obj);
  });

  if (bones.length === 0) return;
  console.log("[Avatar] Skeleton bones:", bones.map((b) => b.name));

  const LEFT_ARM_RE  = /^(LeftArm|Left_Arm|LeftUpperArm|Left_Upper_Arm|mixamorig[:\s]LeftArm|Bip01_L_UpperArm|upperarm_l)$/i;
  const RIGHT_ARM_RE = /^(RightArm|Right_Arm|RightUpperArm|Right_Upper_Arm|mixamorig[:\s]RightArm|Bip01_R_UpperArm|upperarm_r)$/i;

  const leftArm  = bones.find((b) => LEFT_ARM_RE.test(b.name))  ?? null;
  const rightArm = bones.find((b) => RIGHT_ARM_RE.test(b.name)) ?? null;

  if (leftArm) {
    leftArm.rotation.z = -1.3;
    console.log(`[Avatar] Posed left arm: "${leftArm.name}"`);
  } else {
    console.warn("[Avatar] Left arm bone not found");
  }

  if (rightArm) {
    rightArm.rotation.z = 1.3;
    console.log(`[Avatar] Posed right arm: "${rightArm.name}"`);
  } else {
    console.warn("[Avatar] Right arm bone not found");
  }
}

function discoverMorphMap(scene: THREE.Scene): {
  mesh: THREE.Mesh | null;
  map: MorphMap;
  hasVisemes: boolean;
} {
  let bestMesh: THREE.Mesh | null = null;
  let bestCount = 0;

  scene.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh &&
      obj.morphTargetDictionary &&
      Object.keys(obj.morphTargetDictionary).length > bestCount
    ) {
      bestCount = Object.keys(obj.morphTargetDictionary).length;
      bestMesh = obj as THREE.Mesh;
    }
  });

  const emptyMap: MorphMap = {
    jawOpen: undefined,
    browInnerUp: undefined, browOuterUpL: undefined, browOuterUpR: undefined,
    browDownL: undefined,   browDownR: undefined,
    eyeBlinkL: undefined,   eyeBlinkR: undefined,
    eyeWideL: undefined,    eyeWideR: undefined,
    eyeSquintL: undefined,  eyeSquintR: undefined,
    mouthSmile: undefined,  mouthSmileL: undefined, mouthSmileR: undefined,
    mouthFrownL: undefined, mouthFrownR: undefined,
    mouthPucker: undefined,
    viseme_sil: undefined, viseme_PP: undefined, viseme_FF: undefined,
    viseme_TH: undefined,  viseme_DD: undefined, viseme_kk: undefined,
    viseme_CH: undefined,  viseme_SS: undefined, viseme_nn: undefined,
    viseme_RR: undefined,  viseme_aa: undefined, viseme_E:  undefined,
    viseme_I:  undefined,  viseme_O:  undefined, viseme_U:  undefined,
  };

  if (!bestMesh) {
    console.warn("[Avatar] No morph targets found in GLB — lip sync disabled");
    return { mesh: null, map: emptyMap, hasVisemes: false };
  }

  const dict = (bestMesh as THREE.Mesh).morphTargetDictionary!;
  console.log("[Avatar] Morph targets discovered:", Object.keys(dict).join(", "));

  const map = { ...emptyMap };
  for (const [key, aliases] of Object.entries(MORPH_ALIASES) as [keyof MorphMap, string[]][]) {
    const found = aliases.find((name) => name in dict);
    if (found !== undefined) {
      map[key] = dict[found];
      console.log(`[Avatar] Mapped "${key}" -> "${found}" (index ${dict[found]})`);
    }
  }

  // Determine if RPM visemes are available
  const hasVisemes = map.viseme_aa !== undefined || map.viseme_E !== undefined;
  console.log(`[Avatar] Lip sync mode: ${hasVisemes ? "viseme (RPM)" : "jaw fallback"}`);

  return { mesh: bestMesh, map, hasVisemes };
}

function buildScene(canvas: HTMLCanvasElement): AvatarRefs {
  const initialWidth  = canvas.parentElement?.clientWidth  || 320;
  const initialHeight = canvas.parentElement?.clientHeight || 360;
  canvas.width  = initialWidth;
  canvas.height = initialHeight;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(initialWidth, initialHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  // Key light — upper-right front, warm
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(2, 4, 3);
  scene.add(keyLight);

  // Ambient fill
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Rim light — cool blue separation from background
  const rimLight = new THREE.DirectionalLight(0xb8d4ff, 0.4);
  rimLight.position.set(-3, 1, -2);
  scene.add(rimLight);

  const clock = new THREE.Clock();

  return {
    renderer, scene, camera, clock,
    headMesh: null,
    morphMap: {
      jawOpen: undefined,
      browInnerUp: undefined, browOuterUpL: undefined, browOuterUpR: undefined,
      browDownL: undefined,   browDownR: undefined,
      eyeBlinkL: undefined,   eyeBlinkR: undefined,
      eyeWideL: undefined,    eyeWideR: undefined,
      eyeSquintL: undefined,  eyeSquintR: undefined,
      mouthSmile: undefined,  mouthSmileL: undefined, mouthSmileR: undefined,
      mouthFrownL: undefined, mouthFrownR: undefined,
      mouthPucker: undefined,
      viseme_sil: undefined, viseme_PP: undefined, viseme_FF: undefined,
      viseme_TH: undefined,  viseme_DD: undefined, viseme_kk: undefined,
      viseme_CH: undefined,  viseme_SS: undefined, viseme_nn: undefined,
      viseme_RR: undefined,  viseme_aa: undefined, viseme_E:  undefined,
      viseme_I:  undefined,  viseme_O:  undefined, viseme_U:  undefined,
    },
    avatarRoot: null,
    mixer: null,
    hasVisemes: false,
  };
}

function disposeScene(refs: AvatarRefs): void {
  refs.scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      Object.values(mat as object).forEach((v) => {
        if (v && typeof (v as { dispose?: unknown }).dispose === "function") {
          (v as { dispose: () => void }).dispose();
        }
      });
      mat.dispose();
    });
  });
  refs.renderer.dispose();
  refs.renderer.forceContextLoss();
}

/** Lerp a morph target toward a target value. Null-safe. */
function setMorph(
  mesh: THREE.Mesh,
  index: number | undefined,
  target: number,
  alpha: number,
): void {
  if (index === undefined || !mesh.morphTargetInfluences) return;
  const cur = mesh.morphTargetInfluences[index] ?? 0;
  mesh.morphTargetInfluences[index] = cur + (target - cur) * alpha;
}

/**
 * FFT-based viseme classifier.
 *
 * Analyzes the frequency content of the AI speech audio and maps it to
 * the 15 standard RPM/OVR visemes using formant frequency analysis:
 *
 *   F1 (300-1000 Hz)  — first formant: jaw height (open vs. closed vowels)
 *   F2 (1000-3000 Hz) — second formant: tongue position (front vs. back vowels)
 *   Fricative (3000-6000 Hz) — unvoiced fricatives: FF, TH, CH
 *   Sibilant  (6000-8000 Hz) — high sibilants: SS, Z
 *
 * The analyser's fftSize is upgraded to 1024 on first use for ~15 Hz/bin
 * resolution at 16 kHz, giving reliable formant separation.
 */
function computeVisemes(
  node: AnalyserNode,
  freqBuf: Float32Array<ArrayBufferLike>,
  timeBuf: Float32Array<ArrayBufferLike>,
): VisemeWeights {
  // ── 1. RMS energy gate (time domain) ─────────────────────────────────────
  node.getFloatTimeDomainData(timeBuf as Float32Array<ArrayBuffer>);
  let rmsSum = 0;
  for (let i = 0; i < timeBuf.length; i++) rmsSum += timeBuf[i] * timeBuf[i];
  const rms = Math.sqrt(rmsSum / timeBuf.length);

  if (rms < 0.008) return { ...VISEME_SILENCE };

  // ── 2. Frequency band energies (power from dB) ────────────────────────────
  node.getFloatFrequencyData(freqBuf as Float32Array<ArrayBuffer>);

  const N    = freqBuf.length;                      // fftSize / 2 = 512
  const binHz = node.context.sampleRate / (N * 2);  // ~15.6 Hz/bin at 16 kHz

  let eTot = 0, eF1 = 0, eF2 = 0, eFric = 0, eSibil = 0;

  for (let i = 1; i < N; i++) {   // skip bin 0 (DC)
    const hz = i * binHz;
    const e  = Math.pow(10, freqBuf[i] / 10); // dB → linear power
    eTot += e;
    if (hz >= 300  && hz < 1000) eF1    += e;
    if (hz >= 1000 && hz < 3000) eF2    += e;
    if (hz >= 3000 && hz < 6000) eFric  += e;
    if (hz >= 6000)              eSibil += e;
  }

  if (eTot < 1e-8) return { ...VISEME_SILENCE };

  // Normalize ratios
  const rF1    = eF1    / eTot;
  const rF2    = eF2    / eTot;
  const rFric  = eFric  / eTot;
  const rSibil = eSibil / eTot;

  // Overall voicing scale [0-1] — same power curve as the old jaw formula
  const voice = Math.min(1, Math.pow(rms * 8, 0.7));

  // ── 3. Phoneme classification ─────────────────────────────────────────────
  const w: VisemeWeights = { ...VISEME_SILENCE, sil: 0 };

  if (rSibil > 0.10) {
    // ── High-frequency sibilants: S, Z ────────────────────────────────────
    const str = Math.min(1, rSibil * 6);
    w.SS = voice * str;
    // Mix in CH when there's also strong mid-fricative energy
    w.CH = voice * str * Math.min(1, rFric * 4) * 0.35;

  } else if (rFric > 0.22) {
    // ── Mid fricatives: F, V, TH, SH ─────────────────────────────────────
    const str = Math.min(1, rFric * 3);
    if (rF2 < 0.18) {
      // Mostly front-of-mouth energy → labiodental / dental
      w.FF = voice * str * 0.55;
      w.TH = voice * str * 0.45;
    } else {
      // More postalveolar energy → affricate / palatal
      w.CH = voice * str * 0.70;
      w.FF = voice * str * 0.30;
    }

  } else {
    // ── Voiced sounds: vowels and sonorant consonants ──────────────────────
    const voiced = voice * Math.max(0, 1 - rFric * 3); // reduce if fricative leaks in

    if (rF1 > 0.20) {
      // ── Open vowels (high first formant → jaw open) ──────────────────
      if (rF2 < 0.16) {
        // Back rounded vowel: O
        w.O  = voiced * Math.min(1, rF1 * 3.0) * 0.70;
        w.aa = voiced * Math.min(1, rF1 * 3.0) * 0.30;
      } else if (rF2 < 0.28) {
        // Central/front-open: AA
        w.aa = voiced * Math.min(1, rF1 * 3.0);
        w.E  = voiced * Math.min(1, rF2 * 3.0) * 0.15;
      } else {
        // Front open: AA with E blend
        w.aa = voiced * Math.min(1, rF1 * 2.5) * 0.70;
        w.E  = voiced * Math.min(1, rF2 * 2.5) * 0.30;
      }

    } else if (rF2 > 0.28) {
      // ── Front vowels (high second formant) ───────────────────────────
      if (rF1 < 0.10) {
        // Close front: I (IH/IY)
        w.I  = voiced * Math.min(1, rF2 * 2.5) * 0.65;
        w.E  = voiced * Math.min(1, rF2 * 2.5) * 0.35;
      } else {
        // Mid-close front: E (EH/EY)
        w.E  = voiced * Math.min(1, rF2 * 2.5) * 0.70;
        w.I  = voiced * Math.min(1, rF2 * 2.5) * 0.30;
      }

    } else if (rF1 < 0.10 && rF2 < 0.15) {
      // ── Back/central close vowels: U (UH/UW/OW) ─────────────────────
      w.U  = voiced * 0.65;
      w.O  = voiced * 0.35;

    } else {
      // ── Sonorant consonants: D, T, N, K, G, L, R ─────────────────────
      // These have moderate formants — give a mid-open shape
      w.DD = voiced * 0.40;
      w.nn = voiced * 0.25;
      w.aa = voiced * Math.min(0.45, rF1 * 4.0);
      w.RR = voiced * Math.min(0.30, rF2 * 1.5) * 0.20;
    }
  }

  // Silence fills the remainder so all weights sum to ~1
  w.sil = Math.max(0, 1 - voice);

  return w;
}

/** Legacy RMS → jaw (used when no RPM visemes are on the model). */
function computeJaw(node: AnalyserNode, buf: Float32Array<ArrayBufferLike>): number {
  node.getFloatTimeDomainData(buf as Float32Array<ArrayBuffer>);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  return Math.min(1, Math.pow(rms * 8, 0.7));
}

// ─── Expression Preset System ────────────────────────────────────────────────
//
// An expression preset is a partial record of expression morph weights.
// Any key omitted defaults to 0 (i.e. "not active").
// The animation loop lerps every expression morph toward the current preset
// every frame, so transitions between states are always smooth.

type ExpressionMorphKey = Exclude<keyof MorphMap,
  | "jawOpen"
  | "eyeBlinkL" | "eyeBlinkR"   // driven by the blink state machine
  | `viseme_${string}`           // driven by the lip-sync classifier
>;

type ExpressionPreset = Partial<Record<ExpressionMorphKey, number>>;

/**
 * Named expression presets.
 * Tune the values here to adjust how the avatar looks in each interview state.
 */
const EXPRESSIONS = {
  /** Relaxed rest — used when status is unknown / ended. */
  neutral: {} as ExpressionPreset,

  /** Calm first appearance, still loading the connection. */
  connecting: {
    mouthSmile:   0.12,
    mouthSmileL:  0.06,
    mouthSmileR:  0.06,
    browOuterUpL: 0.06,
    browOuterUpR: 0.06,
  } as ExpressionPreset,

  /** Attentive — listening to the candidate speak. */
  listening: {
    browOuterUpL: 0.18,
    browOuterUpR: 0.18,
    eyeWideL:     0.12,
    eyeWideR:     0.12,
    mouthSmile:   0.22,
    mouthSmileL:  0.12,
    mouthSmileR:  0.12,
    eyeSquintL:   0.08,
    eyeSquintR:   0.08,
  } as ExpressionPreset,

  /** Ready / waiting — warm and open. */
  ready: {
    browOuterUpL: 0.14,
    browOuterUpR: 0.14,
    mouthSmile:   0.28,
    mouthSmileL:  0.16,
    mouthSmileR:  0.16,
    eyeSquintL:   0.12,
    eyeSquintR:   0.12,
  } as ExpressionPreset,

  /**
   * AI speaking — subtle, natural; the lip-sync visemes supply most of the
   * movement so the expression preset stays light here.
   */
  speaking: {
    browOuterUpL: 0.08,
    browOuterUpR: 0.08,
    mouthSmile:   0.08,
  } as ExpressionPreset,

  /** AI thinking — concentrated, inner brows raised, slight pucker. */
  thinking: {
    browInnerUp:  0.30,
    browDownL:    0.18,
    browDownR:    0.18,
    eyeSquintL:   0.20,
    eyeSquintR:   0.20,
    mouthPucker:  0.18,
  } as ExpressionPreset,
} satisfies Record<string, ExpressionPreset>;

/** All expression morph keys that the loop should drive each frame. */
const EXPRESSION_MORPH_KEYS: ExpressionMorphKey[] = [
  "browInnerUp",
  "browOuterUpL", "browOuterUpR",
  "browDownL",    "browDownR",
  "eyeWideL",     "eyeWideR",
  "eyeSquintL",   "eyeSquintR",
  "mouthSmile",
  "mouthSmileL",  "mouthSmileR",
  "mouthFrownL",  "mouthFrownR",
  "mouthPucker",
];

function getExpression(status: VoiceStatus): ExpressionPreset {
  switch (status) {
    case "ai_speaking": return EXPRESSIONS.speaking;
    case "ai_thinking": return EXPRESSIONS.thinking;
    case "listening":   return EXPRESSIONS.listening;
    case "ready":       return EXPRESSIONS.ready;
    case "connecting":  return EXPRESSIONS.connecting;
    default:            return EXPRESSIONS.neutral;
  }
}

/**
 * Advance the blink state machine by `delta` seconds.
 * Returns the target blink influence [0=open, 1=closed].
 */
function tickBlink(state: BlinkState, delta: number): number {
  state.timer -= delta;

  switch (state.phase) {
    case "open":
      if (state.timer <= 0) {
        state.phase = "closing";
        state.timer = BLINK_CLOSE_DURATION;
      }
      return 0;

    case "closing": {
      if (state.timer <= 0) {
        state.phase = "opening";
        state.timer = BLINK_OPEN_DURATION;
        return 1;
      }
      return 1 - state.timer / BLINK_CLOSE_DURATION;
    }

    case "opening": {
      if (state.timer <= 0) {
        state.phase = "open";
        state.timer = BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL);
        return 0;
      }
      return state.timer / BLINK_OPEN_DURATION;
    }
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseInterviewAvatarOptions {
  voiceStatus:  VoiceStatus;
  analyserNode: AnalyserNode | null;
}

export function useInterviewAvatar(opts: UseInterviewAvatarOptions): {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isLoading: boolean;
  loadError: string | null;
} {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mirror props into refs so the RAF loop never captures stale closures
  const voiceStatusRef  = useRef<VoiceStatus>(opts.voiceStatus);
  const analyserNodeRef = useRef<AnalyserNode | null>(opts.analyserNode);

  useEffect(() => { voiceStatusRef.current  = opts.voiceStatus;  }, [opts.voiceStatus]);
  useEffect(() => { analyserNodeRef.current = opts.analyserNode; }, [opts.analyserNode]);

  // Persist Three.js refs and RAF handle across re-renders
  const avatarRefsRef  = useRef<AvatarRefs | null>(null);
  const rafHandleRef   = useRef<number | null>(null);
  // Separate frequency and time-domain buffers for viseme analysis
  const freqBufRef     = useRef<Float32Array | null>(null);
  const timeBufRef     = useRef<Float32Array | null>(null);
  const blinkStateRef  = useRef<BlinkState>({
    phase: "open",
    timer: BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL),
  });

  // ── Mount effect: build scene, load GLB, start RAF ──────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
    let initRafId = 0;
    let ro: ResizeObserver | null = null;

    initRafId = requestAnimationFrame(() => {
      if (destroyed) return;

      const refs = buildScene(canvas);
      avatarRefsRef.current = refs;

      // ── ResizeObserver ───────────────────────────────────────────────
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !avatarRefsRef.current) return;
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) return;
        avatarRefsRef.current.renderer.setSize(width, height, false);
        avatarRefsRef.current.camera.aspect = width / height;
        avatarRefsRef.current.camera.updateProjectionMatrix();
      });
      ro.observe(canvas);

      // ── RAF animation loop ─────────────────────────────────────────
      function animationLoop() {
        rafHandleRef.current = requestAnimationFrame(animationLoop);
        const r = avatarRefsRef.current;
        if (!r || !r.headMesh) {
          if (r) r.renderer.render(r.scene, r.camera);
          return;
        }

        const delta   = r.clock.getDelta();
        const elapsed = r.clock.getElapsedTime();

        r.mixer?.update(delta);

        const node = analyserNodeRef.current;
        const status = voiceStatusRef.current;

        // ── Initialise / upgrade analyser buffers ───────────────────
        if (node && (!freqBufRef.current || !timeBufRef.current)) {
          // Upgrade fftSize to 1024 for better frequency resolution
          // (~15.6 Hz/bin at 16 kHz vs 31.25 Hz/bin at 512)
          node.fftSize = 1024;
          freqBufRef.current = new Float32Array(node.fftSize / 2); // freq bins
          timeBufRef.current = new Float32Array(node.fftSize);     // time samples
        }

        const m = r.headMesh;

        // ── Lip sync ────────────────────────────────────────────────
        if (status === "ai_speaking" && node && freqBufRef.current && timeBufRef.current) {
          if (r.hasVisemes) {
            // ── Viseme mode (RPM avatar): drive all 15 mouth shapes ──
            const vw = computeVisemes(node, freqBufRef.current, timeBufRef.current);
            for (const [vKey, mKey] of VISEME_KEYS) {
              setMorph(m, r.morphMap[mKey], vw[vKey], LERP_VISEME);
            }
            // Zero out the legacy jawOpen so it doesn't double-drive the jaw
            setMorph(m, r.morphMap.jawOpen, 0, LERP_VISEME);
          } else {
            // ── Fallback jaw mode: only jawOpen is available ─────────
            const jaw = computeJaw(node, timeBufRef.current);
            setMorph(m, r.morphMap.jawOpen, jaw, LERP_JAW);
          }
        } else {
          // Not speaking — relax to silence / expression pose
          if (r.hasVisemes) {
            for (const [vKey, mKey] of VISEME_KEYS) {
              const target = vKey === "sil" ? 1 : 0;
              setMorph(m, r.morphMap[mKey], target, LERP_VISEME);
            }
            setMorph(m, r.morphMap.jawOpen, 0, LERP_VISEME);
          } else {
            setMorph(m, r.morphMap.jawOpen, 0, LERP_JAW);
          }
        }

        // ── Expressions — lerp every expression morph toward the preset ─
        const preset = getExpression(status);
        for (const key of EXPRESSION_MORPH_KEYS) {
          setMorph(m, r.morphMap[key], preset[key] ?? 0, LERP_EXPR);
        }

        // ── Blink ────────────────────────────────────────────────────
        const blink = tickBlink(blinkStateRef.current, delta);
        setMorph(m, r.morphMap.eyeBlinkL, blink, 1.0);
        setMorph(m, r.morphMap.eyeBlinkR, blink, 1.0);

        // ── Idle head bob ────────────────────────────────────────────
        if (r.avatarRoot) {
          r.avatarRoot.rotation.y = Math.sin(elapsed * 1.5)       * 0.026;
          r.avatarRoot.rotation.z = Math.sin(elapsed * 0.9 + 1.2) * 0.009;
        }

        r.renderer.render(r.scene, r.camera);
      }

      rafHandleRef.current = requestAnimationFrame(animationLoop);

      // ── Load GLB ─────────────────────────────────────────────────────
      (async () => {
        try {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          const loader = new GLTFLoader();

          loader.load(
            "/avatar.glb",
            (gltf) => {
              if (destroyed) return;

              // Centre model at origin using bounding box
              const box = new THREE.Box3().setFromObject(gltf.scene);
              const centre = new THREE.Vector3();
              box.getCenter(centre);
              gltf.scene.position.sub(centre);

              refs.scene.add(gltf.scene);
              refs.avatarRoot = gltf.scene;

              // ── Animations ────────────────────────────────────────────
              if (gltf.animations.length > 0) {
                console.log("[Avatar] Animations:", gltf.animations.map((a) => a.name));
                const mixer = new THREE.AnimationMixer(gltf.scene);
                refs.mixer = mixer;

                const idleClip =
                  gltf.animations.find((a) => /idle/i.test(a.name)) ?? gltf.animations[0];

                const action = mixer.clipAction(idleClip);
                action.play();
                console.log(`[Avatar] Playing animation: "${idleClip.name}"`);
              } else {
                console.warn("[Avatar] No animations — applying manual arm pose");
                poseArmsDown(refs.scene);
              }

              // ── Fit camera to torso only (head → waist, legs hidden) ──
              const fittedBox = new THREE.Box3().setFromObject(gltf.scene);
              const size = new THREE.Vector3();
              fittedBox.getSize(size);

              // After centering, the model spans -size.y/2 (feet) to +size.y/2 (head).
              // Show only the upper ~55 % — head to just above the waistline.
              const torsoTopY    =  size.y * 0.50;
              const torsoBottomY =  size.y * -0.05;
              const torsoCenterY = (torsoTopY + torsoBottomY) / 2;
              const torsoHeight  =  torsoTopY - torsoBottomY;

              const fovRad  = (refs.camera.fov * Math.PI) / 180;
              const fitDist = (torsoHeight / 2) / Math.tan(fovRad / 2) * 1.1;

              refs.camera.position.set(0, torsoCenterY, fitDist);
              refs.camera.lookAt(0, torsoCenterY, 0);
              refs.camera.far = fitDist * 3;
              refs.camera.updateProjectionMatrix();

              // ── Discover morphs & visemes ──────────────────────────────
              const { mesh, map, hasVisemes } = discoverMorphMap(refs.scene);
              refs.headMesh   = mesh;
              refs.morphMap   = map;
              refs.hasVisemes = hasVisemes;

              setIsLoading(false);
            },
            undefined,
            (err) => {
              if (destroyed) return;
              console.error("[Avatar] Failed to load GLB:", err);
              setLoadError("Failed to load avatar model");
              setIsLoading(false);
            },
          );
        } catch (err) {
          if (destroyed) return;
          console.error("[Avatar] GLTFLoader import failed:", err);
          setLoadError("Failed to load avatar model");
          setIsLoading(false);
        }
      })();
    });

    // ── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      destroyed = true;
      cancelAnimationFrame(initRafId);

      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
      }

      ro?.disconnect();

      if (avatarRefsRef.current) {
        disposeScene(avatarRefsRef.current);
        avatarRefsRef.current = null;
      }

      freqBufRef.current = null;
      timeBufRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { canvasRef, isLoading, loadError };
}
