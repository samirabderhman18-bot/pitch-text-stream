import { 
  SoccerEvent, 
  PlayerToPlayerEvent,
  PlayerActionEvent,
  TeamEvent,
  RefereeEvent,
  SubstitutionEvent,
  EVENT_KEYWORDS, 
  EVENT_KEYWORDS_AR 
} from '@/types/soccer-events';

interface Player {
  full_name: string | null;
  forename: string;
  surname: string;
  number: number | null;
}

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

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

// ============================================================================
// ENGLISH EVENT DETECTION
// ============================================================================

const detectEventsEnWithDatabase = (text: string, players: Player[]): SoccerEvent[] => {
  const events: SoccerEvent[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  sentences.forEach((sentence) => {
    const entities = extractEntitiesWithDatabase(sentence, players);
    const sentenceLower = sentence.toLowerCase();
    
    // Check for each event type
    Object.entries(EVENT_KEYWORDS).forEach(([eventType, keywords]) => {
      for (const keyword of keywords) {
        if (sentenceLower.includes(keyword.toLowerCase())) {
          const isRefereeEvent = sentenceLower.includes('referee');
          
          // Create appropriate event based on context
          if (isRefereeEvent && entities.length > 0) {
            // Referee event
            const refereeNameMatch = sentence.match(/referee ([A-Z][a-z]+)/i);
            const event: RefereeEvent = {
              eventSource: 'text-detection',
              category: 'referee-decision',
              type: eventType as 'FOUL' | 'YELLOW_CARD' | 'RED_CARD',
              referee: refereeNameMatch ? refereeNameMatch[1] : 'Unknown Referee',
              player: entities[0],
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: 0.9,
            };
            events.push(event);
          } else if (['PASS', 'TACKLE', 'INTERCEPTION'].includes(eventType) && entities.length >= 2) {
            // Player-to-player interaction
            const event: PlayerToPlayerEvent = {
              eventSource: 'text-detection',
              category: 'player-interaction',
              type: eventType as 'PASS' | 'TACKLE' | 'INTERCEPTION',
              playerA: entities[0],
              playerB: entities[1],
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: 0.9,
            };
            events.push(event);
          } else if (['SHOT', 'GOAL', 'SAVE'].includes(eventType) && entities.length === 1) {
            // Single player action
            const event: PlayerActionEvent = {
              eventSource: 'text-detection',
              category: 'player-action',
              type: eventType as 'SHOT' | 'GOAL' | 'SAVE',
              player: entities[0],
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: 0.9,
            };
            events.push(event);
          } else if (eventType === 'SUBSTITUTION' && entities.length >= 2) {
            // Substitution
            const event: SubstitutionEvent = {
              eventSource: 'text-detection',
              category: 'substitution',
              type: 'SUBSTITUTION',
              playerOut: entities[0],
              playerIn: entities[1],
              team: 'Unknown Team',
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: 0.85,
            };
            events.push(event);
          } else if (['CORNER', 'FREEKICK', 'PENALTY', 'OFFSIDE'].includes(eventType)) {
            // Team event
            const event: TeamEvent = {
              eventSource: 'text-detection',
              category: 'team-action',
              type: eventType as 'CORNER' | 'FREEKICK' | 'PENALTY' | 'OFFSIDE',
              team: entities.length > 0 ? entities[0] : 'Unknown Team',
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: entities.length > 0 ? 0.85 : 0.7,
            };
            events.push(event);
          }
          break;
        }
      }
    });
  });
  
  return events;
};

// ============================================================================
// ARABIC EVENT DETECTION
// ============================================================================

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

    Object.entries(EVENT_KEYWORDS_AR).forEach(([eventType, keywords]) => {
      for (const keyword of keywords) {
        if (sentence.includes(keyword)) {
          // Create appropriate event based on context (similar to English)
          if (['PASS', 'TACKLE', 'INTERCEPTION'].includes(eventType) && foundPlayers.length >= 2) {
            const event: PlayerToPlayerEvent = {
              eventSource: 'text-detection',
              category: 'player-interaction',
              type: eventType as 'PASS' | 'TACKLE' | 'INTERCEPTION',
              playerA: foundPlayers[0],
              playerB: foundPlayers[1],
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: 0.85,
            };
            events.push(event);
          } else if (['SHOT', 'GOAL', 'SAVE'].includes(eventType) && foundPlayers.length === 1) {
            const event: PlayerActionEvent = {
              eventSource: 'text-detection',
              category: 'player-action',
              type: eventType as 'SHOT' | 'GOAL' | 'SAVE',
              player: foundPlayers[0],
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: 0.85,
            };
            events.push(event);
          } else if (['CORNER', 'FREEKICK', 'PENALTY', 'OFFSIDE'].includes(eventType)) {
            const event: TeamEvent = {
              eventSource: 'text-detection',
              category: 'team-action',
              type: eventType as 'CORNER' | 'FREEKICK' | 'PENALTY' | 'OFFSIDE',
              team: foundPlayers.length > 0 ? foundPlayers[0] : 'فريق غير معروف',
              timestamp: Date.now(),
              text: sentence.trim(),
              confidence: foundPlayers.length > 0 ? 0.85 : 0.7,
            };
            events.push(event);
          }
          break;
        }
      }
    });
  });
  
  return events;
};

// ============================================================================
// MAIN EXPORT
// ============================================================================

export const detectEventsWithDatabase = (
  text: string, 
  language: string = 'en',
  players: Player[] = []
): SoccerEvent[] => {
  const events = language === 'ar' 
    ? detectEventsArWithDatabase(text, players)
    : detectEventsEnWithDatabase(text, players);

  // Remove duplicates based on text and type
  const uniqueEvents = events.filter(
    (event, index, self) => 
      index === self.findIndex((e) => 
        e.text === event.text && e.type === event.type
      )
  );

  return uniqueEvents.sort((a, b) => b.timestamp - a.timestamp);
};
