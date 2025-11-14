import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

interface RosterInputProps {
  roster: string[];
  onRosterChange: (roster: string[]) => void;
}

const RosterInput = ({ roster, onRosterChange }: RosterInputProps) => {
  const [newPlayer, setNewPlayer] = useState('');

  const addPlayer = () => {
    if (newPlayer.trim() && !roster.includes(newPlayer.trim())) {
      onRosterChange([...roster, newPlayer.trim()]);
      setNewPlayer('');
    }
  };

  const removePlayer = (player: string) => {
    onRosterChange(roster.filter(p => p !== player));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Add player name..."
          value={newPlayer}
          onChange={(e) => setNewPlayer(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
          className="flex-1"
        />
        <Button onClick={addPlayer} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>
      
      {roster.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {roster.map((player) => (
            <Badge key={player} variant="secondary" className="gap-2">
              {player}
              <X
                className="w-3 h-3 cursor-pointer hover:text-destructive"
                onClick={() => removePlayer(player)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default RosterInput;
