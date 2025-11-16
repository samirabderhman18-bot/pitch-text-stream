import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface Player {
  id: number;
  forename: string;
  surname: string;
  full_name: string | null;
  number: number | null;
  image_url: string | null;
}

interface PlayerManagementTableProps {
  players: Player[];
  onPlayersUpdate: () => void;
}

const PlayerManagementTable = ({ players, onPlayersUpdate }: PlayerManagementTableProps) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNumber, setEditNumber] = useState<string>('');
  const { toast } = useToast();

  const handleEdit = (player: Player) => {
    setEditingId(player.id);
    setEditNumber(player.number?.toString() || '');
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditNumber('');
  };

  const handleSave = async (playerId: number) => {
    const number = parseInt(editNumber);
    
    if (isNaN(number) || number < 1 || number > 99) {
      toast({
        title: "Invalid number",
        description: "Please enter a number between 1 and 99",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('players')
        .update({ number })
        .eq('id', playerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Player number updated",
      });

      setEditingId(null);
      setEditNumber('');
      onPlayersUpdate();
    } catch (error) {
      console.error('Error updating player:', error);
      toast({
        title: "Error",
        description: "Failed to update player number",
        variant: "destructive",
      });
    }
  };

  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No players loaded. Upload a JSON file to get started.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Number</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-32">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id}>
              <TableCell>
                {editingId === player.id ? (
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    className="w-20"
                  />
                ) : (
                  <span className="font-mono font-semibold">#{player.number}</span>
                )}
              </TableCell>
              <TableCell>
                {player.full_name || `${player.forename} ${player.surname}`}
              </TableCell>
              <TableCell>
                {editingId === player.id ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSave(player.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancel}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(player)}
                  >
                    Edit
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PlayerManagementTable;
