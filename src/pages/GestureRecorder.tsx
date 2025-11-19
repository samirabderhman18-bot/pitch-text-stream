
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Smartphone, Activity, Layers, Trash2 } from 'lucide-react';

// Components
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import EventTimeline from '@/components/EventTimeline'; // Ensure this exists or remove

// Logic
import { useMotionProcessor } from '@/hooks/useMotionProcessor';
import { SoccerEvent, EVENT_COLORS } from '@/types/soccer-events';

export default function GestureRecorder() {
  const nav = useNavigate();
  const [events, setEvents] = useState<SoccerEvent[]>([]);
  const [lastDetected, setLastDetected] = useState<string | null>(null);

  // --- EVENT HANDLER ---
  const handleGestureEvent = useCallback((type: string, confidence: number) => {
    const newEvent: SoccerEvent = {
      timestamp: Date.now(),
      confidence: confidence,
      text: `${type} detected via Motion`,
      eventSource: 'gesture-capture',
      type: type as any, // Type assertion for simplicity
      protocolType: 'Manual Input'
    };

    // Update State
    setLastDetected(type);
    setEvents(prev => [newEvent, ...prev]);

    // Clear visual badge after 1.5s
    setTimeout(() => setLastDetected(null), 1500);
  }, []);

  // --- INIT HOOK ---
  const { 
    isActive, 
    permission, 
    visuals, 
    requestPermission, 
    toggle 
  } = useMotionProcessor(handleGestureEvent);

  // Helper for visualizing velocity bar
  const getVelocityPercent = (val: number) => {
    // Max expected velocity ~300 deg/s
    return Math.min((Math.abs(val) / 300) * 100, 100);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20">
      {/* --- HEADER --- */}
      <div className="max-w-lg mx-auto flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={() => nav('/')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Activity className={`w-4 h-4 ${isActive ? 'text-green-500 animate-pulse' : 'text-slate-400'}`} />
          <span>SOTA Motion Engine</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        
        {/* --- CONTROLS --- */}
        <Card className="p-6 border-t-4 border-t-blue-500 shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Gesture Input</h2>
              <p className="text-sm text-slate-500">
                {isActive ? 'Sensors Active (60Hz)' : 'Sensors Paused'}
              </p>
            </div>
            {/* FLASHING BADGE ON DETECT */}
            {lastDetected && (
              <Badge className={`text-lg px-4 py-2 animate-in zoom-in ${EVENT_COLORS[lastDetected]}`}>
                {lastDetected}
              </Badge>
            )}
          </div>

          {!permission ? (
            <Button onClick={requestPermission} size="lg" className="w-full bg-slate-800 hover:bg-slate-700">
              <Smartphone className="mr-2 w-5 h-5" /> Enable Sensors
            </Button>
          ) : (
            <Button 
              onClick={toggle} 
              variant={isActive ? "destructive" : "default"} 
              size="lg" 
              className="w-full"
            >
              {isActive ? "Stop Recording" : "Start Recording"}
            </Button>
          )}
        </Card>

        {/* --- VISUALIZATION (DEBUGGER) --- */}
        {isActive && (
          <Card className="p-5 bg-slate-900 text-slate-200 shadow-inner">
            <div className="grid grid-cols-2 gap-6">
              
              {/* 1. FLICK VISUALIZER */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Flick (Velocity)</span>
                  <span>{visuals.velBeta.toFixed(0)}°/s</span>
                </div>
                <div className="h-32 bg-slate-800 rounded-lg relative overflow-hidden flex flex-col justify-center items-center">
                  {/* Center Line */}
                  <div className="w-full h-[1px] bg-slate-600" />
                  {/* Dynamic Bar */}
                  <div 
                    className={`w-4 absolute transition-all duration-75 rounded-sm ${visuals.velBeta > 0 ? 'bg-blue-500 bottom-1/2' : 'bg-orange-500 top-1/2'}`}
                    style={{ 
                      height: `${getVelocityPercent(visuals.velBeta) / 2}%`, // Divide by 2 to fit half-height
                    }}
                  />
                  {/* Threshold Markers */}
                  <div className="absolute top-[20%] w-full border-t border-dashed border-slate-700 text-[9px] text-slate-600 pl-1">SHOT Threshold</div>
                  <div className="absolute bottom-[20%] w-full border-t border-dashed border-slate-700 text-[9px] text-slate-600 pl-1">PASS Threshold</div>
                </div>
              </div>

              {/* 2. TILT VISUALIZER */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Tilt (Position)</span>
                  <span>{visuals.gamma.toFixed(0)}°</span>
                </div>
                <div className="h-32 bg-slate-800 rounded-lg relative flex items-center justify-center">
                  {/* Rotating Phone Icon */}
                  <div 
                    className="w-12 h-20 border-2 border-slate-500 rounded-lg transition-transform duration-75"
                    style={{ transform: `rotate(${visuals.gamma}deg)` }}
                  >
                    <div className="w-full h-1 bg-slate-700 mt-2" />
                  </div>
                  {/* Steady Indicator */}
                  {visuals.isSteady && (
                    <div className="absolute top-2 right-2">
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-center text-slate-500">
                   {visuals.isSteady ? 'Calibrating (Steady)...' : 'Tracking Movement'}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* --- LEGEND --- */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-blue-50 border border-blue-200 p-2 rounded">
            <div className="text-xs font-bold text-blue-700">PASS</div>
            <div className="text-[10px] text-blue-600">Quick flick forward</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 p-2 rounded">
            <div className="text-xs font-bold text-orange-700">SHOT</div>
            <div className="text-[10px] text-orange-600">Quick flick back</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-2 rounded">
            <div className="text-xs font-bold text-yellow-700">TACKLE</div>
            <div className="text-[10px] text-yellow-600">Tilt Left/Right</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-2 rounded">
            <div className="text-xs font-bold text-purple-700">VOICE</div>
            <div className="text-[10px] text-purple-600">Hold upside down</div>
          </div>
        </div>

        {/* --- TIMELINE --- */}
        {events.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Event Log
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setEvents([])} className="h-8 text-red-500 hover:text-red-600">
                <Trash2 className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>
            {/* Assuming EventTimeline renders the list of events */}
            <EventTimeline events={events} />
          </div>
        )}
      </div>
    </div>
  );
}
