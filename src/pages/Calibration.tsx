/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, RotateCcw, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptic-feedback';

interface ThresholdConfig {
  PASS_MIN: number;
  PASS_MAX: number;
  SHOT_MIN: number;
  TACKLE_MIN: number;
  VOICE_TAG_THRESHOLD: number;
  FOUL_GAMMA_MIN: number;
  FOUL_BETA_MIN: number;
  CORNER_MIN: number;
  CORNER_MAX: number;
  OFFSIDE_MIN: number;
  OFFSIDE_MAX: number;
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  PASS_MIN: 40,
  PASS_MAX: 85,
  SHOT_MIN: 25,
  TACKLE_MIN: 40,
  VOICE_TAG_THRESHOLD: 110,
  FOUL_GAMMA_MIN: 55,
  FOUL_BETA_MIN: 25,
  CORNER_MIN: 15,
  CORNER_MAX: 40,
  OFFSIDE_MIN: 15,
  OFFSIDE_MAX: 40,
};

export default function Calibration() {
  const nav = useNavigate();
  const { toast } = useToast();
  
  const [permission, setPermission] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [gyro, setGyro] = useState({ beta: 0, gamma: 0, alpha: 0 });
  const [detectedGesture, setDetectedGesture] = useState<string | null>(null);
  
  const baseRef = useRef<{ beta: number; gamma: number } | null>(null);
  const cooldownRef = useRef(0);

  // Load saved thresholds
  useEffect(() => {
    const saved = localStorage.getItem('gesture-thresholds');
    if (saved) {
      try {
        setThresholds(JSON.parse(saved));
      } catch (e) {
        console.warn('Failed to load thresholds:', e);
      }
    }
  }, []);

  // Save thresholds
  const saveThresholds = () => {
    localStorage.setItem('gesture-thresholds', JSON.stringify(thresholds));
    toast({ title: '✅ Thresholds saved', description: 'Your calibration has been saved.' });
    triggerHaptic('medium');
  };

  // Reset to defaults
  const resetThresholds = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    localStorage.removeItem('gesture-thresholds');
    toast({ title: '🔄 Reset to defaults', description: 'Thresholds have been reset.' });
    triggerHaptic('light');
  };

  // Request permission
  const requestPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setPermission(true);
          setIsActive(true);
          toast({ title: '✅ Permission granted' });
        }
      } catch (error) {
        toast({ 
          title: '❌ Permission denied', 
          description: 'Please enable motion & orientation access.',
          variant: 'destructive' 
        });
      }
    } else {
      setPermission(true);
      setIsActive(true);
    }
  };

  // Gesture detection logic
  useEffect(() => {
    if (!isActive || !permission) return;

    let frame = 0;
    const onOrient = (e: DeviceOrientationEvent) => {
      frame++;
      if (frame % 4 !== 0) return; // Sample at 15 FPS

      const β = e.beta ?? 0;
      const γ = e.gamma ?? 0;
      const α = e.alpha ?? 0;
      const now = Date.now();

      setGyro({ beta: β, gamma: γ, alpha: α });

      if (!baseRef.current) {
        baseRef.current = { beta: β, gamma: γ };
        return;
      }

      if (now < cooldownRef.current) return;

      const base = baseRef.current;
      let detected: string | null = null;

      // Test each gesture with current thresholds
      if (β > base.beta + thresholds.PASS_MIN && 
          β < base.beta + thresholds.PASS_MAX && 
          Math.abs(γ - base.gamma) < 25) {
        detected = 'PASS';
      } else if (β < base.beta - thresholds.SHOT_MIN && Math.abs(γ - base.gamma) < 25) {
        detected = 'SHOT';
      } else if (Math.abs(γ - base.gamma) > thresholds.TACKLE_MIN && Math.abs(β - base.beta) < 25) {
        detected = 'TACKLE';
      } else if (β < -thresholds.VOICE_TAG_THRESHOLD || β > thresholds.VOICE_TAG_THRESHOLD) {
        detected = 'VOICE_TAG';
      } else if (Math.abs(γ - base.gamma) > thresholds.FOUL_GAMMA_MIN && 
                 Math.abs(β - base.beta) > thresholds.FOUL_BETA_MIN) {
        detected = 'FOUL';
      } else if (γ > base.gamma + thresholds.CORNER_MIN && 
                 γ < base.gamma + thresholds.CORNER_MAX && 
                 Math.abs(β - base.beta) < 12) {
        detected = 'CORNER';
      } else if (γ < base.gamma - thresholds.OFFSIDE_MIN && 
                 γ > base.gamma - thresholds.OFFSIDE_MAX && 
                 Math.abs(β - base.beta) < 12) {
        detected = 'OFFSIDE';
      }

      if (detected) {
        setDetectedGesture(detected);
        triggerHaptic('medium');
        cooldownRef.current = now + 1000;
        setTimeout(() => setDetectedGesture(null), 1500);
      }
    };

    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [isActive, permission, thresholds]);

  // Reset base position
  const resetBase = () => {
    baseRef.current = null;
    toast({ title: '🎯 Base position reset' });
    triggerHaptic('light');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-pitch-green/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => nav('/gestures')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-3xl font-bold">Calibration</h1>
        </div>

        {/* Permission Card */}
        {!permission && (
          <Card className="p-6 mb-6 border-accent">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-accent mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Enable Gyroscope</h3>
                  <p className="text-sm text-muted-foreground">
                    Allow motion & orientation access to test gestures
                  </p>
                </div>
              </div>
              <Button onClick={requestPermission} size="sm">
                Enable
              </Button>
            </div>
          </Card>
        )}

        {/* Live Gyroscope Data */}
        {permission && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Live Gyroscope Data</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetBase}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Reset Base
                </Button>
                <Button 
                  variant={isActive ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setIsActive(!isActive)}
                >
                  {isActive ? 'Active' : 'Paused'}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Beta (β)</div>
                <div className="text-2xl font-bold">{gyro.beta.toFixed(1)}°</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Gamma (γ)</div>
                <div className="text-2xl font-bold">{gyro.gamma.toFixed(1)}°</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Alpha (α)</div>
                <div className="text-2xl font-bold">{gyro.alpha?.toFixed(1) ?? '—'}°</div>
              </div>
            </div>

            {detectedGesture && (
              <div className="text-center">
                <Badge variant="default" className="text-lg px-4 py-2">
                  {detectedGesture}
                </Badge>
              </div>
            )}
          </Card>
        )}

        {/* Threshold Controls */}
        <Card className="p-6">
          <h3 className="font-semibold mb-6">Gesture Sensitivity Thresholds</h3>
          
          <div className="space-y-6">
            {/* PASS */}
            <div>
              <label className="text-sm font-medium mb-2 block">PASS (Flick Forward)</label>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-16">Min:</span>
                  <Slider
                    value={[thresholds.PASS_MIN]}
                    onValueChange={([val]) => setThresholds({ ...thresholds, PASS_MIN: val })}
                    min={20}
                    max={80}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12">{thresholds.PASS_MIN}°</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-16">Max:</span>
                  <Slider
                    value={[thresholds.PASS_MAX]}
                    onValueChange={([val]) => setThresholds({ ...thresholds, PASS_MAX: val })}
                    min={50}
                    max={120}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12">{thresholds.PASS_MAX}°</span>
                </div>
              </div>
            </div>

            {/* SHOT */}
            <div>
              <label className="text-sm font-medium mb-2 block">SHOT (Back Flick)</label>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">Min:</span>
                <Slider
                  value={[thresholds.SHOT_MIN]}
                  onValueChange={([val]) => setThresholds({ ...thresholds, SHOT_MIN: val })}
                  min={10}
                  max={50}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-12">{thresholds.SHOT_MIN}°</span>
              </div>
            </div>

            {/* TACKLE */}
            <div>
              <label className="text-sm font-medium mb-2 block">TACKLE (Tilt)</label>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">Min:</span>
                <Slider
                  value={[thresholds.TACKLE_MIN]}
                  onValueChange={([val]) => setThresholds({ ...thresholds, TACKLE_MIN: val })}
                  min={20}
                  max={80}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-12">{thresholds.TACKLE_MIN}°</span>
              </div>
            </div>

            {/* VOICE TAG */}
            <div>
              <label className="text-sm font-medium mb-2 block">VOICE TAG (Upside Hold)</label>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">Threshold:</span>
                <Slider
                  value={[thresholds.VOICE_TAG_THRESHOLD]}
                  onValueChange={([val]) => setThresholds({ ...thresholds, VOICE_TAG_THRESHOLD: val })}
                  min={80}
                  max={150}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-12">{thresholds.VOICE_TAG_THRESHOLD}°</span>
              </div>
            </div>

            {/* FOUL */}
            <div>
              <label className="text-sm font-medium mb-2 block">FOUL (Shake)</label>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-16">Gamma:</span>
                  <Slider
                    value={[thresholds.FOUL_GAMMA_MIN]}
                    onValueChange={([val]) => setThresholds({ ...thresholds, FOUL_GAMMA_MIN: val })}
                    min={30}
                    max={80}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12">{thresholds.FOUL_GAMMA_MIN}°</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-16">Beta:</span>
                  <Slider
                    value={[thresholds.FOUL_BETA_MIN]}
                    onValueChange={([val]) => setThresholds({ ...thresholds, FOUL_BETA_MIN: val })}
                    min={10}
                    max={50}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12">{thresholds.FOUL_BETA_MIN}°</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Button onClick={saveThresholds} className="flex-1">
              Save Calibration
            </Button>
            <Button onClick={resetThresholds} variant="outline">
              Reset Defaults
            </Button>
          </div>
        </Card>

        <Card className="p-6 mt-6 bg-muted/50">
          <h4 className="font-semibold mb-2 text-sm">How to Calibrate</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Hold your device in the neutral position and tap "Reset Base"</li>
            <li>Perform each gesture slowly and observe if it's detected</li>
            <li>Adjust the sliders to make gestures easier or harder to trigger</li>
            <li>Lower values = more sensitive, Higher values = less sensitive</li>
            <li>Save your calibration when you're satisfied with the sensitivity</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
