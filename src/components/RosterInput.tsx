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
  position: string | null;
  overall_rating: number | null;
  age: number | null;
  nationality: string | null;
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
        .select('id, name, club_id, position, overall_rating, age, nationality')
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-h-[600px] overflow-y-auto p-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="group relative bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-3 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md border border-primary/10 hover:border-primary/30"
                >
                  {/* Position Badge */}
                  {player.position && (
                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {player.position}
                    </div>
                  )}
                  
                  {/* Player Avatar Circle */}
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-lg shadow-inner">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* Player Name */}
                  <p className="text-xs font-semibold text-center mb-1 line-clamp-2 min-h-[2rem]" title={player.name}>
                    {player.name}
                  </p>
                  
                  {/* Stats Row */}
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    {player.overall_rating && (
                      <span className="bg-primary/10 px-1.5 py-0.5 rounded font-medium">
                        {player.overall_rating}
                      </span>
                    )}
                    {player.age && (
                      <span className="opacity-70">{player.age}y</span>
                    )}
                  </div>
                  
                  {/* Nationality */}
                  {player.nationality && (
                    <p className="text-[10px] text-center text-muted-foreground mt-1 truncate" title={player.nationality}>
                      {player.nationality}
                    </p>
                  )}
                  
                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
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
