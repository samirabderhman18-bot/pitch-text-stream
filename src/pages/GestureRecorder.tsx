/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Smartphone, AlertCircle, Zap, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
// Assuming these types exist in your project, otherwise defined locally below
import { SoccerEvent, SoccerEventType } from '@/types/soccer-events';
import EventTimeline from '@/components/EventTimeline';
import { triggerHaptic } from '@/utils/haptic-feedback';

/* ==========================  CONFIG  ========================== */
const CONFIG = {
  FPS: 15,
  COOLDOWN_MS: 700,
  HOLD_PASS_FRAMES: 3,
  HOLD_SHOT_FRAMES: 3,
  HOLD_TACKLE_FRAMES: 4,
  HOLD_VOICE_FRAMES: 6,
  HOLD_FOUL_FRAMES: 3,
  HOLD_CORNER_FRAMES: 4,
  HOLD_OFFSIDE_FRAMES: 4,
  HOLD_SUB_FRAMES: 5,
  LEARNING_DURATION_MS: 2000,
  JITTER_MARGIN: 1.5,
  PATTERN_WINDOW_MS: 2000,
  PATTERN_MIN_SAMPLES: 8,
} as const;

/* ==========================  TYPES  ========================== */
interface Kalman3D {
  x: Kalman1D;
  y: Kalman1D;
  z: Kalman1D;
}
interface Vec3 { x: number; y: number; z: number }
interface GestureSample extends Vec3 {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  ts: number;
}
interface JitterZone {
  centerBeta: number;
  centerGamma: number;
  radiusBeta: number;
  radiusGamma: number;
}
interface PatternPoint {
  beta: number;
  gamma: number;
  ts: number;
  velocity: number;
}
interface MovementPattern {
  name: string;
  detected: boolean;
  confidence: number;
  path: string;
}

// Local definition to satisfy the missing types in the original code
interface GestureCapturedEvent extends SoccerEvent {
  eventSource: 'gesture-capture' | 'pattern-capture';
  gestureType?: string;
  soccerEventType: string;
  patternData?: {
    path: string;
    velocity: number;
    duration: number;
    samples: number;
  };
}

/* ==========================  KALMAN 1-D  ========================== */
class Kalman1D {
  private q = 0.003;
  private r = 0.25;
  private p = 0;
  private x = 0;
  private k = 0;
  update(m: number): number {
    this.p += this.q;
    this.k = this.p / (this.p + this.r);
    this.x += this.k * (m - this.x);
    this.p *= 1 - this.k;
    return this.x;
  }
}

/* ==========================  GESTURE DECISION  ========================== */
interface ThresholdConfig {
  PASS_MIN: number;
  PASS_MAX: number;
  PASS_ENABLED: boolean;
  SHOT_MIN: number;
  SHOT_ENABLED: boolean;
  TACKLE_MIN: number;
  TACKLE_ENABLED: boolean;
  VOICE_TAG_THRESHOLD: number;
  VOICE_TAG_ENABLED: boolean;
  FOUL_GAMMA_MIN: number;
  FOUL_BETA_MIN: number;
  FOUL_ENABLED: boolean;
  CORNER_MIN: number;
  CORNER_MAX: number;
  CORNER_ENABLED: boolean;
  OFFSIDE_MIN: number;
  OFFSIDE_MAX: number;
  OFFSIDE_ENABLED: boolean;
  SUBSTITUTION_ENABLED: boolean;
  CIRCULAR_ENABLED: boolean;
  FIGURE_8_ENABLED: boolean;
  ZIGZAG_ENABLED: boolean;
  SHAKE_ENABLED: boolean;
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  PASS_MIN: 40,
  PASS_MAX: 85,
  PASS_ENABLED: true,
  SHOT_MIN: 25,
  SHOT_ENABLED: true,
  TACKLE_MIN: 40,
  TACKLE_ENABLED: true,
  VOICE_TAG_THRESHOLD: 110,
  VOICE_TAG_ENABLED: true,
  FOUL_GAMMA_MIN: 55,
  FOUL_BETA_MIN: 25,
  FOUL_ENABLED: true,
  CORNER_MIN: 15,
  CORNER_MAX: 40,
  CORNER_ENABLED: true,
  OFFSIDE_MIN: 15,
  OFFSIDE_MAX: 40,
  OFFSIDE_ENABLED: true,
  SUBSTITUTION_ENABLED: true,
  CIRCULAR_ENABLED: true,
  FIGURE_8_ENABLED: true,
  ZIGZAG_ENABLED: true,
  SHAKE_ENABLED: true,
};

