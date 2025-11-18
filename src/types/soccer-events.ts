// ============================================================================
// SOCCER EVENT TYPES - PROPER DISCRIMINATED UNIONS
// ============================================================================

// Base event interface with common properties
interface BaseEvent {
  timestamp: number;
  confidence: number;
  text: string;
}

// ============================================================================
// TEXT-DETECTED EVENTS (from voice transcription)
// ============================================================================

export interface PlayerToPlayerEvent extends BaseEvent {
  eventSource: 'text-detection';
  category: 'player-interaction';
  type: 'PASS' | 'TACKLE' | 'INTERCEPTION';
  playerA: string;
  playerB: string;
}

export interface PlayerActionEvent extends BaseEvent {
  eventSource: 'text-detection';
  category: 'player-action';
  type: 'SHOT' | 'GOAL' | 'SAVE';
  player: string;
}

export interface TeamEvent extends BaseEvent {
  eventSource: 'text-detection';
  category: 'team-action';
  type: 'CORNER' | 'FREEKICK' | 'PENALTY' | 'OFFSIDE';
  team: string;
}

export interface RefereeEvent extends BaseEvent {
  eventSource: 'text-detection';
  category: 'referee-decision';
  type: 'FOUL' | 'YELLOW_CARD' | 'RED_CARD';
  referee: string;
  player: string;
}

export interface SubstitutionEvent extends BaseEvent {
  eventSource: 'text-detection';
  category: 'substitution';
  type: 'SUBSTITUTION';
  playerOut: string;
  playerIn: string;
  team: string;
}

// ============================================================================
// GESTURE-CAPTURED EVENTS (from phone gestures)
// ============================================================================

export interface GestureCapturedEvent extends BaseEvent {
  eventSource: 'gesture-capture';
  gestureType: 'FLICK_FORWARD' | 'FLICK_BACK' | 'TILT' | 'HOLD_INVERTED';
  // The ACTUAL soccer event being recorded
  soccerEventType: 'PASS' | 'SHOT' | 'TACKLE' | 'VOICE_TAG';
  // Optional player info if voice tag was used
  playerNumber?: number;
  playerId?: string;
}

export interface PatternCapturedEvent extends BaseEvent {
  eventSource: 'pattern-capture';
  patternType: 'CIRCULAR' | 'FIGURE_8' | 'ZIGZAG' | 'SHAKE';
  soccerEventType: string; // User-defined mapping
  patternData: {
    path: string;
    velocity: number;
    duration: number;
    samples: number;
  };
}

// ============================================================================
// UNION TYPE - All possible events
// ============================================================================

export type SoccerEvent =
  | PlayerToPlayerEvent
  | PlayerActionEvent
  | TeamEvent
  | RefereeEvent
  | SubstitutionEvent
  | GestureCapturedEvent
  | PatternCapturedEvent;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isPlayerToPlayerEvent(event: SoccerEvent): event is PlayerToPlayerEvent {
  return event.eventSource === 'text-detection' && event.category === 'player-interaction';
}

export function isPlayerActionEvent(event: SoccerEvent): event is PlayerActionEvent {
  return event.eventSource === 'text-detection' && event.category === 'player-action';
}

export function isTeamEvent(event: SoccerEvent): event is TeamEvent {
  return event.eventSource === 'text-detection' && event.category === 'team-action';
}

export function isRefereeEvent(event: SoccerEvent): event is RefereeEvent {
  return event.eventSource === 'text-detection' && event.category === 'referee-decision';
}

export function isSubstitutionEvent(event: SoccerEvent): event is SubstitutionEvent {
  return event.eventSource === 'text-detection' && event.category === 'substitution';
}

export function isGestureEvent(event: SoccerEvent): event is GestureCapturedEvent {
  return event.eventSource === 'gesture-capture';
}

