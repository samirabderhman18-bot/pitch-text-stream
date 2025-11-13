import { useState, useEffect } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import TranscriptionDisplay from '@/components/TranscriptionDisplay';
import EventTimeline from '@/components/EventTimeline';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { detectEvents } from '@/utils/event-detector';
import { SoccerEvent } from '@/types/soccer-events';

const Index = () => {
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState<SoccerEvent[]>([]);
  const { toast } = useToast();

  // Detect events whenever transcription changes
  useEffect(() => {
    if (transcription) {
      const detectedEvents = detectEvents(transcription);
      setEvents(detectedEvents);
    }
  }, [transcription]);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setStatus('Uploading audio...');

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];

        if (!base64Audio) {
          throw new Error('Failed to process audio');
        }

        setStatus('Starting transcription...');

        // Send to edge function
        const { data, error } = await supabase.functions.invoke('transcribe-commentary', {
          body: { audioData: base64Audio },
        });

        if (error) throw error;

        const transcriptId = data.transcriptId;
        setStatus('Transcribing...');

        // Poll for results
        let attempts = 0;
        const maxAttempts = 60;
        
        const pollInterval = setInterval(async () => {
          attempts++;

          const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('get-transcript', {
            body: { transcriptId },
          });

          if (transcriptError) {
            clearInterval(pollInterval);
            throw transcriptError;
          }

          if (transcriptData.status === 'completed') {
            clearInterval(pollInterval);
            setTranscription(transcriptData.text);
            setIsProcessing(false);
            setStatus('Completed');
            toast({
              title: "Transcription complete",
              description: "Commentary has been transcribed successfully",
            });
          } else if (transcriptData.status === 'error') {
            clearInterval(pollInterval);
            throw new Error('Transcription failed');
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            throw new Error('Transcription timeout');
          }

          setStatus(`Processing... (${transcriptData.status})`);
        }, 2000);
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

          <div className="bg-card rounded-lg border-2 border-pitch-green/20 p-8 shadow-lg">
            <AudioRecorder onRecordingComplete={handleRecordingComplete} />
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
