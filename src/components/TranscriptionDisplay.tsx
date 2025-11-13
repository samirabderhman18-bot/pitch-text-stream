import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface TranscriptionDisplayProps {
  transcription: string;
  isLoading: boolean;
  status?: string;
}

const TranscriptionDisplay = ({ transcription, isLoading, status }: TranscriptionDisplayProps) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Live Commentary Transcription
          {isLoading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status && (
          <div className="mb-4 text-sm text-muted-foreground">
            Status: <span className="font-medium">{status}</span>
          </div>
        )}
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          {transcription ? (
            <div className="space-y-2">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {transcription}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              {isLoading ? 'Processing audio...' : 'No transcription yet. Start recording or upload an audio file.'}
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TranscriptionDisplay;
