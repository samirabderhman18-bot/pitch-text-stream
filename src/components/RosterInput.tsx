import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Club {
  id: number;
  name: string;
  playerCount: number;
}

interface Player {
  id: number;
  name: string;
  club_id: number;
}

interface RosterInputProps {
  selectedClubId: number | null;
  onClubSelected: (clubId: number | null) => void;
}

const RosterInput = ({ selectedClubId, onClubSelected }: RosterInputProps) => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingClubs, setIsLoadingClubs] = useState(false);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isUploadingJson, setIsUploadingJson] = useState(false);
  const [selectedClubName, setSelectedClubName] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const { toast } = useToast();

  // Load clubs from database on component mount
  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    setIsLoadingClubs(true);
    try {
      // Query clubs table directly - no API call needed
      const { data: clubsData, error: clubsError } = await supabase
        .from('clubs')
        .select('id, name')
        .order('name');

      if (clubsError) throw clubsError;

      if (clubsData && clubsData.length > 0) {
        // Get player count for each club
        const clubsWithCounts = await Promise.all(
          clubsData.map(async (club) => {
            const { count, error } = await supabase
              .from('players')
              .select('*', { count: 'exact', head: true })
              .eq('club_id', club.id);

            return {
              id: club.id,
              name: club.name,
              playerCount: error ? 0 : (count || 0),
            };
          })
        );

        setClubs(clubsWithCounts);
      } else {
        setClubs([]);
      }
    } catch (error) {
      console.error('Error loading clubs:', error);
      toast({
        title: "Error",
        description: "Failed to load clubs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingClubs(false);
    }
  };

  const loadPlayers = async (clubId: number) => {
    setIsLoadingPlayers(true);
    try {
      const { data: playersData, error } = await supabase
        .from('players')
        .select('id, name, club_id')
        .eq('club_id', clubId)
        .order('name');

      if (error) throw error;

      setPlayers(playersData || []);
    } catch (error) {
      console.error('Error loading players:', error);
      toast({
        title: "Error",
        description: "Failed to load players. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const handleClubSelect = async (clubIdString: string) => {
    const clubId = parseInt(clubIdString);
    const club = clubs.find(c => c.id === clubId);
    
    if (club) {
      onClubSelected(clubId);
      setSelectedClubName(club.name);
      setPlayerCount(club.playerCount);
      
      // Load players for this club
      await loadPlayers(clubId);
      
      toast({
        title: "Club selected",
        description: `${club.name} - ${club.playerCount} players available`,
      });
    }
  };

  const clearSelection = () => {
    onClubSelected(null);
    setSelectedClubName('');
    setPlayerCount(0);
    setPlayers([]);
  };

  const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingJson(true);
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      if (!jsonData.PlayerData || !Array.isArray(jsonData.PlayerData)) {
        throw new Error('Invalid JSON format. Expected {PlayerData: [...]}');
      }

      const { data, error } = await supabase.functions.invoke('upload-players', {
        body: { playerData: jsonData.PlayerData }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Inserted ${data.playersInserted} players, updated ${data.playersUpdated} players`,
      });

      // Reload clubs after upload
      await loadClubs();
    } catch (error) {
      console.error('JSON upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload JSON file',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingJson(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        <label htmlFor="json-upload">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploadingJson}
            onClick={() => document.getElementById('json-upload')?.click()}
          >
            {isUploadingJson ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload JSON
              </>
            )}
          </Button>
        </label>
        <input
          id="json-upload"
          type="file"
          accept=".json"
          onChange={handleJsonUpload}
          className="hidden"
        />
      </div>
      
      <div className="space-y-2">
        <Select 
          onValueChange={handleClubSelect} 
          value={selectedClubId?.toString() || undefined}
          disabled={isLoadingClubs || clubs.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={
              isLoadingClubs 
                ? "Loading clubs..." 
                : clubs.length === 0 
                  ? "No clubs available (upload JSON first)" 
                  : "Select a club"
            } />
          </SelectTrigger>
          <SelectContent>
            {clubs.map((club) => (
              <SelectItem key={club.id} value={club.id.toString()}>
                <div className="flex items-center justify-between w-full">
                  <span>{club.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({club.playerCount} players)
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {selectedClubId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-2">
                <Users className="w-3 h-3" />
                {selectedClubName} - {playerCount} players
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearSelection}
              className="h-8 text-xs"
            >
              Clear
            </Button>
          </div>
          
          {isLoadingPlayers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : players.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto p-2 border rounded-lg">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="p-3 bg-secondary/50 rounded-md hover:bg-secondary transition-colors cursor-pointer"
                >
                  <p className="text-sm font-medium text-center truncate" title={player.name}>
                    {player.name}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No players found for this club
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RosterInput;
