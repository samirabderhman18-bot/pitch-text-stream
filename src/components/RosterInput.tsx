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

interface RosterInputProps {
  selectedClubId: number | null;
  onClubSelected: (clubId: number | null) => void;
}

const RosterInput = ({ selectedClubId, onClubSelected }: RosterInputProps) => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoadingClubs, setIsLoadingClubs] = useState(false);
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
      // Get all players with club_id
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('club_id')
        .not('club_id', 'is', null);

      if (playerError) throw playerError;

      // Count players per club
      const clubCounts = new Map<number, number>();
      playerData?.forEach(player => {
        const count = clubCounts.get(player.club_id) || 0;
        clubCounts.set(player.club_id, count + 1);
      });

      // Get unique club IDs
      const uniqueClubIds = Array.from(clubCounts.keys());

      if (uniqueClubIds.length === 0) {
        setClubs([]);
        setIsLoadingClubs(false);
        return;
      }

      // Fetch club details from API
      const { data: apiData, error: apiError } = await supabase.functions.invoke('fetch-team-roster', {
        body: { action: 'search-teams', query: '' }, // Empty query to get all
      });

      if (apiError) throw apiError;

      if (apiData.response && apiData.response.length > 0) {
        // Filter and map clubs that exist in our database
        const clubsList = apiData.response
          .filter((item: any) => uniqueClubIds.includes(item.team.id))
          .map((item: any) => ({
            id: item.team.id,
            name: item.team.name,
            playerCount: clubCounts.get(item.team.id) || 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        setClubs(clubsList);
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

  const handleClubSelect = (clubIdString: string) => {
    const clubId = parseInt(clubIdString);
    const club = clubs.find(c => c.id === clubId);
    
    if (club) {
      onClubSelected(clubId);
      setSelectedClubName(club.name);
      setPlayerCount(club.playerCount);
      
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
        <div className="space-y-2">
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
        </div>
      )}
    </div>
  );
};

export default RosterInput;
