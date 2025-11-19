// ============================================================================
// EVENT TYPES
// ============================================================================

export type EventSource = 'text-detection' | 'gesture-capture' | 'pattern-capture';

export type SoccerEventType = 
  | 'PASS' 
  | 'SHOT' 
  | 'GOAL' 
  | 'SAVE'
  | 'TACKLE' 
  | 'INTERCEPTION'
  | 'FOUL' 
  | 'YELLOW_CARD' 
  | 'RED_CARD'
  | 'CORNER' 
  | 'FREEKICK' 
  | 'PENALTY' 
  | 'OFFSIDE' 
  | 'SUBSTITUTION' 
  | 'VOICE_TAG';

export interface SoccerEvent {
  timestamp: number;
  confidence: number;
  text: string;
  eventSource: EventSource;
  type: SoccerEventType;
  
  // Optional Context (Text Detection)
  player?: string;
  playerA?: string; // Used in pass/tackle text events
  playerB?: string; // Used in pass/tackle text events
  team?: string;
  referee?: string;
  
  // Optional Context (Gestures)
  playerNumber?: number;
  patternType?: string;
  protocolType?: string; // UI Helper
}

// ============================================================================
// VISUAL CONFIGURATION
// ============================================================================

export const EVENT_COLORS: Record<string, string> = {
  PASS: 'bg-blue-500/10 text-blue-600 border-blue-200',
  SHOT: 'bg-orange-500/10 text-orange-600 border-orange-200',
  GOAL: 'bg-green-500/10 text-green-600 border-green-200',
  SAVE: 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
  TACKLE: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  INTERCEPTION: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  FOUL: 'bg-red-500/10 text-red-600 border-red-200',
  YELLOW_CARD: 'bg-yellow-400/20 text-yellow-700 border-yellow-400',
  RED_CARD: 'bg-red-600/20 text-red-700 border-red-600',
  CORNER: 'bg-violet-500/10 text-violet-600 border-violet-200',
  FREEKICK: 'bg-pink-500/10 text-pink-600 border-pink-200',
  PENALTY: 'bg-rose-500/10 text-rose-600 border-rose-200',
  OFFSIDE: 'bg-slate-500/10 text-slate-600 border-slate-200',
  SUBSTITUTION: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  VOICE_TAG: 'bg-purple-500/10 text-purple-600 border-purple-200',
};

// ============================================================================
// HELPER FUNCTIONS (Missing Export Fix)
// ============================================================================

export function formatEventDisplay(event: SoccerEvent): string {
  // 1. Handle Gesture/Motion Events
  if (event.eventSource === 'gesture-capture') {
    const details = event.playerNumber ? ` (Player #${event.playerNumber})` : '';
    return `📱 Motion: ${event.type}${details}`;
  }
  
  if (event.eventSource === 'pattern-capture') {
    return `🔄 Pattern: ${event.patternType} → ${event.type}`;
  }

  // 2. Handle Text/Voice Events
  if (event.playerA && event.playerB) {
    return `${event.playerA} → ${event.type} → ${event.playerB}`;
  }
  
  if (event.type === 'SUBSTITUTION' && event.player && event.playerB) {
    return `SUB: ${event.player} (Out) ↔ ${event.playerB} (In)`;
  }
  
  if (event.player) {
    return `${event.player} — ${event.type}`;
  }
  
  if (event.team) {
    return `${event.team} — ${event.type}`;
  }

  // 3. Fallback
  return event.text || `${event.type} Event`;
}

// ============================================================================
// KEYWORDS (Kept for backward compatibility with Text Detector)
// ============================================================================

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
