import { useState, useEffect } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import TranscriptionDisplay from '@/components/TranscriptionDisplay';
import EventTimeline from '@/components/EventTimeline';
import EventLog from '@/components/EventLog';
import RosterInput from '@/components/RosterInput';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SoccerEvent } from '@/types/soccer-events';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'processing';
}

interface EventData {
  transcription: string;
  player_name: string | null;
  player_id: number | null;
  team: string | null;
  event_type: string;
  target_player: string | null;
  minute?: number;
}

interface TranscriptionResult {
  text: string;
  enhanced?: string;
  events?: EventData[];
  speakers?: any[];
  service: string;
  processingTime: number;
  saved?: boolean;
}

const Index = () => {
  const [transcription, setTranscription] = useState('');
  const [enhancedTranscription, setEnhancedTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState<SoccerEvent[]>([]);
  const [language, setLanguage] = useState('ar');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [service, setService] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [needsSpeakerLabels, setNeedsSpeakerLabels] = useState(false);
  const [extractEvents, setExtractEvents] = useState(true);
  const [saveToDatabase, setSaveToDatabase] = useState(false);
  const [matchId, setMatchId] = useState('');
  const [transcriptionService, setTranscriptionService] = useState<'assemblyai' | 'gemini'>('assemblyai');
  const { toast } = useToast();

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{ timestamp: Date.now(), message, type }, ...prev].slice(0, 50));
  };

  // Convert EventData to SoccerEvent format for display
  const convertToSoccerEvent = (eventData: EventData): SoccerEvent => {
    let protocolType: SoccerEvent['protocolType'] = 'Player — Event';
    
    if (eventData.target_player) {
      protocolType = 'Player A — Event — Player B';
    } else if (eventData.team && !eventData.player_name) {
      protocolType = 'Team — Event';
    }

    return {
      type: eventData.event_type as any,
      protocolType,
      playerA: eventData.player_name || '',
      playerB: eventData.target_player || '',
      team: eventData.team || '',
      referee: '',
      text: eventData.transcription,
      timestamp: Date.now(),
      confidence: 0.8,
    };
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
          addLog(`Processing audio with ${transcriptionService.toUpperCase()}...`, 'processing');
    setStatus('Processing audio...');

    try {
      // Convert audio blob to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Estimate audio duration (3 second chunks)
      const audioDuration = 3000;

      addLog(`Sending to ${transcriptionService.toUpperCase()} transcription...`, 'processing');

      // Call the transcription system
      const { data, error } = await supabase.functions.invoke('transcribe-coordinator', {
        body: {
          audioData: base64Audio,
          languageCode: language,
          roster: roster,
          audioDuration: audioDuration,
          needsSpeakerLabels: needsSpeakerLabels,
          extractEvents: extractEvents,
          saveToDatabase: saveToDatabase,
          matchId: matchId || undefined,
          transcriptionService: transcriptionService,
        },
      });

      if (error) throw error;

      const result = data as TranscriptionResult;

      // Update transcription
      setTranscription(prev => prev + ' ' + result.text);
      if (result.enhanced) {
        setEnhancedTranscription(prev => prev + ' ' + result.enhanced);
      }
      setService(result.service);
      setProcessingTime(result.processingTime);

      addLog(
        `Transcribed using ${result.service.toUpperCase()} (${(result.processingTime / 1000).toFixed(2)}s)`,
        'success'
      );

      // Handle extracted events
      if (result.events && result.events.length > 0) {
        addLog(`Detected ${result.events.length} event(s)`, 'success');
        
        const newEvents = result.events.map(convertToSoccerEvent);
        setEvents(prev => [...newEvents, ...prev]);

        result.events.forEach(event => {
          addLog(`${event.event_type}: ${event.player_name || 'Team'} - ${event.transcription.substring(0, 50)}...`, 'info');
        });
      }

      // Database save confirmation
      if (result.saved) {
        addLog('Events saved to database ✓', 'success');
      }

      setIsProcessing(false);
      setStatus('Ready');

      toast({
        title: "Processing complete",
        description: `${result.service.toUpperCase()} • ${(result.processingTime / 1000).toFixed(2)}s${result.events ? ` • ${result.events.length} events` : ''}`,
      });

    } catch (error) {
      console.error('Error:', error);
      setIsProcessing(false);
      setStatus('Error');
      addLog(`Error: ${error instanceof Error ? error.message : 'Failed to process'}`, 'error');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process audio",
        variant: "destructive",
      });
    }
  };

  const handleClearAll = () => {
    setTranscription('');
    setEnhancedTranscription('');
    setEvents([]);
    setLogs([]);
    setService('');
    setProcessingTime(0);
    addLog('All data cleared', 'info');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pitch-green/10 mb-4">
              <div className="w-12 h-12 rounded-full bg-pitch-green" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              ⚽ Soccer Commentary System
            </h1>
            <p className="text-lg text-muted-foreground">
              Choose between AssemblyAI or Gemini for transcription with automatic event detection
            </p>
            
            {service && (
              <div className="flex items-center justify-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {service === 'gemini' ? '🤖 Gemini' : '🎯 AssemblyAI'}
                </Badge>
                {processingTime > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Avg: {(processingTime / 1000).toFixed(2)}s per chunk
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Configuration Panel */}
          <div className="bg-card rounded-lg border-2 border-pitch-green/20 p-6 shadow-lg space-y-6">
            <h3 className="text-xl font-semibold">Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Transcription Service Selector */}
              <div className="space-y-2">
                <Label>Transcription Service</Label>
                <Select 
                  onValueChange={(value: 'assemblyai' | 'gemini') => setTranscriptionService(value)} 
                  defaultValue={transcriptionService}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assemblyai">🎯 AssemblyAI (Accurate)</SelectItem>
                    <SelectItem value="gemini">🤖 Gemini (Fast)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {transcriptionService === 'gemini' 
                    ? 'Gemini: Faster processing, direct audio analysis'
                    : 'AssemblyAI: High accuracy, supports speaker labels'}
                </p>
              </div>

              {/* Language Selector */}
              <div className="space-y-2">
                <Label>Language</Label>
                <Select onValueChange={setLanguage} defaultValue={language}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="ar">🇸🇦 Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Language Selector - Removed, now above */}

              {/* Match ID (required for database save) */}
              <div className="space-y-2">
                <Label>Match ID (optional)</Label>
                <Input
                  placeholder="Enter match ID for database save"
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                />
              </div>
            </div>

            {/* Features Toggle */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Speaker Labels</Label>
                  <p className="text-sm text-muted-foreground">
                    Identify different speakers (AssemblyAI only)
                  </p>
                </div>
                <Switch
                  checked={needsSpeakerLabels}
                  onCheckedChange={setNeedsSpeakerLabels}
                  disabled={transcriptionService === 'gemini'}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Extract Events</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect soccer events (GOAL, PASS, etc.)
                  </p>
                </div>
                <Switch
                  checked={extractEvents}
                  onCheckedChange={setExtractEvents}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Save to Database</Label>
                  <p className="text-sm text-muted-foreground">
                    Store events in match_events table (requires Match ID)
                  </p>
                </div>
                <Switch
                  checked={saveToDatabase}
                  onCheckedChange={setSaveToDatabase}
                  disabled={!matchId}
                />
              </div>
            </div>

            {/* Roster Input */}
            <div className="space-y-2">
              <Label>Team Roster (optional)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Add player names to improve transcription accuracy
              </p>
              <RosterInput roster={roster} onRosterChange={setRoster} />
            </div>
          </div>

          {/* Audio Recorder */}
          <div className="bg-card rounded-lg border-2 border-pitch-green/20 p-8 shadow-lg">
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              isProcessing={isProcessing}
            />
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TranscriptionDisplay
              transcription={transcription}
              enhancedTranscription={enhancedTranscription}
              isLoading={isProcessing}
              status={status}
              service={service}
              processingTime={processingTime}
            />
            <EventTimeline events={events} />
          </div>

          {/* Event Log */}
          <EventLog logs={logs} />

          {/* Clear Button */}
          {(transcription || enhancedTranscription || events.length > 0) && (
            <div className="flex justify-center">
              <button
                onClick={handleClearAll}
                className="px-6 py-2 bg-destructive text-white rounded-md hover:bg-destructive/90 transition-colors"
              >
                Clear All Data
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
