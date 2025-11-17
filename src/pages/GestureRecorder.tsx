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
  FPS: 15,                       // down-sample to this
  COOLDOWN_MS: 700,              // ignore after success
  HOLD_PASS_FRAMES: 3,           // quick flick
  HOLD_SHOT_FRAMES: 3,
  HOLD_TACKLE_FRAMES: 4,
  HOLD_VOICE_FRAMES: 6,          // must be upside-down a bit
  HOLD_FOUL_FRAMES: 3,
  HOLD_CORNER_FRAMES: 4,
  HOLD_OFFSIDE_FRAMES: 4,
  HOLD_SUB_FRAMES: 5,            // flat & steady
  STILL_THRESHOLD: 4,            // degrees – below this we ignore everything
  ADAPTIVE_MARGIN: 18,           // ±° around current resting angle
  STORAGE_KEY: 'gesture-zero-v2',
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

/* ==========================  KALMAN 1-D  ========================== */
class Kalman1D {
  private q = 0.003; // process
  private r = 0.25;  // measurement
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

/* ==========================  UTILS  ========================== */
const loadOffset = (): Vec3 => {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    return raw ? JSON.parse(raw) : { x: 0, y: 0, z: 0 };
  } catch {
    return { x: 0, y: 0, z: 0 };
  }
};
let ZERO_OFFSET = loadOffset();

const norm = (v: Vec3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const degStill = (a: number, b: number, c: number): number =>
  Math.sqrt(a * a + b * b + c * c);

/* ==========================  GESTURE DECISION  ========================== */
type Rule = (s: GestureSample, base: GestureSample) => boolean;
const RULES: Record<string, Rule> = {
  PASS: (s, b) => s.beta > b.beta + 40 && s.beta < b.beta + 85 && Math.abs(s.gamma - b.gamma) < 25,
  SHOT: (s, b) => s.beta < b.beta - 25 && Math.abs(s.gamma - b.gamma) < 25,
  TACKLE: (s, b) => Math.abs(s.gamma - b.gamma) > 40 && Math.abs(s.beta - b.beta) < 25,
  VOICE_TAG: (s, b) => s.beta < -110 || s.beta > 110,
  FOUL: (s, b) => Math.abs(s.gamma - b.gamma) > 55 && Math.abs(s.beta - b.beta) > 25,
  CORNER: (s, b) => s.gamma > b.gamma + 15 && s.gamma < b.gamma + 40 && Math.abs(s.beta - b.beta) < 12,
  OFFSIDE: (s, b) => s.gamma < b.gamma - 15 && s.gamma > b.gamma - 40 && Math.abs(s.beta - b.beta) < 12,
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
  const [calibrating, setCalibrating] = useState(false);

  /* ----------  KALMAN INSTANCES  ---------- */
  const kalRef = useRef<Kalman3D>({ x: new Kalman1D(), y: new Kalman1D(), z: new Kalman1D() });
  const baseRef = useRef<GestureSample | null>(null);
  const cntRef = useRef<Record<string, number>>({});
  const lastGestureRef = useRef<string | null>(null);
  const cooldownRef = useRef(0);

  /* ----------  PERMISSION  ---------- */
  const ask = useCallback(async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      const res = await (DeviceOrientationEvent as any).requestPermission();
      setPermission(res === 'granted');
      toast({ title: res === 'granted' ? 'Access granted' : 'Access denied', variant: res === 'granted' ? 'default' : 'destructive' });
    } else setPermission(true);
  }, [toast]);

  /* ----------  CALIBRATION  ---------- */
  const calibrate = useCallback(() => {
    setCalibrating(true);
    toast({ title: 'Hold steady…', description: 'Calibrating zero offset' });
    const snap = baseRef.current;
    if (snap) {
      ZERO_OFFSET = { x: snap.x, y: snap.y, z: snap.z };
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(ZERO_OFFSET));
    }
    setTimeout(() => setCalibrating(false), 1200);
  }, [toast]);

  /* ----------  ADD EVENT  ---------- */
  const add = useCallback((type: SoccerEventType) => {
    const ev: SoccerEvent = { type, timestamp: Date.now(), text: `${type} detected`, confidence: 0.95, protocolType: 'Player — Event' };
    setEvents((e) => [ev, ...e]);
    toast({ title: `${type} recorded` });
  }, [toast]);

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

      /* Kalman smooth */
      const k = kalRef.current;
      const sample: GestureSample = {
        x: k.x.update(β),
        y: k.y.update(γ),
        z: k.z.update(0), // we only need beta/gamma for rules
        beta: β,
        gamma: γ,
        alpha: α,
        ts: Date.now(),
      };

      /* still gate */
      if (degStill(sample.x, sample.y, sample.z) < CONFIG.STILL_THRESHOLD) {
        cntRef.current = {};
        return;
      }

      /* base angle (adaptive) */
      if (!baseRef.current) baseRef.current = { ...sample };
      const base = baseRef.current;

      /* rule engine */
      const now = Date.now();
      if (now < cooldownRef.current) return;

      let winner: string | null = null;
      for (const [name, rule] of Object.entries(RULES)) {
        if (rule(sample, base)) {
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
      if (winner === 'VOICE_TAG') setVoice(true);
      else {
        add(winner as SoccerEventType);
        setVoice(false);
      }
      setTimeout(() => setCurrentGesture(null), 1000);
    };

    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [isActive, permission, add]);

  /* ----------  UI  ---------- */
  const toggle = () => {
    if (!permission) ask();
    else setIsActive((v) => !v);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-pitch-green/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => nav('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-3xl font-bold">Robust Gesture Recorder</h1>
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

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>
            <Button onClick={toggle} variant={isActive ? 'destructive' : 'default'} size="lg" className="w-full mb-4">
              {isActive ? 'Stop Recording' : 'Start Recording'}
            </Button>

            <Button onClick={calibrate} variant="outline" size="sm" className="w-full mb-6" disabled={calibrating}>
              <Zap className="h-4 w-4 mr-2" />
              {calibrating ? 'Calibrating…' : 'Calibrate Zero Offset'}
            </Button>

            {currentGesture && (
              <div className="mb-6">
                <Badge variant="default" className="text-lg px-4 py-2">{currentGesture}</Badge>
              </div>
            )}

            {voice && (
              <div className="p-4 bg-accent/10 rounded-lg border border-accent">
                <p className="text-sm font-medium">🎤 Voice Tag Mode Active</p>
                <p className="text-xs text-muted-foreground mt-1">Hold phone upside-down and speak the player number</p>
              </div>
            )}

            <div className="mt-6 space-y-2">
              <h3 className="font-semibold text-sm">Live Gyroscope (°)</h3>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground">Alpha</div>
                  <div>{gyro.alpha?.toFixed(1) ?? '—'}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground">Beta</div>
                  <div>{gyro.x.toFixed(1)}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground">Gamma</div>
                  <div>{gyro.y.toFixed(1)}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Gesture Guide</h2>
            <div className="space-y-3">
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

const GestureItem = ({ gesture, event }: { gesture: string; event: string }) => (
  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
    <span className="text-sm font-medium">{gesture}</span>
    <Badge variant="outline">{event}</Badge>
  </div>
);

export default GestureRecorder;
