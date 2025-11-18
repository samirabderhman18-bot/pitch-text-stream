import { SoccerEvent, formatEventDisplay, EVENT_COLORS } from '@/types/soccer-events';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface EventTimelineProps {
  events: SoccerEvent[];
}

const EventTimeline = ({ events }: EventTimelineProps) => {
  if (events.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No events recorded yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => {
        const colorClass = EVENT_COLORS[event.type] || 'bg-muted text-muted-foreground border-muted';
        const displayText = formatEventDisplay(event);
        const sourceIcon = event.eventSource === 'gesture-capture' ? '📱' : 
                          event.eventSource === 'pattern-capture' ? '🔄' : '🎤';
        
        return (
          <Card key={index} className={`p-4 border-2 ${colorClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {event.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {sourceIcon} {event.eventSource === 'gesture-capture' ? 'Gesture' : 
                                event.eventSource === 'pattern-capture' ? 'Pattern' : 'Voice'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="font-medium text-sm">{displayText}</p>
                {event.text && (
                  <p className="text-xs text-muted-foreground mt-1">"{event.text}"</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-muted-foreground">
                  {Math.round(event.confidence * 100)}%
                </div>
              </div>
            </div>
            
            {/* Additional info for specific event types */}
            {event.eventSource === 'gesture-capture' && event.playerNumber && (
              <div className="mt-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  Player #{event.playerNumber}
                </span>
              </div>
            )}
            
            {event.eventSource === 'pattern-capture' && (
              <div className="mt-2 pt-2 border-t flex items-center gap-4">
                <span className="text-xs text-muted-foreground">
                  Pattern: {event.patternType}
                </span>
                <span className="text-xs text-muted-foreground">
                  {event.patternData.samples} samples
                </span>
                <span className="text-xs text-muted-foreground">
                  {(event.patternData.duration / 1000).toFixed(1)}s
                </span>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default EventTimeline;
