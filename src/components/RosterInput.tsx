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
        .order('name', { ascending: true });

      if (clubsError) {
        console.error('Error loading clubs:', clubsError);
        throw clubsError;
      }

      if (clubsData && clubsData.length > 0) {
        // Get player count for each club
        const clubsWithCounts = await Promise.all(
          clubsData.map(async (club) => {
            const { count, error } = await supabase
              .from('players')
              .select('*', { count: 'exact', head: true })
              .eq('club_id', club.id);

            if (error) {
              console.error(`Error counting players for club ${club.id}:`, error);
            }

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
      setClubs([]);
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
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading players:', error);
        throw error;
      }

      setPlayers(playersData || []);
    } catch (error) {
      console.error('Error loading players:', error);
      toast({
        title: "Error",
        description: "Failed to load players. Please try again.",
        variant: "destructive",
      });
      setPlayers([]);
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 max-h-[500px] overflow-y-auto p-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-2 hover:scale-105 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-lg border border-blue-200/50 dark:border-blue-800/50"
                >
                  {/* Position Badge - Top Right */}
                  {player.position && (
                    <div className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                      {player.position}
                    </div>
                  )}
                  
                  {/* Avatar Circle - Smaller */}
                  <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {player.name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase()}
                  </div>
                  
                  {/* Player Name - Compact */}
                  <p className="text-[10px] font-semibold text-center leading-tight line-clamp-2 mb-1 h-6" title={player.name}>
                    {player.name}
                  </p>
                  
                  {/* Rating Badge - Centered */}
                  {player.overall_rating && (
                    <div className="flex justify-center">
                      <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                        {player.overall_rating}
                      </span>
                    </div>
                  )}
                  
                  {/* Shine Effect on Hover */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
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
