import { useState, useEffect } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import TranscriptionDisplay from '@/components/TranscriptionDisplay';
import EventTimeline from '@/components/EventTimeline';
import EventLog from '@/components/EventLog';
import RosterInput from '@/components/RosterInput';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { detectEvents } from '@/utils/event-detector';
import { SoccerEvent } from '@/types/soccer-events';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'processing';
}

interface TranscriptionResult {
  text: string;
  enhanced?: string;
  speakers?: any[];
  service: string;
  processingTime: number;
}

const Index = () => {
  const [transcription, setTranscription] = useState('');
  const [enhancedTranscription, setEnhancedTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState<SoccerEvent[]>([]);
  const [language, setLanguage] = useState('en');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [service, setService] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [needsSpeakerLabels, setNeedsSpeakerLabels] = useState(false);
  const { toast } = useToast();

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{ timestamp: Date.now(), message, type }, ...prev].slice(0, 50));
  };

  // Detect events whenever enhanced transcription changes
  useEffect(() => {
    const textToAnalyze = enhancedTranscription || transcription;
    if (textToAnalyze) {
      const detectedEvents = detectEvents(textToAnalyze, language);
      // Filter out events that have already been detected
      const newEvents = detectedEvents.filter(
        (newEvent) => !events.some((existingEvent) => existingEvent.text === newEvent.text)
      );
      if (newEvents.length > 0) {
        setEvents((prevEvents) => [...newEvents, ...prevEvents]);
        newEvents.forEach(event => {
          addLog(`Detected ${event.type}: ${event.text.substring(0, 50)}...`, 'success');
        });
      }
    }
  }, [enhancedTranscription, transcription]);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    addLog('Processing audio chunk with unified coordinator...', 'processing');
    setStatus('Processing audio chunk...');

    try {
      // Convert audio blob to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]); // Remove data:audio/webm;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Estimate audio duration (3 second chunks)
      const audioDuration = 3000;

      addLog('Sending to transcription coordinator...', 'processing');

      // Call the unified transcription coordinator
      const { data, error } = await supabase.functions.invoke('transcribe-coordinator', {
        body: {
          audioData: base64Audio,
          languageCode: language,
          roster: roster,
          audioDuration: audioDuration,
          needsSpeakerLabels: needsSpeakerLabels,
        },
      });

      if (error) throw error;

      const result = data as TranscriptionResult;

      // Update state with results
      setTranscription(prev => prev + ' ' + result.text);
      if (result.enhanced) {
        setEnhancedTranscription(prev => prev + ' ' + result.enhanced);
      }
      setService(result.service);
      setProcessingTime(result.processingTime);

      addLog(
        `Transcribed using ${result.service} (${(result.processingTime / 1000).toFixed(2)}s)`,
        'success'
      );

      if (result.enhanced) {
        addLog('AI enhancement applied successfully', 'success');
      }

      setIsProcessing(false);
      setStatus('Ready');

      toast({
        title: "Transcription complete",
        description: `Processed using ${result.service} in ${(result.processingTime / 1000).toFixed(2)}s`,
      });

    } catch (error) {
      console.error('Error:', error);
      setIsProcessing(false);
      setStatus('Error');
      addLog(`Error: ${error instanceof Error ? error.message : 'Failed to transcribe'}`, 'error');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to transcribe audio",
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
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pitch-green/10 mb-4">
              <div className="w-12 h-12 rounded-full bg-pitch-green" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              ⚽ Soccer Commentary Transcription
            </h1>
            <p className="text-lg text-muted-foreground">
              Real-time speech-to-text with intelligent AI routing
            </p>
            
            {service && (
              <div className="flex items-center justify-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {service === 'huggingface' ? '⚡ HuggingFace Whisper' : '🎯 AssemblyAI'}
                </Badge>
                {processingTime > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Avg: {(processingTime / 1000).toFixed(2)}s per chunk
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-4">
            <Select onValueChange={setLanguage} defaultValue={language}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="ar">🇸🇦 Arabic</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 px-4 py-2 border rounded-md bg-card">
              <input
                type="checkbox"
                id="speakerLabels"
                checked={needsSpeakerLabels}
                onChange={(e) => setNeedsSpeakerLabels(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="speakerLabels" className="text-sm cursor-pointer">
                Detect Speakers
              </label>
            </div>
          </div>

          <div className="bg-card rounded-lg border-2 border-pitch-green/20 p-8 shadow-lg space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Team Roster (Optional)</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Add player names to improve AI transcription accuracy
              </p>
              <RosterInput roster={roster} onRosterChange={setRoster} />
            </div>
            
            <div className="border-t pt-6">
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isProcessing={isProcessing}
              />
            </div>
          </div>

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

          <EventLog logs={logs} />

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
