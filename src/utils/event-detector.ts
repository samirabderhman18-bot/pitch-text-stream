import { SoccerEvent, SoccerEventType, EVENT_KEYWORDS, EVENT_KEYWORDS_AR, RecognitionProtocol } from '@/types/soccer-events';

// Regex to find capitalized words (for English)
const ENTITY_REGEX = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;

const extractEntities = (text: string): string[] => {
  const matches = text.match(ENTITY_REGEX);
  return matches ? [...new Set(matches)] : [];
};

const detectEventsEn = (text: string): SoccerEvent[] => {
  const events: SoccerEvent[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  sentences.forEach((sentence) => {
    const entities = extractEntities(sentence);
    
    (Object.keys(EVENT_KEYWORDS) as SoccerEventType[]).forEach((eventType) => {
      const keywords = EVENT_KEYWORDS[eventType];
      
      for (const keyword of keywords) {
        if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
          let protocolType: RecognitionProtocol | null = null;
          let playerA: string | undefined;
          let playerB: string | undefined;
          let team: string | undefined;
          let referee: string | undefined;

          const isRefereeEvent = sentence.toLowerCase().includes('referee');
          
          if (isRefereeEvent && entities.length > 0) {
            protocolType = 'Referee — Event — Player';
            playerA = entities[0];
            const refereeNameMatch = sentence.match(/referee ([A-Z][a-z]+)/i);
            referee = refereeNameMatch ? refereeNameMatch[1] : 'Unknown Referee';
          } else if (entities.length >= 2) {
            protocolType = 'Player A — Event — Player B';
            playerA = entities[0];
            playerB = entities[1];
          } else if (entities.length === 1) {
            protocolType = 'Player — Event';
            playerA = entities[0];
          } else {
            protocolType = 'Team — Event';
            team = 'Unknown Team';
          }

          if (protocolType) {
            events.push({
              type: eventType,
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: 0.8,
              protocolType,
              playerA,
              playerB,
              team,
              referee,
            });
            break;
          }
        }
      }
    });
  });
  return events;
};

const detectEventsAr = (text: string): SoccerEvent[] => {
  const events: SoccerEvent[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  sentences.forEach((sentence) => {
    (Object.keys(EVENT_KEYWORDS_AR) as SoccerEventType[]).forEach((eventType) => {
      const keywords = EVENT_KEYWORDS_AR[eventType];

      for (const keyword of keywords) {
        if (sentence.includes(keyword)) {
          events.push({
            type: eventType,
            timestamp: Date.now(),
            text: sentence.trim(),
            confidence: 0.7, // Lower confidence for simpler detection
            protocolType: 'Team — Event', // Default for Arabic for now
            team: 'فريق غير معروف',
          });
          break;
        }
      }
    });
  });
  return events;
};

export const detectEvents = (text: string, language: string = 'en'): SoccerEvent[] => {
  const events = language === 'ar' ? detectEventsAr(text) : detectEventsEn(text);

  const uniqueEvents = events.filter(
    (event, index, self) => index === self.findIndex((e) => e.text === event.text && e.type === event.type)
  );

  return uniqueEvents.sort((a, b) => b.timestamp - a.timestamp);
};
