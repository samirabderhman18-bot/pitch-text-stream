import { SoccerEvent, SoccerEventType, EVENT_KEYWORDS, RecognitionProtocol } from '@/types/soccer-events';

// Regex to find capitalized words, which could be names of players, teams, or referees.
// This regex looks for sequences of capitalized words.
const ENTITY_REGEX = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;

const extractEntities = (text: string): string[] => {
  const matches = text.match(ENTITY_REGEX);
  return matches ? [...new Set(matches)] : []; // Return unique entities
};

export const detectEvents = (text: string): SoccerEvent[] => {
  const events: SoccerEvent[] = [];
  // Split text into sentences for more accurate context.
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
            // Assuming the first entity is the player, which is a simplification.
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
            team = 'Unknown Team'; // Placeholder
          }

          // Create the event if a protocol was determined
          if (protocolType) {
            const newEvent: SoccerEvent = {
              type: eventType,
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: 0.8, // Default confidence
              protocolType,
              playerA,
              playerB,
              team,
              referee,
            };
            events.push(newEvent);
            break; // Move to the next sentence once an event is detected in the current one.
          }
        }
      }
    });
  });

  // Remove duplicates - simple check based on text
  const uniqueEvents = events.filter(
    (event, index, self) => index === self.findIndex((e) => e.text === event.text && e.type === event.type)
  );

  return uniqueEvents.sort((a, b) => b.timestamp - a.timestamp);
};