type Rule = (s: GestureSample, base: GestureSample, thresholds: ThresholdConfig) => boolean;
const RULES: Record<string, Rule> = {
  PASS: (s, b, t) => s.beta > b.beta + t.PASS_MIN && s.beta < b.beta + t.PASS_MAX && Math.abs(s.gamma - b.gamma) < 25,
  SHOT: (s, b, t) => s.beta < b.beta - t.SHOT_MIN && Math.abs(s.gamma - b.gamma) < 25,
  TACKLE: (s, b, t) => Math.abs(s.gamma - b.gamma) > t.TACKLE_MIN && Math.abs(s.beta - b.beta) < 25,
  VOICE_TAG: (s, b, t) => s.beta < -t.VOICE_TAG_THRESHOLD || s.beta > t.VOICE_TAG_THRESHOLD,
  FOUL: (s, b, t) => Math.abs(s.gamma - b.gamma) > t.FOUL_GAMMA_MIN && Math.abs(s.beta - b.beta) > t.FOUL_BETA_MIN,
  CORNER: (s, b, t) => s.gamma > b.gamma + t.CORNER_MIN && s.gamma < b.gamma + t.CORNER_MAX && Math.abs(s.beta - b.beta) < 12,
  OFFSIDE: (s, b, t) => s.gamma < b.gamma - t.OFFSIDE_MIN && s.gamma > b.gamma - t.OFFSIDE_MAX && Math.abs(s.beta - b.beta) < 12,
  SUBSTITUTION: (s, b) => Math.abs(s.beta - b.beta) < 10 && Math.abs(s.gamma - b.gamma) < 10,
};

const FRAMES_NEEDED: Record<string, number> = {
  PASS: CONFIG.HOLD_PASS_FRAMES,
  SHOT: CONFIG.HOLD_SHOT_FRAMES,
  TACKLE: CONFIG.HOLD_TACKLE_FRAMES,
  VOICE_TAG: CONFIG.HOLD_VOICE_FRAMES,
  FOUL: CONFIG.HOLD_FOUL_FRAMES,
  CORNER: CONFIG.HOLD_CORNER_FRAMES,
  OFFSIDE: CONFIG.HOLD_OFFSIDE_FRAMES,
  SUBSTITUTION: CONFIG.HOLD_SUB_FRAMES,
};

