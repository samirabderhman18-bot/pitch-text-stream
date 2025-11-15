import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Team {
  id: number;
  name: string;
  logo: string;
  country: string;
}

interface RosterInputProps {
  selectedClubId: number | null;
  onClubSelected: (clubId: number | null) => void;
}

const RosterInput = ({ selectedClubId, onClubSelected }: RosterInputProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploadingJson, setIsUploadingJson] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedTeamName, setSelectedTeamName] = useState('');
  const [playerCount, setPlayerCount] = useState(0);
  const { toast } = useToast();

  const searchTeams = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      // Search teams in the database by club_id or name
      // First, let's get unique club_ids from players table
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('club_id')
        .not('club_id', 'is', null);

      if (playerError) throw playerError;

      // Get unique club_ids
      const uniqueClubIds = [...new Set(playerData?.map(p => p.club_id) || [])];

      if (uniqueClubIds.length === 0) {
        toast({
          title: "No teams found",
          description: "No teams in the database yet. Upload players first.",
          variant: "destructive",
        });
        setIsSearching(false);
        return;
      }

      // Now search for these teams in the API
      const { data: apiData, error: apiError } = await supabase.functions.invoke('fetch-team-roster', {
        body: { action: 'search-teams', query: searchQuery },
      });

      if (apiError) throw apiError;

      if (apiData.response && apiData.response.length > 0) {
        // Filter teams that exist in our database (have players with matching club_id)
        const teamsWithPlayers = apiData.response.filter((item: any) => 
          uniqueClubIds.includes(item.team.id)
        );

        if (teamsWithPlayers.length > 0) {
          setTeams(teamsWithPlayers.map((item: any) => ({
            id: item.team.id,
            name: item.team.name,
            logo: item.team.logo,
            country: item.team.country,
          })));
          setOpen(true);
        } else {
          toast({
            title: "No teams found",
            description: "No teams with players in the database match your search",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "No teams found",
          description: "Try a different search term",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error searching teams:', error);
      toast({
        title: "Error",
        description: "Failed to search teams. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const selectTeam = async (teamId: number, teamName: string) => {
    try {
      // Get player count for this team
      const { data, error } = await supabase
        .from('players')
        .select('id', { count: 'exact' })
        .eq('club_id', teamId);

      if (error) throw error;

      const count = data?.length || 0;
      
      onClubSelected(teamId);
      setSelectedTeamName(teamName);
      setPlayerCount(count);
      setOpen(false);
      
      toast({
        title: "Team selected",
        description: `${teamName} - ${count} players available`,
      });
    } catch (error) {
      console.error('Error selecting team:', error);
      toast({
        title: "Error",
        description: "Failed to select team. Please try again.",
        variant: "destructive",
      });
    }
  };

  const clearSelection = () => {
    onClubSelected(null);
    setSelectedTeamName('');
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
      
      <div className="flex gap-2">
        <Input
          placeholder="Search for a team..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchTeams()}
          className="flex-1"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button 
              onClick={searchTeams} 
              disabled={isSearching || !searchQuery.trim()}
              className="gap-2"
            >
              <Search className="w-4 h-4" />
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Filter teams..." />
              <CommandList>
                <CommandEmpty>No teams found.</CommandEmpty>
                <CommandGroup heading="Select a team">
                  {teams.map((team) => (
                    <CommandItem
                      key={team.id}
                      onSelect={() => selectTeam(team.id, team.name)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain" />
                        <div className="flex-1">
                          <div className="font-medium">{team.name}</div>
                          <div className="text-xs text-muted-foreground">{team.country}</div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      {selectedClubId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-2">
                <Users className="w-3 h-3" />
                {selectedTeamName} - {playerCount} players
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
