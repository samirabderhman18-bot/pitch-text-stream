import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock } from 'lucide-react';

interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'processing';
}

interface EventLogProps {
  logs: LogEntry[];
}

const EventLog = ({ logs }: EventLogProps) => {
  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'processing':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Event Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] w-full rounded-md border p-4">
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No events yet
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="text-sm border-b pb-2">
                  <span className="text-muted-foreground text-xs">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <p className={getLogColor(log.type)}>{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default EventLog;
