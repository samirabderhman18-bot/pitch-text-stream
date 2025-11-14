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
import { transcribeAudioBrowser } from '@/utils/whisper-browser';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TranscriptionMode = 'assembly' | 'huggingface' | 'browser';

interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'processing';
}

const Index = () => {
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState<SoccerEvent[]>([]);
  const [language, setLanguage] = useState('en');
  const [mode, setMode] = useState<TranscriptionMode>('browser');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{ timestamp: Date.now(), message, type }, ...prev].slice(0, 50));
  };

  // Detect events whenever transcription changes
  useEffect(() => {
    if (transcription) {
      const detectedEvents = detectEvents(transcription, language);
      // Filter out events that have already been detected in the previous transcript
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
  }, [transcription]);

  const enhanceWithGemini = async (text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('enhance-with-gemini', {
        body: { text, roster, language },
      });

      if (error) throw error;
      return data.text;
    } catch (error) {
      console.error('Gemini enhancement error:', error);
      return text; // Return original if enhancement fails
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    addLog(`Processing audio chunk with ${mode}...`, 'processing');
    setStatus('Processing audio chunk...');

    try {
      let rawText = '';
      
      if (mode === 'browser') {
        // Browser-based Whisper
        addLog('Transcribing with browser-based Whisper...', 'processing');
        rawText = await transcribeAudioBrowser(audioBlob);
      } else if (mode === 'huggingface') {
        // HuggingFace API
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result?.toString().split(',')[1];
          if (!base64Audio) return;

          addLog('Sending to HuggingFace API...', 'processing');
          const { data, error } = await supabase.functions.invoke('transcribe-huggingface', {
            body: { audioData: base64Audio, languageCode: language },
          });

          if (error) throw error;
          
          rawText = data.text;
        };
        reader.readAsDataURL(audioBlob);
        await new Promise(resolve => { reader.onloadend = resolve; });
      } else {
        // Assembly AI
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result?.toString().split(',')[1];
            if (!base64Audio) {
              resolve();
              return;
            }

            addLog('Uploading to Assembly AI...', 'processing');
            const { data, error } = await supabase.functions.invoke('transcribe-commentary', {
              body: { audioData: base64Audio, languageCode: language },
            });

            if (error) {
              reject(error);
              return;
            }
            
            addLog('Polling Assembly AI for results...', 'processing');
            const pollTranscript = async (transcriptId: string) => {
              const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('get-transcript', {
                body: { transcriptId },
              });

              if (transcriptError) {
                reject(transcriptError);
                return;
              }

              if (transcriptData.status === 'completed') {
                rawText = transcriptData.text;
                resolve();
              } else if (transcriptData.status === 'error') {
                reject(new Error('Transcription failed'));
              } else {
                setTimeout(() => pollTranscript(transcriptId), 2000);
              }
            };

            pollTranscript(data.transcriptId);
          };
          reader.readAsDataURL(audioBlob);
        });
      }

      // Enhance with Gemini AI
      if (rawText) {
        addLog('Enhancing with Gemini AI...', 'processing');
        const enhancedText = await enhanceWithGemini(rawText);
        setTranscription((prev) => `${prev} ${enhancedText}`);
        addLog('Transcription enhanced and completed', 'success');
      }
      
      setIsProcessing(false);
      setStatus('Ready');
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
              Real-time speech-to-text powered by Assembly AI
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <Select onValueChange={(value: TranscriptionMode) => setMode(value)} defaultValue={mode}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="browser">Browser Whisper</SelectItem>
                <SelectItem value="huggingface">HuggingFace API</SelectItem>
                <SelectItem value="assembly">Assembly AI</SelectItem>
              </SelectContent>
            </Select>
            
            <Select onValueChange={setLanguage} defaultValue={language}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card rounded-lg border-2 border-pitch-green/20 p-8 shadow-lg space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Team Roster (Optional)</h3>
              <RosterInput roster={roster} onRosterChange={setRoster} />
            </div>
            
            <div className="border-t pt-6">
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isProcessing={isProcessing}
                mode={mode}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TranscriptionDisplay
              transcription={transcription}
              isLoading={isProcessing}
              status={status}
            />
            <EventTimeline events={events} />
          </div>

          <EventLog logs={logs} />
        </div>
      </div>
    </div>
  );
};

export default Index;
