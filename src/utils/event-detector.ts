import { SoccerEvent, SoccerEventType, EVENT_KEYWORDS } from '@/types/soccer-events';

export const detectEvents = (text: string): SoccerEvent[] => {
  const events: SoccerEvent[] = [];
  const lowerText = text.toLowerCase();
  
  // Check each event type
  (Object.keys(EVENT_KEYWORDS) as SoccerEventType[]).forEach((eventType) => {
    const keywords = EVENT_KEYWORDS[eventType];
    
    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerText.matchAll(regex);
      
      for (const match of matches) {
        if (match.index !== undefined) {
          // Extract context around the keyword
          const start = Math.max(0, match.index - 50);
          const end = Math.min(text.length, match.index + keyword.length + 50);
          const context = text.substring(start, end).trim();
          
          events.push({
            type: eventType,
            timestamp: Date.now(),
            text: context,
            confidence: 0.8, // Basic confidence score
          });
        }
      }
    });
  });
  
  // Remove duplicates and sort by timestamp
  const uniqueEvents = events.filter((event, index, self) =>
    index === self.findIndex((e) => e.type === event.type && e.text === event.text)
  );
  
  return uniqueEvents.sort((a, b) => b.timestamp - a.timestamp);
};
