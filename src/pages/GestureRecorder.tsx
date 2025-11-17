import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Smartphone, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { SoccerEvent, SoccerEventType } from '@/types/soccer-events';
import EventTimeline from '@/components/EventTimeline';

interface GestureData {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  timestamp: number;
}

const GestureRecorder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string | null>(null);
  const [events, setEvents] = useState<SoccerEvent[]>([]);
  const [gyroData, setGyroData] = useState<GestureData>({
    alpha: null,
    beta: null,
    gamma: null,
    timestamp: 0,
  });
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  // Request device orientation permission (iOS)
  const requestPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setPermissionGranted(true);
          toast({
            title: "Permission granted",
            description: "Gyroscope access enabled",
          });
        }
      } catch (error) {
        toast({
          title: "Permission denied",
          description: "Gyroscope access is required for gesture detection",
          variant: "destructive",
        });
      }
    } else {
      setPermissionGranted(true);
    }
  };

  const detectGesture = useCallback((data: GestureData) => {
    const { beta, gamma, alpha } = data;
    if (beta === null || gamma === null || alpha === null) return null;

    // Flick forward (quick forward tilt) → PASS
    if (beta > 45 && beta < 90 && Math.abs(gamma) < 30) {
      return 'PASS';
    }

    // Back Flick (quick backward tilt) → SHOT
    if (beta < -30 && Math.abs(gamma) < 30) {
      return 'SHOT';
    }

    // Tilt left or right → TACKLE
    if (Math.abs(gamma) > 45 && Math.abs(beta) < 30) {
      return 'TACKLE';
    }

    // Upside down hold → Voice Tag mode
    if (beta < -120 || beta > 120) {
      return 'VOICE_TAG';
    }

    // Shake detection (rapid changes in gamma/beta)
    // This is simplified; real shake detection needs acceleration data
    if (Math.abs(gamma) > 60 && Math.abs(beta) > 30) {
      return 'FOUL';
    }

    // Additional gestures
    // Corner - gentle tilt right
    if (gamma > 20 && gamma < 45 && beta > -15 && beta < 15) {
      return 'CORNER';
    }

    // Offside - gentle tilt left
    if (gamma < -20 && gamma > -45 && beta > -15 && beta < 15) {
      return 'OFFSIDE';
    }

    // Substitution - phone flat face up
    if (beta > -15 && beta < 15 && Math.abs(gamma) < 15) {
      return 'SUBSTITUTION';
    }

    return null;
  }, []);

  const addEvent = useCallback((eventType: SoccerEventType) => {
    const newEvent: SoccerEvent = {
      type: eventType,
      timestamp: Date.now(),
      text: `${eventType} detected via gesture`,
      confidence: 0.9,
      protocolType: 'Player — Event',
    };

    setEvents(prev => [newEvent, ...prev]);

    toast({
      title: `${eventType} Recorded`,
      description: "Event added to timeline",
    });
  }, [toast]);

  useEffect(() => {
    if (!isActive || !permissionGranted) return;

    let lastGesture: string | null = null;
    let gestureTimeout: NodeJS.Timeout;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const data: GestureData = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        timestamp: Date.now(),
      };

      setGyroData(data);

      const detected = detectGesture(data);
      
      if (detected && detected !== lastGesture) {
        setCurrentGesture(detected);
        lastGesture = detected;

        if (detected === 'VOICE_TAG') {
          setIsRecordingVoice(true);
        } else {
          addEvent(detected as SoccerEventType);
          setIsRecordingVoice(false);
        }

        // Clear gesture after 1.5 seconds
        clearTimeout(gestureTimeout);
        gestureTimeout = setTimeout(() => {
          setCurrentGesture(null);
          lastGesture = null;
        }, 1500);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      clearTimeout(gestureTimeout);
    };
  }, [isActive, permissionGranted, detectGesture, addEvent]);

  const toggleActive = () => {
    if (!permissionGranted) {
      requestPermission();
    } else {
      setIsActive(!isActive);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-pitch-green/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Gesture Recorder</h1>
        </div>

        {!permissionGranted && (
          <Card className="p-6 mb-6 border-accent">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-accent mt-0.5" />
              <div>
                <h3 className="font-semibold mb-2">Permission Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This feature requires access to your device's gyroscope to detect gestures.
                </p>
                <Button onClick={requestPermission}>
                  <Smartphone className="h-4 w-4 mr-2" />
                  Enable Gyroscope
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Control Panel */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>
            
            <Button
              onClick={toggleActive}
              variant={isActive ? "destructive" : "default"}
              size="lg"
              className="w-full mb-6"
              disabled={!permissionGranted}
            >
              {isActive ? 'Stop Recording' : 'Start Recording'}
            </Button>

            {currentGesture && (
              <div className="mb-6">
                <Badge variant="default" className="text-lg px-4 py-2">
                  {currentGesture}
                </Badge>
              </div>
            )}

            {isRecordingVoice && (
              <div className="p-4 bg-accent/10 rounded-lg border border-accent">
                <p className="text-sm font-medium">🎤 Voice Tag Mode Active</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hold phone upside down and speak the player number
                </p>
              </div>
            )}

            <div className="mt-6 space-y-2">
              <h3 className="font-semibold text-sm">Gyroscope Data:</h3>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground">Alpha</div>
                  <div className="font-semibold">{gyroData.alpha?.toFixed(1) ?? '—'}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground">Beta</div>
                  <div className="font-semibold">{gyroData.beta?.toFixed(1) ?? '—'}</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-muted-foreground">Gamma</div>
                  <div className="font-semibold">{gyroData.gamma?.toFixed(1) ?? '—'}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Gesture Guide */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Gesture Guide</h2>
            <div className="space-y-3">
              <GestureItem gesture="Flick Forward" event="PASS" />
              <GestureItem gesture="Back Flick" event="SHOT" />
              <GestureItem gesture="Tilt Left/Right" event="TACKLE" />
              <GestureItem gesture="Upside Down Hold" event="VOICE TAG" />
              <GestureItem gesture="Shake" event="FOUL" />
              <GestureItem gesture="Gentle Tilt Right" event="CORNER" />
              <GestureItem gesture="Gentle Tilt Left" event="OFFSIDE" />
              <GestureItem gesture="Flat Face Up" event="SUBSTITUTION" />
            </div>
          </Card>
        </div>

        {/* Event Timeline */}
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
