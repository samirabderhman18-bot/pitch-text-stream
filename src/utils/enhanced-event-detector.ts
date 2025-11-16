import { SoccerEvent, SoccerEventType, EVENT_KEYWORDS, EVENT_KEYWORDS_AR, RecognitionProtocol } from '@/types/soccer-events';

interface Player {
  full_name: string | null;
  forename: string;
  surname: string;
  number: number | null;
}

// Enhanced entity extraction that uses player numbers from the database
const extractEntitiesWithDatabase = (text: string, players: Player[]): string[] => {
  const foundPlayers: string[] = [];
  
  // Extract numbers from text (look for jersey numbers)
  const numberMatches = text.match(/\b(\d{1,2})\b/g);
  
  if (numberMatches) {
    numberMatches.forEach(numStr => {
      const number = parseInt(numStr);
      const player = players.find(p => p.number === number);
      if (player && player.full_name) {
        foundPlayers.push(`#${number} ${player.full_name}`);
      }
    });
  }
  
  // Fallback to name matching if no numbers found
  if (foundPlayers.length === 0) {
    players.forEach(player => {
      const textLower = text.toLowerCase();
      const fullNameLower = player.full_name?.toLowerCase();
      const forenameLower = player.forename.toLowerCase();
      const surnameLower = player.surname.toLowerCase();
      
      if (fullNameLower && textLower.includes(fullNameLower)) {
        foundPlayers.push(player.full_name);
      } else if (textLower.includes(forenameLower) || textLower.includes(surnameLower)) {
        foundPlayers.push(player.full_name || `${player.forename} ${player.surname}`);
      }
    });
  }
  
  return [...new Set(foundPlayers)];
};

const detectEventsEnWithDatabase = (text: string, players: Player[]): SoccerEvent[] => {
  const events: SoccerEvent[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  sentences.forEach((sentence) => {
    const entities = extractEntitiesWithDatabase(sentence, players);
    
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
              confidence: entities.length > 0 ? 0.9 : 0.7, // Higher confidence with database matches
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

const detectEventsArWithDatabase = (text: string, players: Player[]): SoccerEvent[] => {
  const events: SoccerEvent[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  sentences.forEach((sentence) => {
    // Try to find player numbers in Arabic text
    const foundPlayers: string[] = [];
    const numberMatches = sentence.match(/\b(\d{1,2})\b/g);
    
    if (numberMatches) {
      numberMatches.forEach(numStr => {
        const number = parseInt(numStr);
        const player = players.find(p => p.number === number);
        if (player && player.full_name) {
          foundPlayers.push(`#${number} ${player.full_name}`);
        }
      });
    }
    
    // Fallback to name matching
    if (foundPlayers.length === 0) {
      players.forEach(player => {
        const textLower = sentence.toLowerCase();
        const forenameLower = player.forename.toLowerCase();
        const surnameLower = player.surname.toLowerCase();
        
        if (textLower.includes(forenameLower) || textLower.includes(surnameLower)) {
          foundPlayers.push(player.full_name || `${player.forename} ${player.surname}`);
        }
      });
    }

    (Object.keys(EVENT_KEYWORDS_AR) as SoccerEventType[]).forEach((eventType) => {
      const keywords = EVENT_KEYWORDS_AR[eventType];

      for (const keyword of keywords) {
        if (sentence.includes(keyword)) {
          const protocolType: RecognitionProtocol = foundPlayers.length >= 2
            ? 'Player A — Event — Player B'
            : foundPlayers.length === 1
            ? 'Player — Event'
            : 'Team — Event';

          events.push({
            type: eventType,
            timestamp: Date.now(),
            text: sentence.trim(),
            confidence: foundPlayers.length > 0 ? 0.85 : 0.7,
            protocolType,
            playerA: foundPlayers[0],
            playerB: foundPlayers[1],
            team: foundPlayers.length === 0 ? 'فريق غير معروف' : undefined,
          });
          break;
        }
      }
    });
  });
  return events;
};

export const detectEventsWithDatabase = (
  text: string, 
  language: string = 'en',
  players: Player[] = []
): SoccerEvent[] => {
  const events = language === 'ar' 
    ? detectEventsArWithDatabase(text, players)
    : detectEventsEnWithDatabase(text, players);

  const uniqueEvents = events.filter(
    (event, index, self) => index === self.findIndex((e) => e.text === event.text && e.type === event.type)
  );

  return uniqueEvents.sort((a, b) => b.timestamp - a.timestamp);
};