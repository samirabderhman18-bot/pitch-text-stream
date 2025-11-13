import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SoccerEvent, EVENT_COLORS } from '@/types/soccer-events';
import { Clock, User, Users, Shield, Gavel } from 'lucide-react';

interface EventTimelineProps {
  events: SoccerEvent[];
}

const EventTimeline = ({ events }: EventTimelineProps) => {
  const renderEventContent = (event: SoccerEvent) => {
    switch (event.protocolType) {
      case 'Player A — Event — Player B':
        return (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-primary" />
            <span className="font-semibold">{event.playerA}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold">{event.playerB}</span>
          </div>
        );
      case 'Player — Event':
        return (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-primary" />
            <span className="font-semibold">{event.playerA}</span>
          </div>
        );
      case 'Team — Event':
        return (
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-semibold">{event.team}</span>
          </div>
        );
      case 'Referee — Event — Player':
        return (
          <div className="flex items-center gap-2 text-sm">
            <Gavel className="w-4 h-4 text-destructive" />
            <span className="font-semibold">{event.referee}</span>
            <span className="text-muted-foreground">to</span>
            <User className="w-4 h-4 text-primary" />
            <span className="font-semibold">{event.playerA}</span>
          </div>
        );
      default:
        return null;
    }
  };

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
                  className="flex flex-col gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
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
                  {renderEventContent(event)}
                  <p className="text-sm text-foreground/80 leading-relaxed mt-1">
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
