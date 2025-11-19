/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, RotateCcw, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptic-feedback';

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
        const loadedThresholds = JSON.parse(saved);
        // Merge with defaults to ensure new properties are present
        setThresholds({ ...DEFAULT_THRESHOLDS, ...loadedThresholds });
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
      if (thresholds.PASS_ENABLED &&
          β > base.beta + thresholds.PASS_MIN &&
          β < base.beta + thresholds.PASS_MAX &&
          Math.abs(γ - base.gamma) < 25) {
        detected = 'PASS';
      } else if (thresholds.SHOT_ENABLED &&
                 β < base.beta - thresholds.SHOT_MIN && Math.abs(γ - base.gamma) < 25) {
        detected = 'SHOT';
      } else if (thresholds.TACKLE_ENABLED &&
                 Math.abs(γ - base.gamma) > thresholds.TACKLE_MIN && Math.abs(β - base.beta) < 25) {
        detected = 'TACKLE';
      } else if (thresholds.VOICE_TAG_ENABLED &&
                 (β < -thresholds.VOICE_TAG_THRESHOLD || β > thresholds.VOICE_TAG_THRESHOLD)) {
        detected = 'VOICE_TAG';
      } else if (thresholds.FOUL_ENABLED &&
                 Math.abs(γ - base.gamma) > thresholds.FOUL_GAMMA_MIN &&
                 Math.abs(β - base.beta) > thresholds.FOUL_BETA_MIN) {
        detected = 'FOUL';
      } else if (thresholds.CORNER_ENABLED &&
                 γ > base.gamma + thresholds.CORNER_MIN &&
                 γ < base.gamma + thresholds.CORNER_MAX &&
                 Math.abs(β - base.beta) < 12) {
        detected = 'CORNER';
      } else if (thresholds.OFFSIDE_ENABLED &&
                 γ < base.gamma - thresholds.OFFSIDE_MIN &&
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
          <Button variant="ghost" size="sm" onClick={() => nav(-1)} className="gap-2">
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
              <div className="flex items-center mb-2">
                <Checkbox
                  id="pass-enabled"
                  checked={thresholds.PASS_ENABLED}
                  onCheckedChange={(checked) => setThresholds({ ...thresholds, PASS_ENABLED: !!checked })}
                  className="mr-2"
                />
                <label htmlFor="pass-enabled" className="text-sm font-medium">PASS (Flick Forward)</label>
              </div>
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
                    disabled={!thresholds.PASS_ENABLED}
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
                    disabled={!thresholds.PASS_ENABLED}
                  />
                  <span className="text-sm font-mono w-12">{thresholds.PASS_MAX}°</span>
                </div>
              </div>
            </div>

            {/* SHOT */}
            <div>
              <div className="flex items-center mb-2">
                <Checkbox
                  id="shot-enabled"
                  checked={thresholds.SHOT_ENABLED}
                  onCheckedChange={(checked) => setThresholds({ ...thresholds, SHOT_ENABLED: !!checked })}
                  className="mr-2"
                />
                <label htmlFor="shot-enabled" className="text-sm font-medium">SHOT (Back Flick)</label>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">Min:</span>
                <Slider
                  value={[thresholds.SHOT_MIN]}
                  onValueChange={([val]) => setThresholds({ ...thresholds, SHOT_MIN: val })}
                  min={10}
                  max={50}
                  step={5}
                  className="flex-1"
                  disabled={!thresholds.SHOT_ENABLED}
                />
                <span className="text-sm font-mono w-12">{thresholds.SHOT_MIN}°</span>
              </div>
            </div>

            {/* TACKLE */}
            <div>
              <div className="flex items-center mb-2">
                <Checkbox
                  id="tackle-enabled"
                  checked={thresholds.TACKLE_ENABLED}
                  onCheckedChange={(checked) => setThresholds({ ...thresholds, TACKLE_ENABLED: !!checked })}
                  className="mr-2"
                />
                <label htmlFor="tackle-enabled" className="text-sm font-medium">TACKLE (Tilt)</label>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">Min:</span>
                <Slider
                  value={[thresholds.TACKLE_MIN]}
                  onValueChange={([val]) => setThresholds({ ...thresholds, TACKLE_MIN: val })}
                  min={20}
                  max={80}
                  step={5}
                  className="flex-1"
                  disabled={!thresholds.TACKLE_ENABLED}
                />
                <span className="text-sm font-mono w-12">{thresholds.TACKLE_MIN}°</span>
              </div>
            </div>

            {/* VOICE TAG */}
            <div>
              <div className="flex items-center mb-2">
                <Checkbox
                  id="voicetag-enabled"
                  checked={thresholds.VOICE_TAG_ENABLED}
                  onCheckedChange={(checked) => setThresholds({ ...thresholds, VOICE_TAG_ENABLED: !!checked })}
                  className="mr-2"
                />
                <label htmlFor="voicetag-enabled" className="text-sm font-medium">VOICE TAG (Upside Hold)</label>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">Threshold:</span>
                <Slider
                  value={[thresholds.VOICE_TAG_THRESHOLD]}
                  onValueChange={([val]) => setThresholds({ ...thresholds, VOICE_TAG_THRESHOLD: val })}
                  min={80}
                  max={150}
                  step={5}
                  className="flex-1"
                  disabled={!thresholds.VOICE_TAG_ENABLED}
                />
                <span className="text-sm font-mono w-12">{thresholds.VOICE_TAG_THRESHOLD}°</span>
              </div>
            </div>

            {/* FOUL */}
            <div>
              <div className="flex items-center mb-2">
                <Checkbox
                  id="foul-enabled"
                  checked={thresholds.FOUL_ENABLED}
                  onCheckedChange={(checked) => setThresholds({ ...thresholds, FOUL_ENABLED: !!checked })}
                  className="mr-2"
                />
                <label htmlFor="foul-enabled" className="text-sm font-medium">FOUL (Shake)</label>
              </div>
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
                    disabled={!thresholds.FOUL_ENABLED}
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
                    disabled={!thresholds.FOUL_ENABLED}
                  />
                  <span className="text-sm font-mono w-12">{thresholds.FOUL_BETA_MIN}°</span>
                </div>
              </div>
            </div>

            {/* CORNER */}
            <div>
              <div className="flex items-center mb-2">
                <Checkbox
                  id="corner-enabled"
                  checked={thresholds.CORNER_ENABLED}
                  onCheckedChange={(checked) => setThresholds({ ...thresholds, CORNER_ENABLED: !!checked })}
                  className="mr-2"
                />
                <label htmlFor="corner-enabled" className="text-sm font-medium">CORNER (Clockwise Arc)</label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-16">Min:</span>
                  <Slider
                    value={[thresholds.CORNER_MIN]}
                    onValueChange={([val]) => setThresholds({ ...thresholds, CORNER_MIN: val })}
                    min={10}
                    max={30}
                    step={5}
                    className="flex-1"
                    disabled={!thresholds.CORNER_ENABLED}
                  />
                  <span className="text-sm font-mono w-12">{thresholds.CORNER_MIN}°</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-16">Max:</span>
                  <Slider
                    value={[thresholds.CORNER_MAX]}
                    onValueChange={([val]) => setThresholds({ ...thresholds, CORNER_MAX: val })}
                    min={20}
                    max={50}
                    step={5}
                    className="flex-1"
                    disabled={!thresholds.CORNER_ENABLED}
                  />
                  <span className="text-sm font-mono w-12">{thresholds.CORNER_MAX}°</span>
                </div>
              </div>
            </div>

            {/* OFFSIDE */}
            <div>
              <div className="flex items-center mb-2">
                <Checkbox
                  id="offside-enabled"
                  checked={thresholds.OFFSIDE_ENABLED}
                  onCheckedChange={(checked) => setThresholds({ ...thresholds, OFFSIDE_ENABLED: !!checked })}
                  className="mr-2"
                />
                <label htmlFor="offside-enabled" className="text-sm font-medium">OFFSIDE (Counter-Arc)</label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-16">Min:</span>
                  <Slider
                    value={[thresholds.OFFSIDE_MIN]}
                    onValueChange={([val]) => setThresholds({ ...thresholds, OFFSIDE_MIN: val })}
                    min={10}
                    max={30}
                    step={5}
                    className="flex-1"
                    disabled={!thresholds.OFFSIDE_ENABLED}
                  />
                  <span className="text-sm font-mono w-12">{thresholds.OFFSIDE_MIN}°</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-16">Max:</span>
                  <Slider
                    value={[thresholds.OFFSIDE_MAX]}
                    onValueChange={([val]) => setThresholds({ ...thresholds, OFFSIDE_MAX: val })}
                    min={20}
                    max={50}
                    step={5}
                    className="flex-1"
                    disabled={!thresholds.OFFSIDE_ENABLED}
                  />
                  <span className="text-sm font-mono w-12">{thresholds.OFFSIDE_MAX}°</span>
                </div>
              </div>
            </div>

            {/* SUBSTITUTION */}
            <div>
              <div className="flex items-center">
                <Checkbox
                  id="substitution-enabled"
                  checked={thresholds.SUBSTITUTION_ENABLED}
                  onCheckedChange={(checked) => setThresholds({ ...thresholds, SUBSTITUTION_ENABLED: !!checked })}
                  className="mr-2"
                />
                <label htmlFor="substitution-enabled" className="text-sm font-medium">SUBSTITUTION (Flat & Steady)</label>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="font-semibold mb-4">Movement Patterns</h4>
              <div className="space-y-4">
                {/* CIRCULAR */}
                <div className="flex items-center">
                  <Checkbox
                    id="circular-enabled"
                    checked={thresholds.CIRCULAR_ENABLED}
                    onCheckedChange={(checked) => setThresholds({ ...thresholds, CIRCULAR_ENABLED: !!checked })}
                    className="mr-2"
                  />
                  <label htmlFor="circular-enabled" className="text-sm font-medium">CIRCULAR (Draw Circle)</label>
                </div>

                {/* FIGURE_8 */}
                <div className="flex items-center">
                  <Checkbox
                    id="figure8-enabled"
                    checked={thresholds.FIGURE_8_ENABLED}
                    onCheckedChange={(checked) => setThresholds({ ...thresholds, FIGURE_8_ENABLED: !!checked })}
                    className="mr-2"
                  />
                  <label htmlFor="figure8-enabled" className="text-sm font-medium">FIGURE_8 (Draw Figure-8)</label>
                </div>

                {/* ZIGZAG */}
                <div className="flex items-center">
                  <Checkbox
                    id="zigzag-enabled"
                    checked={thresholds.ZIGZAG_ENABLED}
                    onCheckedChange={(checked) => setThresholds({ ...thresholds, ZIGZAG_ENABLED: !!checked })}
                    className="mr-2"
                  />
                  <label htmlFor="zigzag-enabled" className="text-sm font-medium">ZIGZAG (Zigzag Motion)</label>
                </div>

                {/* SHAKE */}
                <div className="flex items-center">
                  <Checkbox
                    id="shake-enabled"
                    checked={thresholds.SHAKE_ENABLED}
                    onCheckedChange={(checked) => setThresholds({ ...thresholds, SHAKE_ENABLED: !!checked })}
                    className="mr-2"
                  />
                  <label htmlFor="shake-enabled" className="text-sm font-medium">SHAKE (Rapid Shake)</label>
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
