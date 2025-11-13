import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
}

const AudioRecorder = ({ onRecordingComplete }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({
        title: "Recording started",
        description: "Commentary recording in progress...",
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
        title: "Recording stopped",
        description: "Processing audio...",
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      onRecordingComplete(file);
      toast({
        title: "File uploaded",
        description: "Processing audio file...",
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        {!isRecording ? (
          <>
            <Button
              onClick={startRecording}
              size="lg"
              className="bg-live-red hover:bg-live-red/90 text-white gap-2"
            >
              <Mic className="w-5 h-5" />
              Start Recording
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <Upload className="w-5 h-5" />
              Upload Audio
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </>
        ) : (
          <Button
            onClick={stopRecording}
            size="lg"
            className="bg-destructive hover:bg-destructive/90 text-white gap-2"
          >
            <Square className="w-5 h-5" />
            Stop Recording
          </Button>
        )}
      </div>

      {audioUrl && (
        <audio src={audioUrl} controls className="w-full max-w-md" />
      )}
    </div>
  );
};

export default AudioRecorder;