/* ==========================  PATTERN DETECTION HELPERS ========================== */
// ... (Your pattern detection functions detectCircularMotion, detectFigure8, etc. remain unchanged)
const detectCircularMotion = (points: PatternPoint[]): { detected: boolean; confidence: number } => {
    if (points.length < 12) return { detected: false, confidence: 0 };
    const centerBeta = points.reduce((sum, p) => sum + p.beta, 0) / points.length;
    const centerGamma = points.reduce((sum, p) => sum + p.gamma, 0) / points.length;
    const distances = points.map(p => Math.sqrt(Math.pow(p.beta - centerBeta, 2) + Math.pow(p.gamma - centerGamma, 2)));
    const avgDist = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDist, 2), 0) / distances.length;
    const consistency = 1 - Math.min(variance / (avgDist * avgDist), 1);
    const angles = points.map(p => Math.atan2(p.gamma - centerGamma, p.beta - centerBeta));
    let totalAngle = 0;
    for (let i = 1; i < angles.length; i++) {
      let diff = angles[i] - angles[i - 1];
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff < -Math.PI) diff += 2 * Math.PI;
      totalAngle += Math.abs(diff);
    }
    const coverage = totalAngle / (2 * Math.PI);
    const detected = consistency > 0.6 && coverage > 0.5 && avgDist > 15;
    return { detected, confidence: detected ? Math.min(consistency * coverage, 0.95) : 0 };
  };
  
  const detectFigure8 = (points: PatternPoint[]): { detected: boolean; confidence: number } => {
    if (points.length < 16) return { detected: false, confidence: 0 };
    const mid = Math.floor(points.length / 2);
    const first = points.slice(0, mid);
    const second = points.slice(mid);
    const firstCircle = detectCircularMotion(first);
    const secondCircle = detectCircularMotion(second);
    const center1Beta = first.reduce((sum, p) => sum + p.beta, 0) / first.length;
    const center2Beta = second.reduce((sum, p) => sum + p.beta, 0) / second.length;
    const offset = Math.abs(center1Beta - center2Beta);
    const detected = firstCircle.detected && secondCircle.detected && offset > 10;
    const confidence = detected ? Math.min((firstCircle.confidence + secondCircle.confidence) / 2, 0.95) : 0;
    return { detected, confidence };
  };
  
  const detectZigzag = (points: PatternPoint[]): { detected: boolean; confidence: number } => {
    if (points.length < 8) return { detected: false, confidence: 0 };
    let peaks = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1].gamma;
      const curr = points[i].gamma;
      const next = points[i + 1].gamma;
      if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
        peaks++;
      }
    }
    const detected = peaks >= 3;
    const confidence = detected ? Math.min(peaks / 5, 0.95) : 0;
    return { detected, confidence };
  };
  
  const detectShake = (points: PatternPoint[]): { detected: boolean; confidence: number } => {
    if (points.length < 6) return { detected: false, confidence: 0 };
    let rapidChanges = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i].velocity > 80) rapidChanges++;
    }
    const detected = rapidChanges >= 4;
    const confidence = detected ? Math.min(rapidChanges / 6, 0.95) : 0;
    return { detected, confidence };
  };

