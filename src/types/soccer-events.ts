export type SoccerEventType =
  | 'PASS'
  | 'GOAL'
  | 'SHOT'
  | 'SAVE'
  | 'FOUL'
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'CORNER'
  | 'FREEKICK'
  | 'PENALTY'
  | 'SUBSTITUTION'
  | 'OFFSIDE'
  | 'TACKLE'
  | 'INTERCEPTION';

export type RecognitionProtocol =
  | 'Player A — Event — Player B'
  | 'Player — Event'
  | 'Team — Event'
  | 'Referee — Event — Player';

export interface SoccerEvent {
  type: SoccerEventType;
  timestamp: number;
  text: string;
  confidence: number;
  protocolType: RecognitionProtocol;
  playerA?: string;
  playerB?: string;
  team?: string;
  referee?: string;
}

export const EVENT_KEYWORDS: Record<SoccerEventType, string[]> = {
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

export const EVENT_KEYWORDS_AR: Record<SoccerEventType, string[]> = {
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

export const EVENT_COLORS: Record<SoccerEventType, string> = {
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
