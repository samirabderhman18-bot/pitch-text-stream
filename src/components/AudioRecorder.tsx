import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  isProcessing: boolean;
  mode: 'assembly' | 'huggingface' | 'browser';
}

const AudioRecorder = ({ onRecordingComplete, isProcessing, mode }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const processAudioChunk = () => {
    if (chunksRef.current.length > 0) {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      onRecordingComplete(audioBlob);
      chunksRef.current = [];
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          processAudioChunk(); // Process chunk immediately
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      // Record in 5-second chunks
      mediaRecorder.start(5000);
      setIsRecording(true);
      const modeLabel = mode === 'browser' ? 'Browser Whisper' : mode === 'huggingface' ? 'HuggingFace Whisper' : 'Assembly AI';
      toast({
        title: "Live transcription started",
        description: `Using ${modeLabel} - Commentary is being processed in real-time...`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({
        title: "Live transcription stopped",
      });
    }
  };

  // Automatically restart recording after processing
  useEffect(() => {
    if (isRecording && !isProcessing && mediaRecorderRef.current?.state === 'inactive') {
      mediaRecorderRef.current.start(5000);
    }
  }, [isRecording, isProcessing]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            size="lg"
            className="bg-live-red hover:bg-live-red/90 text-white gap-2"
            disabled={isProcessing}
          >
            <Mic className="w-5 h-5" />
            Start Live Transcription
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            size="lg"
            className="bg-destructive hover:bg-destructive/90 text-white gap-2"
          >
            <Square className="w-5 h-5" />
            Stop Transcription
          </Button>
        )}
      </div>
       <p className="text-sm text-muted-foreground">
        {isRecording ? 'Transcription is live...' : 'Click to start live transcription'}
      </p>
    </div>
  );
};

export default AudioRecorder;
