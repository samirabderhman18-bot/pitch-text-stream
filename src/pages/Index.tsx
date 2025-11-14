import { useState, useEffect } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import TranscriptionDisplay from '@/components/TranscriptionDisplay';
import EventTimeline from '@/components/EventTimeline';
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

const Index = () => {
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState<SoccerEvent[]>([]);
  const [language, setLanguage] = useState('en');
  const { toast } = useToast();

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
      }
    }
  }, [transcription]);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setStatus('Processing audio chunk...');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        if (!base64Audio) return;

        const { data, error } = await supabase.functions.invoke('transcribe-commentary', {
          body: { audioData: base64Audio, languageCode: language },
        });

        if (error) throw error;
        
        const pollTranscript = async (transcriptId: string) => {
          const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('get-transcript', {
            body: { transcriptId },
          });

          if (transcriptError) throw transcriptError;

          if (transcriptData.status === 'completed') {
            setTranscription((prev) => `${prev} ${transcriptData.text}`);
            setIsProcessing(false);
            setStatus('Ready');
          } else if (transcriptData.status === 'error') {
            throw new Error('Transcription failed');
          } else {
            setTimeout(() => pollTranscript(transcriptId), 2000);
          }
        };

        pollTranscript(data.transcriptId);
      };
    } catch (error) {
      console.error('Error:', error);
      setIsProcessing(false);
      setStatus('Error');
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

          <div className="flex justify-center">
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

          <div className="bg-card rounded-lg border-2 border-pitch-green/20 p-8 shadow-lg">
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              isProcessing={isProcessing}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TranscriptionDisplay
              transcription={transcription}
              isLoading={isProcessing}
              status={status}
            />
            <EventTimeline events={events} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
