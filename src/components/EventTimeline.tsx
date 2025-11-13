import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SoccerEvent, EVENT_COLORS } from '@/types/soccer-events';
import { Clock } from 'lucide-react';

interface EventTimelineProps {
  events: SoccerEvent[];
}

const EventTimeline = ({ events }: EventTimelineProps) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Match Events Detected
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full">
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`${EVENT_COLORS[event.type]} font-semibold`}
                    >
                      {event.type.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {event.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No events detected yet. Events will appear as they are identified in the commentary.
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default EventTimeline;
