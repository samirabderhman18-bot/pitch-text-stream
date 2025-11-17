/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Smartphone, AlertCircle, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { SoccerEvent, SoccerEventType } from '@/types/soccer-events';
import EventTimeline from '@/components/EventTimeline';

/* ==========================  CONFIG  ========================== */
const CONFIG = {
  FPS: 15,
  COOLDOWN_MS: 700,
  LEARNING_DURATION_MS: 2000,
  JITTER_MARGIN: 1.5,
  HISTORY_SIZE: 30, // ~2 seconds of data at 15 FPS
  VELOCITY_THRESHOLD_SHARP: 250, // deg/s for sharp flicks
  VELOCITY_THRESHOLD_GENTLE: 50, // deg/s for gentle tilts
  STABILITY_THRESHOLD: 15, // deg/s for holding steady
  HOLD_DURATION_FRAMES: 5, // frames needed to confirm a hold gesture
} as const;

/* ==========================  TYPES  ========================== */
interface Kalman3D {
  x: Kalman1D;
  y: Kalman1D;
  z: Kalman1D;
}
interface Vec3 { x: number; y: number; z: number }

// New Type: Represents a single snapshot of device orientation and motion
interface MotionSample {
  ts: number;
  beta: number;
  gamma: number;
  alpha: number | null;
  betaVelocity: number;
  gammaVelocity: number;
}

