export type OrbPresetName = "crystal" | "dense-glass" | "liquid" | "soft-optical";

export type ElmoEmotion =
  | "neutral"
  | "happy"
  | "curious"
  | "focused"
  | "surprised"
  | "sleepy"
  | "excited"
  | "concerned";

export type ElmoGaze = "neutral" | "user" | "content" | "anticipate";

export type OrbWebGLSettings = {
  transmission: number;
  thickness: number;
  ior: number;
  roughness: number;
  chromaticAberration: number;
  distortion: number;
  temporalDistortion: number;
  environmentIntensity: number;
  innerLightIntensity: number;
  deformationAmplitude: number;
  deformationSpeed: number;
  innerMovementSpeed: number;
  innerDensity: number;
  faceIntensity: number;
  faceDepth: number;
  internalMatterIntensity: number;
  internalParallax: number;
  shellRefraction: number;
  shellDensity: number;
  fresnel: number;
  faceSafeZone: number;
  followCursor: boolean;
};

export const ORB_PRESETS: Record<OrbPresetName, OrbWebGLSettings> = {
  crystal: {
    transmission: 0.96,
    thickness: 1.45,
    ior: 1.26,
    roughness: 0.06,
    chromaticAberration: 0.018,
    distortion: 0.11,
    temporalDistortion: 0.045,
    environmentIntensity: 1.05,
    innerLightIntensity: 0.72,
    deformationAmplitude: 0.018,
    deformationSpeed: 0.18,
    innerMovementSpeed: 0.13,
    innerDensity: 0.34,
    faceIntensity: 0.92,
    faceDepth: 0.16,
    internalMatterIntensity: 0.64,
    internalParallax: 0.42,
    shellRefraction: 0.58,
    shellDensity: 0.42,
    fresnel: 0.82,
    faceSafeZone: 0.72,
    followCursor: false,
  },
  "dense-glass": {
    transmission: 0.79,
    thickness: 2.25,
    ior: 1.38,
    roughness: 0.14,
    chromaticAberration: 0.026,
    distortion: 0.17,
    temporalDistortion: 0.055,
    environmentIntensity: 0.92,
    innerLightIntensity: 0.58,
    deformationAmplitude: 0.024,
    deformationSpeed: 0.14,
    innerMovementSpeed: 0.1,
    innerDensity: 0.58,
    faceIntensity: 0.86,
    faceDepth: 0.2,
    internalMatterIntensity: 0.78,
    internalParallax: 0.34,
    shellRefraction: 0.72,
    shellDensity: 0.68,
    fresnel: 0.9,
    faceSafeZone: 0.76,
    followCursor: false,
  },
  liquid: {
    transmission: 0.94,
    thickness: 1.05,
    ior: 1.18,
    roughness: 0.16,
    chromaticAberration: 0.012,
    distortion: 0.1,
    temporalDistortion: 0.045,
    environmentIntensity: 0.7,
    innerLightIntensity: 0.78,
    deformationAmplitude: 0.025,
    deformationSpeed: 0.2,
    innerMovementSpeed: 0.17,
    innerDensity: 0.42,
    faceIntensity: 0.76,
    faceDepth: 0.18,
    internalMatterIntensity: 0.7,
    internalParallax: 0.56,
    shellRefraction: 0.38,
    shellDensity: 0.46,
    fresnel: 1.05,
    faceSafeZone: 0.74,
    followCursor: false,
  },
  "soft-optical": {
    transmission: 0.84,
    thickness: 1.9,
    ior: 1.22,
    roughness: 0.22,
    chromaticAberration: 0.012,
    distortion: 0.14,
    temporalDistortion: 0.035,
    environmentIntensity: 0.82,
    innerLightIntensity: 0.52,
    deformationAmplitude: 0.016,
    deformationSpeed: 0.11,
    innerMovementSpeed: 0.08,
    innerDensity: 0.5,
    faceIntensity: 0.84,
    faceDepth: 0.14,
    internalMatterIntensity: 0.56,
    internalParallax: 0.28,
    shellRefraction: 0.48,
    shellDensity: 0.58,
    fresnel: 0.74,
    faceSafeZone: 0.8,
    followCursor: false,
  },
};

export const DEFAULT_ORB_SETTINGS = ORB_PRESETS.liquid;

export type OrbPerformanceMetrics = {
  fps: number;
  frameTimeMs: number;
  sampleLimited: boolean;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  initTimeMs: number;
};
