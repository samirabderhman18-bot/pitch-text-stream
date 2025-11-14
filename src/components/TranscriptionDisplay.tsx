import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles } from 'lucide-react';

interface TranscriptionDisplayProps {
  transcription: string;
  enhancedTranscription?: string;
  isLoading: boolean;
  status?: string;
  service?: string;
  processingTime?: number;
}

const TranscriptionDisplay = ({ 
  transcription, 
  enhancedTranscription,
  isLoading, 
  status,
  service,
  processingTime 
}: TranscriptionDisplayProps) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Live Commentary Transcription
            {isLoading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </CardTitle>
          {service && (
            <Badge variant="outline" className="text-xs">
              {service === 'huggingface' ? '⚡ HuggingFace' : '🎯 AssemblyAI'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status && (
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Status: <span className="font-medium text-foreground">{status}</span>
            </span>
            {processingTime && (
              <span className="text-xs text-muted-foreground">
                Processed in {(processingTime / 1000).toFixed(2)}s
              </span>
            )}
          </div>
        )}
        
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          {transcription || enhancedTranscription ? (
            <div className="space-y-4">
              {/* Enhanced Transcription (AI-corrected) */}
              {enhancedTranscription && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Sparkles className="w-4 h-4" />
                    AI-Enhanced Version
                  </div>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed bg-primary/5 p-3 rounded-md border border-primary/20">
                    {enhancedTranscription}
                  </p>
                </div>
              )}
              
              {/* Original Transcription */}
              {transcription && enhancedTranscription && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Original Transcription
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-sm">
                    {transcription}
                  </p>
                </div>
              )}
              
              {/* If no enhancement, show original */}
              {transcription && !enhancedTranscription && (
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {transcription}
                </p>
              )}
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