export function isPatternEvent(event: SoccerEvent): event is PatternCapturedEvent {
  return event.eventSource === 'pattern-capture';
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type SoccerEventType = SoccerEvent['type'];
export type EventSource = SoccerEvent['eventSource'];

// Keywords for text detection (unchanged for backward compatibility)
export const EVENT_KEYWORDS: Record<string, string[]> = {
  PASS: ['pass', 'passes', 'passing', 'through ball', 'cross'],
  GOAL: ['goal', 'scores', 'scored', 'finds the net', 'back of the net'],
  SHOT: ['shot', 'shoots', 'strike', 'effort', 'attempt'],
  SAVE: ['save', 'saved', 'saves', 'keeper', 'goalkeeper stops'],
  FOUL: ['foul', 'fouled', 'free kick awarded', 'infringement'],
  YELLOW_CARD: ['yellow card', 'booked', 'caution', 'cautioned'],
  RED_CARD: ['red card', 'sent off', 'dismissed', 'sending off'],
  CORNER: ['corner', 'corner kick', 'wins a corner'],
  FREEKICK: ['free kick', 'freekick', 'set piece'],
  PENALTY: ['penalty', 'spot kick', 'from the spot', 'penalty kick'],
  SUBSTITUTION: ['substitution', 'sub', 'comes on', 'replaced by', 'coming off'],
  OFFSIDE: ['offside', 'flag is up', 'offside position'],
  TACKLE: ['tackle', 'tackles', 'challenged', 'dispossessed'],
  INTERCEPTION: ['interception', 'intercepts', 'cuts out', 'reads the pass'],
};

export const EVENT_KEYWORDS_AR: Record<string, string[]> = {
  PASS: ['تمريرة', 'يمرر'],
  GOAL: ['هدف', 'يسجل'],
  SHOT: ['تسديدة', 'يسدد'],
  SAVE: ['تصدي', 'يتصدى'],
  FOUL: ['خطأ', 'فاول'],
  YELLOW_CARD: ['بطاقة صفراء', 'إنذار'],
  RED_CARD: ['بطاقة حمراء', 'طرد'],
  CORNER: ['ركنية', 'ضربة زاوية'],
  FREEKICK: ['ضربة حرة', 'ركلة حرة'],
  PENALTY: ['ضربة جزاء', 'ركلة جزاء'],
  SUBSTITUTION: ['تبديل', 'تغيير'],
  OFFSIDE: ['تسلل', 'وضعية تسلل'],
  TACKLE: ['افتكاك', 'يستخلص الكرة'],
  INTERCEPTION: ['اعتراض', 'يقطع الكرة'],
};

export const EVENT_COLORS: Record<string, string> = {
  PASS: 'bg-primary/10 text-primary border-primary/20',
  GOAL: 'bg-pitch-green/20 text-pitch-green border-pitch-green/40',
  SHOT: 'bg-accent/10 text-accent border-accent/20',
  SAVE: 'bg-secondary/10 text-secondary-foreground border-secondary/20',
  FOUL: 'bg-destructive/10 text-destructive border-destructive/20',
  YELLOW_CARD: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/40',
  RED_CARD: 'bg-live-red/20 text-live-red border-live-red/40',
  CORNER: 'bg-accent/10 text-accent-foreground border-accent/20',
  FREEKICK: 'bg-primary/10 text-primary border-primary/20',
  PENALTY: 'bg-pitch-green/20 text-pitch-green border-pitch-green/40',
  SUBSTITUTION: 'bg-secondary/10 text-secondary-foreground border-secondary/20',
  OFFSIDE: 'bg-destructive/10 text-destructive border-destructive/20',
  TACKLE: 'bg-primary/10 text-primary border-primary/20',
  INTERCEPTION: 'bg-accent/10 text-accent border-accent/20',
};

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

export function formatEventDisplay(event: SoccerEvent): string {
  switch (event.eventSource) {
    case 'text-detection':
      switch (event.category) {
        case 'player-interaction':
          return `${event.playerA} → ${event.type} → ${event.playerB}`;
        case 'player-action':
          return `${event.player} — ${event.type}`;
        case 'team-action':
          return `${event.team} — ${event.type}`;
        case 'referee-decision':
          return `Referee ${event.referee} — ${event.type} — ${event.player}`;
        case 'substitution':
          return `${event.playerOut} ↔ ${event.playerIn}`;
        default:
          const _exhaustive: never = event;
          return `Unknown event: ${JSON.stringify(_exhaustive)}`;
      }
    
    case 'gesture-capture':
      return `📱 ${event.gestureType} → ${event.soccerEventType}${event.playerNumber ? ` (#${event.playerNumber})` : ''}`;
    
    case 'pattern-capture':
      return `🔄 ${event.patternType} → ${event.soccerEventType}`;
    
    default:
      const _exhaustive: never = event;
      return `Unknown source: ${JSON.stringify(_exhaustive)}`;
  }
}
