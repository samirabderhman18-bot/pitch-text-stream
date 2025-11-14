import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TranscriptionResult {
  text: string;
  enhanced?: string;
  speakers?: any[];
  service: string;
  processingTime: number;
}

interface UseTranscriptionOptions {
  languageCode?: string;
  roster?: string[];
  needsSpeakerLabels?: boolean;
}

export const useTranscription = (options: UseTranscriptionOptions = {}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [enhancedTranscription, setEnhancedTranscription] = useState('');
  const [service, setService] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);
  const { toast } = useToast();

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Convert audio blob to base64
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]); // Remove data:audio/webm;base64, prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Calculate audio duration estimate (3 second chunks)
      const audioDuration = 3000; // milliseconds

      // Call the unified transcription coordinator
      const { data, error } = await supabase.functions.invoke('transcribe-coordinator', {
        body: {
          audioData: base64Audio,
          languageCode: options.languageCode || 'en',
          roster: options.roster || [],
          audioDuration,
          needsSpeakerLabels: options.needsSpeakerLabels || false,
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

      toast({
        title: "Transcription complete",
        description: `Processed using ${result.service} in ${(result.processingTime / 1000).toFixed(2)}s`,
      });

      return result;
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: "Transcription failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const clearTranscription = () => {
    setTranscription('');
    setEnhancedTranscription('');
    setService('');
    setProcessingTime(0);
  };

  return {
    processAudio,
    clearTranscription,
    isProcessing,
    transcription,
    enhancedTranscription,
    service,
    processingTime,
  };
};
