export type EventSource = 'text-detection' | 'gesture-capture' | 'pattern-capture';
export type EventType = 'PASS' | 'SHOT' | 'GOAL' | 'TACKLE' | 'FOUL' | 'CORNER' | 'OFFSIDE' | 'SUBSTITUTION' | 'VOICE_TAG';

export interface SoccerEvent {
  timestamp: number;
  confidence: number;
  text: string;
  eventSource: EventSource;
  type: EventType;
  // Optional specifics
  player?: string;
  playerNumber?: number;
  team?: string;
  patternType?: string;
  // Protocol for UI display
  protocolType?: string; 
}

export const EVENT_COLORS: Record<string, string> = {
  PASS: 'bg-blue-500/10 text-blue-600 border-blue-200',
  SHOT: 'bg-orange-500/10 text-orange-600 border-orange-200',
  TACKLE: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  FOUL: 'bg-red-500/10 text-red-600 border-red-200',
  VOICE_TAG: 'bg-purple-500/10 text-purple-600 border-purple-200',
  GOAL: 'bg-green-500/10 text-green-600 border-green-200',
};