/* ==========================  COMPONENT  ========================== */
const GestureRecorder = () => {
  const nav = useNavigate();
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  // Use GestureCapturedEvent which extends SoccerEvent
  const [events, setEvents] = useState<GestureCapturedEvent[]>([]);
  const [gyro, setGyro] = useState<Vec3 & { alpha: number | null }>({ x: 0, y: 0, z: 0, alpha: null });
  const [permission, setPermission] = useState(false);
  const [voice, setVoice] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [learningProgress, setLearningProgress] = useState(0);
  const [jitterZone, setJitterZone] = useState<JitterZone | null>(null);
  
  // FIX: Use Ref for high-frequency pattern history to avoid re-renders in loop
  const patternHistoryRef = useRef<PatternPoint[]>([]);
  const [detectedPattern, setDetectedPattern] = useState<MovementPattern | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);

  /* ----------  REFS  ---------- */
  const kalRef = useRef<Kalman3D>({ x: new Kalman1D(), y: new Kalman1D(), z: new Kalman1D() });
  const baseRef = useRef<GestureSample | null>(null);
  const cntRef = useRef<Record<string, number>>({});
  const lastGestureRef = useRef<string | null>(null);
  const cooldownRef = useRef(0);
  const learningSamplesRef = useRef<{ beta: number; gamma: number }[]>([]);
  const learningStartRef = useRef<number>(0);

  /* ----------  LOAD THRESHOLDS  ---------- */
  useEffect(() => {
    const saved = localStorage.getItem('gesture-thresholds');
    if (saved) {
      try {
        const loadedThresholds = JSON.parse(saved);
        setThresholds({ ...DEFAULT_THRESHOLDS, ...loadedThresholds });
      } catch (e) {
        console.warn('Failed to load thresholds:', e);
      }
    }
  }, []);

  /* ----------  PERMISSION  ---------- */
  const ask = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (DeviceOrientationEvent as any).requestPermission();
      setPermission(res === 'granted');
      toast({ title: res === 'granted' ? 'Access granted' : 'Access denied', variant: res === 'granted' ? 'default' : 'destructive' });
    } else {
        setPermission(true);
    }
  }, [toast]);

  /* ----------  ADD EVENT (Unified)  ---------- */
  const addEvent = useCallback((
    type: string, 
    category: 'GESTURE' | 'PATTERN',
    patternData?: { path: string; velocity: number; duration: number; samples: number },
    confidence: number = 0.95
  ) => {
    const ev: GestureCapturedEvent = {
      eventSource: category === 'PATTERN' ? 'pattern-capture' : 'gesture-capture',
      type: type as SoccerEventType, // Cast for compatibility
      soccerEventType: type,
      gestureType: category === 'GESTURE' ? 'MOTION' : 'PATTERN', // Simplified
      timestamp: Date.now(),
      text: `${type} detected via ${category}`,
      confidence: confidence,
      protocolType: 'Player — Event',
      patternData
    };

    setEvents((e) => [ev, ...e]);
    toast({ title: `${type} recorded` });
  }, [toast]);

  /* ----------  START LEARNING  ---------- */
  const startLearning = useCallback(() => {
    setIsLearning(true);
    setLearningProgress(0);
    learningSamplesRef.current = [];
    learningStartRef.current = Date.now();
    setJitterZone(null);
    toast({ title: '🎯 Learning your grip...', description: 'Hold phone naturally for 2 seconds' });
  }, [toast]);

  /* ----------  FINISH LEARNING  ---------- */
  const finishLearning = useCallback(() => {
    const samples = learningSamplesRef.current;
    if (samples.length < 5) {
      setIsLearning(false);
      return;
    }

    const sumBeta = samples.reduce((acc, s) => acc + s.beta, 0);
    const sumGamma = samples.reduce((acc, s) => acc + s.gamma, 0);
    const centerBeta = sumBeta / samples.length;
    const centerGamma = sumGamma / samples.length;

    const varBeta = samples.reduce((acc, s) => acc + Math.pow(s.beta - centerBeta, 2), 0) / samples.length;
    const varGamma = samples.reduce((acc, s) => acc + Math.pow(s.gamma - centerGamma, 2), 0) / samples.length;
    const radiusBeta = Math.sqrt(varBeta) * CONFIG.JITTER_MARGIN;
    const radiusGamma = Math.sqrt(varGamma) * CONFIG.JITTER_MARGIN;

    const zone: JitterZone = {
      centerBeta,
      centerGamma,
      radiusBeta: Math.max(radiusBeta, 5),
      radiusGamma: Math.max(radiusGamma, 5),
    };

    setJitterZone(zone);
    setIsLearning(false);
    toast({ title: '✅ Jitter zone learned!', description: `±${zone.radiusBeta.toFixed(1)}° β, ±${zone.radiusGamma.toFixed(1)}° γ` });
  }, [toast]);

  /* ----------  CHECK IF OUTSIDE JITTER ZONE  ---------- */
  const isOutsideJitterZone = useCallback((beta: number, gamma: number): boolean => {
    if (!jitterZone) return true;
    const deltaBeta = Math.abs(beta - jitterZone.centerBeta);
    const deltaGamma = Math.abs(gamma - jitterZone.centerGamma);
    return deltaBeta > jitterZone.radiusBeta || deltaGamma > jitterZone.radiusGamma;
  }, [jitterZone]);

  /* ----------  SENSOR LOOP  ---------- */
  useEffect(() => {
    if (!isActive || !permission) return;

    let frame = 0;
    const onOrient = (e: DeviceOrientationEvent) => {
      frame++;
      if (frame % Math.round(60 / CONFIG.FPS) !== 0) return;

      const β = e.beta ?? 0;
      const γ = e.gamma ?? 0;
      const α = e.alpha;
      const now = Date.now();

      /* Update gyro display */
      setGyro({ x: β, y: γ, z: 0, alpha: α });

      /* LEARNING PHASE */
      if (isLearning) {
        const elapsed = now - learningStartRef.current;
        const progress = Math.min(elapsed / CONFIG.LEARNING_DURATION_MS, 1);
        setLearningProgress(progress);

        learningSamplesRef.current.push({ beta: β, gamma: γ });

        if (progress >= 1) {
          finishLearning();
        }
        return;
      }

      /* Check if outside jitter zone */
      const outsideJitter = isOutsideJitterZone(β, γ);
      if (!outsideJitter) {
        cntRef.current = {};
        // If inside jitter zone, we still track patterns? 
        // Usually pattern detection wants continuous movement, 
        // but let's assume we reset if we return to "steady" state
        // patternHistoryRef.current = []; 
        // ^ logic choice: do we clear pattern if they stop moving?
        return; 
      }

      /* Add to pattern history (Use Ref) */
      const currentHistory = patternHistoryRef.current;
      const prevPoint = currentHistory[currentHistory.length - 1];
      const velocity = prevPoint 
        ? Math.sqrt(Math.pow(β - prevPoint.beta, 2) + Math.pow(γ - prevPoint.gamma, 2)) / ((now - prevPoint.ts) / 1000)
        : 0;
      
      const newPoint: PatternPoint = { beta: β, gamma: γ, ts: now, velocity };
      
      // Clean old points and add new
      const updatedHistory = [...currentHistory, newPoint].filter(p => now - p.ts < CONFIG.PATTERN_WINDOW_MS);
      patternHistoryRef.current = updatedHistory;

      /* Check for movement patterns */
      if (updatedHistory.length >= CONFIG.PATTERN_MIN_SAMPLES) {
        const circular = detectCircularMotion(updatedHistory);
        const figure8 = detectFigure8(updatedHistory);
        const zigzag = detectZigzag(updatedHistory);
        const shake = detectShake(updatedHistory);

        const patterns = [
          { name: 'CIRCULAR', ...circular, enabled: thresholds.CIRCULAR_ENABLED },
          { name: 'FIGURE_8', ...figure8, enabled: thresholds.FIGURE_8_ENABLED },
          { name: 'ZIGZAG', ...zigzag, enabled: thresholds.ZIGZAG_ENABLED },
          { name: 'SHAKE', ...shake, enabled: thresholds.SHAKE_ENABLED },
        ];
        
        const best = patterns.filter(p => p.enabled).reduce((max, p) => p.confidence > max.confidence ? p : max, { confidence: 0, name: '', detected: false, enabled: false });
        
        // !!! FIX: This logic block was previously floating outside the useEffect
        if (best.detected && best.confidence > 0.7 && now > cooldownRef.current) {
          const minBeta = Math.min(...updatedHistory.map(p => p.beta));
          const maxBeta = Math.max(...updatedHistory.map(p => p.beta));
          const minGamma = Math.min(...updatedHistory.map(p => p.gamma));
          const maxGamma = Math.max(...updatedHistory.map(p => p.gamma));
          
          const scaleBeta = (b: number) => ((b - minBeta) / (maxBeta - minBeta || 1)) * 80 + 10;
          const scaleGamma = (g: number) => ((g - minGamma) / (maxGamma - minGamma || 1)) * 80 + 10;
          
          const pathData = updatedHistory.map((p, i) => 
            `${i === 0 ? 'M' : 'L'} ${scaleBeta(p.beta)} ${scaleGamma(p.gamma)}`
          ).join(' ');

          setDetectedPattern({
            name: best.name,
            detected: true,
            confidence: best.confidence,
            path: pathData,
          });

          // Add Event
          addEvent(best.name, 'PATTERN', {
            path: pathData,
            velocity: updatedHistory[updatedHistory.length - 1].velocity,
            duration: now - updatedHistory[0].ts,
            samples: updatedHistory.length,
          }, best.confidence);

          triggerHaptic('medium');
          
          // Clear history after detection
          patternHistoryRef.current = [];
          cooldownRef.current = now + CONFIG.COOLDOWN_MS;
          setTimeout(() => setDetectedPattern(null), 2000);
          
          return; // Stop processing simple gestures if pattern found
        }
      }

      /* Kalman smooth */
      const k = kalRef.current;
      const sample: GestureSample = {
        x: k.x.update(β),
        y: k.y.update(γ),
        z: k.z.update(0),
        beta: β,
        gamma: γ,
        alpha: α,
        ts: now,
      };

      /* base angle */
      if (!baseRef.current) baseRef.current = { ...sample };
      const base = baseRef.current;

      /* rule engine */
      if (now < cooldownRef.current) return;

      let winner: string | null = null;
      for (const [name, rule] of Object.entries(RULES)) {
        const isEnabled = thresholds[(name + '_ENABLED') as keyof ThresholdConfig];
        if (isEnabled && rule(sample, base, thresholds)) {
          cntRef.current[name] = (cntRef.current[name] || 0) + 1;
          if (cntRef.current[name] >= FRAMES_NEEDED[name]) {
            winner = name;
            break;
          }
        } else cntRef.current[name] = 0;
      }
      if (!winner || winner === lastGestureRef.current) return;

      /* conflict lockout */
      cooldownRef.current = now + CONFIG.COOLDOWN_MS;
      lastGestureRef.current = winner;

      setCurrentGesture(winner);
      if (winner === 'VOICE_TAG') {
        setVoice(true);
        triggerHaptic('light');
      } else {
        addEvent(winner, 'GESTURE');
        setVoice(false);
        triggerHaptic('medium');
      }
      setTimeout(() => setCurrentGesture(null), 1000);
    };

    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [isActive, permission, isLearning, isOutsideJitterZone, finishLearning, addEvent]); // Removed patternHistory from deps

  /* ----------  START LEARNING WHEN ACTIVATED  ---------- */
  useEffect(() => {
    if (isActive && permission) {
      startLearning();
    }
  }, [isActive, permission, startLearning]);

  /* ----------  UI  ---------- */
  const toggle = () => {
    if (!permission) ask();
    else setIsActive((v) => !v);
  };

  const recalibrate = () => {
    startLearning();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-pitch-green/5">
      <div className="container mx-auto px-4 py-8">
        {/* UI Render code (Identical to original) */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => nav('/')} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <h1 className="text-3xl font-bold">Smart Gesture Recorder</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => nav('/calibration')} className="gap-2">
            <Settings className="h-4 w-4" /> Calibrate
          </Button>
        </div>

        {!permission && (
          <Card className="p-6 mb-6 border-accent">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-accent mt-0.5" />
              <div>
                <h3 className="font-semibold mb-2">Permission Required</h3>
                <p className="text-sm text-muted-foreground mb-4">Gyroscope access is needed for gesture detection.</p>
                <Button onClick={ask}>
                  <Smartphone className="h-4 w-4 mr-2" /> Enable Gyroscope
                </Button>
              </div>
            </div>
          </Card>
        )}

        {isLearning && (
          <Card className="p-6 mb-6 border-blue-500 bg-blue-500/5">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  🎯 Learning your natural grip...
                </h3>
                <p className="text-sm text-muted-foreground mb-3">Hold your phone naturally. Walk around if you like!</p>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full transition-all duration-100"
                    style={{ width: `${learningProgress * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{Math.round(learningProgress * 100)}% complete</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Live Orientation</h2>
              {jitterZone && !isLearning && (
                <Badge variant="outline" className="text-xs">
                  Jitter: ±{jitterZone.radiusBeta.toFixed(0)}°
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-center mb-3" style={{ height: '140px' }}>
              <PhoneVisualization alpha={gyro.alpha} beta={gyro.x} gamma={gyro.y} compact />
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2 bg-muted rounded text-center">
                <div className="text-muted-foreground">α</div>
                <div>{gyro.alpha?.toFixed(0) ?? '—'}°</div>
              </div>
              <div className="p-2 bg-muted rounded text-center">
                <div className="text-muted-foreground">β</div>
                <div>{gyro.x.toFixed(0)}°</div>
              </div>
              <div className="p-2 bg-muted rounded text-center">
                <div className="text-muted-foreground">γ</div>
                <div>{gyro.y.toFixed(0)}°</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>
            <Button onClick={toggle} variant={isActive ? 'destructive' : 'default'} size="lg" className="w-full mb-3">
              {isActive ? 'Stop Recording' : 'Start Recording'}
            </Button>

            {jitterZone && !isLearning && (
              <Button onClick={recalibrate} variant="outline" size="sm" className="w-full mb-4">
                <Zap className="h-4 w-4 mr-2" />
                Re-learn Jitter Zone
              </Button>
            )}

            {currentGesture && (
              <div className="mb-4">
                <Badge variant="default" className="text-lg px-4 py-2">{currentGesture}</Badge>
              </div>
            )}

            {voice && (
              <div className="p-4 bg-accent/10 rounded-lg border border-accent">
                <p className="text-sm font-medium">🎤 Voice Tag Mode Active</p>
                <p className="text-xs text-muted-foreground mt-1">Hold phone upside-down and speak the player number</p>
              </div>
            )}

            {jitterZone && !isLearning && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  ✓ Jitter zone active: ignoring small movements within ±{jitterZone.radiusBeta.toFixed(1)}° (β) and ±{jitterZone.radiusGamma.toFixed(1)}° (γ)
                </p>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Gesture Guide</h2>
            <div className="space-y-2">
              <GestureItem gesture="Flick Forward" event="PASS" />
              <GestureItem gesture="Back Flick" event="SHOT" />
              <GestureItem gesture="Tilt Left/Right" event="TACKLE" />
              <GestureItem gesture="Upside-Down Hold" event="VOICE TAG" />
              <GestureItem gesture="Shake / Twist" event="FOUL" />
              <GestureItem gesture="Gentle Tilt Right" event="CORNER" />
              <GestureItem gesture="Gentle Tilt Left" event="OFFSIDE" />
              <GestureItem gesture="Flat & Steady" event="SUBSTITUTION" />
            </div>
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-semibold mb-2 text-accent">Movement Patterns</h3>
              <div className="space-y-2">
                <GestureItem gesture="Draw Circle" event="CIRCULAR" isPattern />
                <GestureItem gesture="Draw Figure-8" event="FIGURE_8" isPattern />
                <GestureItem gesture="Zigzag Motion" event="ZIGZAG" isPattern />
                <GestureItem gesture="Rapid Shake" event="SHAKE" isPattern />
              </div>
            </div>
          </Card>
        </div>

        {detectedPattern && (
          <div className="mt-6">
            <Card className="p-6 border-accent">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    Pattern Detected: {detectedPattern.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Confidence: {(detectedPattern.confidence * 100).toFixed(0)}%
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default" className="text-xs">Time-based Detection</Badge>
                    <Badge variant="outline" className="text-xs">{patternHistoryRef.current.length} samples</Badge>
                  </div>
                </div>
                <svg width="100" height="100" viewBox="0 0 100 100" className="border rounded-lg bg-muted/20">
                  <path 
                    d={detectedPattern.path} 
                    stroke="hsl(var(--accent))" 
                    strokeWidth="2" 
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="10" cy="10" r="3" fill="hsl(var(--primary))" />
                  <circle cx="90" cy="90" r="3" fill="hsl(var(--destructive))" />
                </svg>
              </div>
            </Card>
          </div>
        )}

        {events.length > 0 && (
          <div className="mt-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Recorded Events</h2>
              <EventTimeline events={events} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

/* ==========================  PHONE VISUALIZATION  ========================== */
const PhoneVisualization = ({ alpha, beta, gamma, compact }: { alpha: number | null; beta: number; gamma: number; compact?: boolean }) => {
  const size = compact ? 60 : 80;
  const height = compact ? 105 : 140;
  
  const style: React.CSSProperties = {
    width: `${size}px`,
    height: `${height}px`,
    position: 'relative',
    transformStyle: 'preserve-3d',
    transform: `
      rotateZ(${alpha ?? 0}deg)
      rotateX(${beta}deg)
      rotateY(${gamma}deg)
    `,
    transition: 'transform 0.1s ease-out',
  };

  return (
    <div style={{ perspective: '600px' }}>
      <div style={style}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl border-2 border-slate-600 shadow-xl">
          <div className="absolute inset-2 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl opacity-80" />
          {!compact && (
            <>
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-slate-950 rounded-full" />
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-slate-950/40 rounded-full" />
            </>
          )}
        </div>
        <div 
          className="absolute inset-0 rounded-2xl" 
          style={{ 
            transform: 'translateZ(-3px)',
            background: 'rgba(0,0,0,0.4)',
            filter: 'blur(1px)'
          }} 
        />
      </div>
    </div>
  );
};

const GestureItem = ({ gesture, event, isPattern }: { gesture: string; event: string; isPattern?: boolean }) => (
  <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
    <span className="text-xs font-medium">{gesture}</span>
    <Badge variant={isPattern ? "default" : "outline"} className="text-xs">{event}</Badge>
  </div>
);

export default GestureRecorder;
