import { useState, useEffect, useRef, useCallback } from 'react';
import { triggerHaptic } from '@/utils/haptic-feedback';

// === CONFIGURATION ===
// Tweak these numbers if detection is too hard/easy
const CONFIG = {
  // FLICK PHYSICS (Degrees per second)
  IMPULSE_THRESHOLD: 150,  // Speed needed to trigger PASS/SHOT
  
  // HOLD PHYSICS (Degrees deviation)
  SUSTAIN_THRESHOLD: 35,   // Angle needed to trigger TACKLE
  VOICE_THRESHOLD: 120,    // Angle needed for VOICE TAG (Upside down)
  
  // ADAPTIVE LOGIC
  BASE_RECENTER_SPEED: 0.02, // How fast the "Zero" adapts (0.0 - 1.0)
  SMOOTHING_FACTOR: 0.15,    // Noise reduction (0.0 - 1.0)
  
  // TIMING
  COOLDOWN_MS: 800,          // Time between gestures
};

interface VisualState {
  beta: number;        // Current tilt (Forward/Back)
  gamma: number;       // Current tilt (Left/Right)
  velBeta: number;     // Velocity Forward/Back
  velGamma: number;    // Velocity Left/Right
  isSteady: boolean;   // Is the user holding still?
}

export const useMotionProcessor = (
  onEvent: (type: string, confidence: number) => void
) => {
  const [isActive, setIsActive] = useState(false);
  const [permission, setPermission] = useState(false);
  
  // Visual state for the UI (Throttled updates)
  const [visuals, setVisuals] = useState<VisualState>({ 
    beta: 0, gamma: 0, velBeta: 0, velGamma: 0, isSteady: true 
  });

  // REFS (High-speed mutable data, no re-renders)
  const sensor = useRef({ beta: 0, gamma: 0, lastTs: 0 });
  const base = useRef({ beta: 0, gamma: 0 }); // The "Floating Zero"
  const velocity = useRef({ beta: 0, gamma: 0 });
  const cooldown = useRef(0);
  const frameId = useRef<number>();

  // 1. Request Sensor Permissions (iOS 13+ specific)
  const requestPermission = useCallback(async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          setPermission(true);
          setIsActive(true);
        }
      } catch (e) {
        console.error("Permission denied", e);
      }
    } else {
      // Non-iOS devices usually don't need explicit request
      setPermission(true);
      setIsActive(true);
    }
  }, []);

  // 2. Sensor Event Listener
  useEffect(() => {
    if (!isActive || !permission) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const now = performance.now();
      const dt = (now - sensor.current.lastTs) / 1000; // Delta time in seconds
      
      // Avoid division by zero or huge jumps on first frame
      if (dt <= 0 || dt > 1.0) {
        sensor.current.lastTs = now;
        sensor.current.beta = e.beta || 0;
        sensor.current.gamma = e.gamma || 0;
        return;
      }

      const rawBeta = e.beta || 0;
      const rawGamma = e.gamma || 0;

      // Calculate Velocity (Change / Time)
      const instVelBeta = (rawBeta - sensor.current.beta) / dt;
      const instVelGamma = (rawGamma - sensor.current.gamma) / dt;

      // Apply Low Pass Filter (Smoothing)
      // NewVelocity = (OldVelocity * (1-Factor)) + (InstantVelocity * Factor)
      velocity.current.beta = velocity.current.beta * (1 - CONFIG.SMOOTHING_FACTOR) + instVelBeta * CONFIG.SMOOTHING_FACTOR;
      velocity.current.gamma = velocity.current.gamma * (1 - CONFIG.SMOOTHING_FACTOR) + instVelGamma * CONFIG.SMOOTHING_FACTOR;

      // Update State
      sensor.current.lastTs = now;
      sensor.current.beta = rawBeta;
      sensor.current.gamma = rawGamma;
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isActive, permission]);

  // 3. The Logic Loop (60 FPS)
  useEffect(() => {
    if (!isActive) return;

    const loop = () => {
      const now = Date.now();
      const { beta, gamma } = sensor.current;
      const { beta: vBeta, gamma: vGamma } = velocity.current;

      // --- A. ADAPTIVE BASE LOGIC ---
      // Calculate deviation from the "Base" (Comfortable Zero)
      const devBeta = beta - base.current.beta;
      const devGamma = gamma - base.current.gamma;

      // Check if steady (Low velocity)
      const totalVel = Math.abs(vBeta) + Math.abs(vGamma);
      const isSteady = totalVel < 30; // Threshold for steadiness

      // If steady, slowly move "Base" towards current position
      // This fixes "Drift" where the user changes grip
      if (isSteady) {
        base.current.beta += (beta - base.current.beta) * CONFIG.BASE_RECENTER_SPEED;
        base.current.gamma += (gamma - base.current.gamma) * CONFIG.BASE_RECENTER_SPEED;
      }

      // Update UI (you could throttle this to 10fps for performance, keeping simple for now)
      setVisuals({
        beta: devBeta,
        gamma: devGamma,
        velBeta: vBeta,
        velGamma: vGamma,
        isSteady
      });

      // --- B. GESTURE DETECTION ENGINE ---
      if (now > cooldown.current) {
        let detectedType = null;
        let conf = 0.0;

        // 1. FLICK DETECTION (Impulse / Velocity)
        // These trigger on SPEED, not position.
        if (vBeta > CONFIG.IMPULSE_THRESHOLD) {
          detectedType = 'PASS';
          conf = Math.min(Math.abs(vBeta) / 200, 1.0);
        } else if (vBeta < -CONFIG.IMPULSE_THRESHOLD) {
          detectedType = 'SHOT';
          conf = Math.min(Math.abs(vBeta) / 200, 1.0);
        }

        // 2. HOLD DETECTION (Position / Sustain)
        // These trigger on ANGLE relative to base.
        else if (Math.abs(devGamma) > CONFIG.SUSTAIN_THRESHOLD) {
          detectedType = 'TACKLE';
          conf = 0.9;
        }
        else if (beta > CONFIG.VOICE_THRESHOLD || beta < -CONFIG.VOICE_THRESHOLD) {
          detectedType = 'VOICE_TAG';
          conf = 1.0;
        }
        else if (Math.abs(vGamma) > 100 && Math.abs(vBeta) > 100) {
          detectedType = 'FOUL'; // Shake
          conf = 0.8;
        }

        // --- C. EVENT TRIGGER ---
        if (detectedType) {
          onEvent(detectedType, conf);
          triggerHaptic(detectedType === 'VOICE_TAG' ? 'light' : 'medium');
          
          // Set Cooldown
          cooldown.current = now + CONFIG.COOLDOWN_MS;
          
          // Soft Reset Base after non-voice gestures
          // This prevents double-triggering as you return hand to center
          if (detectedType !== 'VOICE_TAG') {
            base.current = { beta, gamma }; 
            velocity.current = { beta: 0, gamma: 0 }; // Reset velocity buffer
          }
        }
      }

      frameId.current = requestAnimationFrame(loop);
    };

    frameId.current = requestAnimationFrame(loop);
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, [isActive, onEvent]);

  return {
    isActive,
    permission,
    visuals,
    requestPermission,
    toggle: () => setIsActive(!isActive)
  };
};
