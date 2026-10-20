export const BEVERAGE_TYPES = {
  water: { vol: 180, rate: 8.0, hyd: 1.0 },
  coffee: { vol: 120, rate: 22.0, hyd: 0.3 },
  soda: { vol: 320, rate: 16.0, hyd: 0.45 },
  beer: { vol: 480, rate: 26.0, hyd: 0.4 }
};

export const PHYSICS_CONFIGS = {
  jello: {
    springK: 18.0,
    damping: 0.82,
    jiggleFreq: 14.0,
    jiggleDecay: 2.2,
    sloshSpring: 14.0,
    sloshDamping: 0.91,
    rippleDecay: 3.5,
    squishForce: 2.2,
    waveSpeed: 7.5
  },
  balloon: {
    springK: 32.0,
    damping: 0.88,
    jiggleFreq: 22.0,
    jiggleDecay: 3.8,
    sloshSpring: 22.0,
    sloshDamping: 0.94,
    rippleDecay: 5.0,
    squishForce: 1.8,
    waveSpeed: 9.5
  },
  anatomical: {
    springK: 24.0,
    damping: 0.78,
    jiggleFreq: 16.0,
    jiggleDecay: 4.5,
    sloshSpring: 18.0,
    sloshDamping: 0.92,
    rippleDecay: 6.0,
    squishForce: 1.4,
    waveSpeed: 6.5
  },
  highTension: {
    springK: 48.0,
    damping: 0.65,
    jiggleFreq: 30.0,
    jiggleDecay: 7.0,
    sloshSpring: 35.0,
    sloshDamping: 0.85,
    rippleDecay: 9.0,
    squishForce: 0.9,
    waveSpeed: 12.0
  }
};