interface JitterZone {
  centerBeta: number;
  centerGamma: number;
  radiusBeta: number;
  radiusGamma: number;
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

/* ==========================  MOVEMENT PATTERN ENGINE  ========================== */
// Analyzes a history of motion to detect a gesture.
type MovementPatternMatcher = (history: MotionSample[]) => boolean;

// Defines each gesture by its name and a pattern matching function.
const PATTERNS: { name: SoccerEventType; matcher: MovementPatternMatcher; duration: number }[] = [
  {
    name: 'PASS',
    duration: 1,
    matcher: (h) => {
      const last = h[h.length - 1];
      if (!last) return false;
      // Sharp forward velocity peak (flick forward)
      return last.betaVelocity > CONFIG.VELOCITY_THRESHOLD_SHARP && Math.abs(last.gammaVelocity) < CONFIG.VELOCITY_THRESHOLD_SHARP / 2;
    },
  },
  {
    name: 'SHOT',
    duration: 1,
    matcher: (h) => {
      const last = h[h.length - 1];
      if (!last) return false;
      // Sharp backward velocity peak (flick backward)
      return last.betaVelocity < -CONFIG.VELOCITY_THRESHOLD_SHARP && Math.abs(last.gammaVelocity) < CONFIG.VELOCITY_THRESHOLD_SHARP / 2;
    },
  },
  {
    name: 'TACKLE',
    duration: 1,
    matcher: (h) => {
      const last = h[h.length - 1];
      if (!last) return false;
      // Sharp sideways velocity peak (tilt left/right)
      return Math.abs(last.gammaVelocity) > CONFIG.VELOCITY_THRESHOLD_SHARP && Math.abs(last.betaVelocity) < CONFIG.VELOCITY_THRESHOLD_SHARP / 2;
    },
  },
    {
    name: 'FOUL', // A more violent, less precise shake
    duration: 1,
    matcher: (h) => {
      const last = h[h.length - 1];
      if (!last) return false;
      // High velocity in both axes simultaneously
      return Math.abs(last.gammaVelocity) > CONFIG.VELOCITY_THRESHOLD_SHARP * 0.8 && Math.abs(last.betaVelocity) > CONFIG.VELOCITY_THRESHOLD_SHARP * 0.8;
    },
  },
  {
    name: 'VOICE_TAG',
    duration: CONFIG.HOLD_DURATION_FRAMES,
    matcher: (h) => {
        if (h.length < CONFIG.HOLD_DURATION_FRAMES) return false;
        // Check if the last N frames are consistently upside-down
        return h.slice(-CONFIG.HOLD_DURATION_FRAMES).every(s => Math.abs(s.beta) > 135);
    },
  },
  {
    name: 'SUBSTITUTION',
    duration: CONFIG.HOLD_DURATION_FRAMES,
    matcher: (h) => {
      if (h.length < CONFIG.HOLD_DURATION_FRAMES) return false;
       // Check if phone is held flat and steady for the last N frames
      return h.slice(-CONFIG.HOLD_DURATION_FRAMES).every(s => 
        Math.abs(s.beta) < 15 && 
        Math.abs(s.gamma) < 15 &&
        Math.abs(s.betaVelocity) < CONFIG.STABILITY_THRESHOLD &&
        Math.abs(s.gammaVelocity) < CONFIG.STABILITY_THRESHOLD
      );
    },
  },
  {
    name: 'CORNER',
    duration: 2,
    matcher: (h) => {
        const last = h[h.length-1];
        if (!last) return false;
        // Gentle tilt right and hold
        return last.gamma > 20 && last.gamma < 60 && Math.abs(last.beta) < 20 && Math.abs(last.gammaVelocity) < CONFIG.STABILITY_THRESHOLD;
    }
  },
  {
    name: 'OFFSIDE',
    duration: 2,
    matcher: (h) => {
        const last = h[h.length-1];
        if (!last) return false;
        // Gentle tilt left and hold
        return last.gamma < -20 && last.gamma > -60 && Math.abs(last.beta) < 20 && Math.abs(last.gammaVelocity) < CONFIG.STABILITY_THRESHOLD;
    }
  }
];


/* ==========================  COMPONENT  ========================== */
const GestureRecorder = () => {
  const nav = useNavigate();
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [events, setEvents] = useState<SoccerEvent[]>([]);
  const [gyro, setGyro] = useState<Vec3 & { alpha: number | null }>({ x: 0, y: 0, z: 0, alpha: null });
  const [permission, setPermission] = useState(false);
  const [voice, setVoice] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [learningProgress, setLearningProgress] = useState(0);
  const [jitterZone, setJitterZone] = useState<JitterZone | null>(null);

  /* ----------  REFS  ---------- */
  const kalRef = useRef<Kalman3D>({ x: new Kalman1D(), y: new Kalman1D(), z: new Kalman1D() });
  const motionHistoryRef = useRef<MotionSample[]>([]);
  const gestureCounterRef = useRef<Record<string, number>>({});
  const lastGestureRef = useRef<string | null>(null);
  const cooldownRef = useRef(0);
  const learningSamplesRef = useRef<{ beta: number; gamma: number }[]>([]);
  const learningStartRef = useRef<number>(0);

  /* ----------  PERMISSION  ---------- */
  const ask = useCallback(async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      const res = await (DeviceOrientationEvent as any).requestPermission();
      setPermission(res === 'granted');
      toast({ title: res === 'granted' ? 'Access granted' : 'Access denied', variant: res === 'granted' ? 'default' : 'destructive' });
    } else setPermission(true);
  }, [toast]);

  /* ----------  ADD EVENT  ---------- */
  const add = useCallback((type: SoccerEventType) => {
    const ev: SoccerEvent = { type, timestamp: Date.now(), text: `${type} detected`, confidence: 0.95, protocolType: 'Player — Event' };
    setEvents((e) => [ev, ...e]);
    toast({ title: `${type} recorded` });
  }, [toast]);

  /* ----------  LEARNING & JITTER ZONE LOGIC (UNCHANGED)  ---------- */
  const startLearning = useCallback(() => {
    setIsLearning(true);
    setLearningProgress(0);
    learningSamplesRef.current = [];
    learningStartRef.current = Date.now();
    setJitterZone(null);
    toast({ title: '🎯 Learning your grip...', description: 'Hold phone naturally for 2 seconds' });
  }, [toast]);

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

  const isOutsideJitterZone = useCallback((beta: number, gamma: number): boolean => {
    if (!jitterZone) return true;
    const deltaBeta = Math.abs(beta - jitterZone.centerBeta);
    const deltaGamma = Math.abs(gamma - jitterZone.centerGamma);
    return deltaBeta > jitterZone.radiusBeta || deltaGamma > jitterZone.radiusGamma;
  }, [jitterZone]);

  /* ----------  NEW SENSOR LOOP with Pattern Matching  ---------- */
  useEffect(() => {
    if (!isActive || !permission) return;

    let frame = 0;
    const onOrient = (e: DeviceOrientationEvent) => {
      frame++;
      if (frame % Math.round(60 / CONFIG.FPS) !== 0) return;

      const β = e.beta ?? 0;
      const γ = e.gamma ?? 0;
      const α = e.alpha;

      setGyro({ x: β, y: γ, z: 0, alpha: α });

      if (isLearning) {
        const elapsed = Date.now() - learningStartRef.current;
        const progress = Math.min(elapsed / CONFIG.LEARNING_DURATION_MS, 1);
        setLearningProgress(progress);
        learningSamplesRef.current.push({ beta: β, gamma: γ });
        if (progress >= 1) finishLearning();
        return;
      }
      
      if (!isOutsideJitterZone(β, γ)) {
        gestureCounterRef.current = {}; // Reset counters if we are in jitter zone
        return;
      }

      // Kalman smooth the raw data
      const k = kalRef.current;
      const smoothedBeta = k.x.update(β);
      const smoothedGamma = k.y.update(γ);
      
      const now = Date.now();
      const history = motionHistoryRef.current;
      const previous = history.length > 0 ? history[history.length - 1] : null;
      
      let betaVelocity = 0;
      let gammaVelocity = 0;
      
      if (previous) {
          const dt = (now - previous.ts) / 1000; // time delta in seconds
          if (dt > 0) {
              betaVelocity = (smoothedBeta - previous.beta) / dt;
              gammaVelocity = (smoothedGamma - previous.gamma) / dt;
          }
      }

      const newSample: MotionSample = {
          ts: now,
          beta: smoothedBeta,
          gamma: smoothedGamma,
          alpha: α,
          betaVelocity,
          gammaVelocity,
      };

      // Add to history and keep it at a fixed size
      history.push(newSample);
      if (history.length > CONFIG.HISTORY_SIZE) {
          history.shift();
      }

      if (now < cooldownRef.current) return;
      
      let winner: string | null = null;
      for (const pattern of PATTERNS) {
          if (pattern.matcher(history)) {
              gestureCounterRef.current[pattern.name] = (gestureCounterRef.current[pattern.name] || 0) + 1;
              if (gestureCounterRef.current[pattern.name] >= pattern.duration) {
                  winner = pattern.name;
                  break; 
              }
          } else {
              gestureCounterRef.current[pattern.name] = 0;
          }
      }

      if (!winner || winner === lastGestureRef.current) return;

      cooldownRef.current = now + CONFIG.COOLDOWN_MS;
      lastGestureRef.current = winner;
      gestureCounterRef.current = {}; // Reset all counters after a win

      setCurrentGesture(winner);
      if (winner === 'VOICE_TAG') {
        setVoice(true);
      } else {
        add(winner as SoccerEventType);
        setVoice(false);
      }
      setTimeout(() => {
          setCurrentGesture(null);
          lastGestureRef.current = null; // Allow re-detection of same gesture
      }, 1000);
    };

    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [isActive, permission, isLearning, isOutsideJitterZone, finishLearning, add]);

  useEffect(() => {
    if (isActive && permission) {
      startLearning();
    }
  }, [isActive, permission, startLearning]);

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
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => nav('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-3xl font-bold">Smart Gesture Recorder</h1>
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
          </Card>
        </div>

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

/* ==========================  UI SUB-COMPONENTS (UNCHANGED)  ========================== */
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

const GestureItem = ({ gesture, event }: { gesture: string; event: string }) => (
  <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
    <span className="text-xs font-medium">{gesture}</span>
    <Badge variant="outline" className="text-xs">{event}</Badge>
  </div>
);

export default GestureRecorder;
