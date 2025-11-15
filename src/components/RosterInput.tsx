import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Search, Users, Upload, Loader2 } from 'lucide-react';
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

// Interface for the team data returned by the search function.
interface Team {
  id: number;
  name: string;
  logo: string;
  country: string;
}

// Props for the component, allowing it to manage a roster state in a parent component.
interface RosterInputProps {
  roster: string[]; // Expects an array of player IDs.
  onRosterChange: (roster: string[]) => void;
}

const RosterInput = ({ roster, onRosterChange }: RosterInputProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isUploadingJson, setIsUploadingJson] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { toast } = useToast();

  /**
   * Searches for teams by invoking a Supabase Edge Function.
   */
  const searchTeams = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-team-roster', {
        body: { action: 'search-teams', query: searchQuery },
      });

      if (error) throw error;

      if (data?.response?.length > 0) {
        setTeams(data.response.map((item: any) => item.team));
        setIsPopoverOpen(true); // Open the popover to show results.
      } else {
        toast({
          title: "No teams found",
          description: "Please try a different search query.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error searching teams:', error);
      toast({
        title: "Search Failed",
        description: "Could not fetch teams. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Loads players for a specific team and updates the roster.
   * @param teamId The ID of the team to load players for.
   * @param teamName The name of the team, used for notifications.
   */
  const loadTeamPlayers = async (teamId: number, teamName: string) => {
    setIsLoadingPlayers(true);
    try {
      // CRITICAL FIX: This query now filters players by the selected team's ID.
      // This assumes your 'players' table has a 'team_id' column that links a player to a team.
      const { data, error } = await supabase
        .from('players')
        .select('id') // Only select the 'id' as that's all we need for the roster.
        .eq('team_id', teamId); // Filter by the teamId.

      if (error) throw error;

      if (data && data.length > 0) {
        const playerIds = data.map((player) => player.id.toString());
        onRosterChange(playerIds);
        toast({
          title: "Roster Loaded",
          description: `Loaded ${playerIds.length} players for ${teamName}.`,
        });
        setIsPopoverOpen(false); // Close popover on successful selection.
      } else {
        toast({
          title: "No players found",
          description: `There are no players associated with ${teamName} in the database.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading players:', error);
      toast({
        title: "Error",
        description: "Failed to load the team roster. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  /**
   * Handles the upload of a player data JSON file.
   */
  const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingJson(true);
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Validate the structure of the JSON file.
      if (!jsonData.PlayerData || !Array.isArray(jsonData.PlayerData)) {
        throw new Error('Invalid JSON format. Expected a root object with a "PlayerData" array.');
      }

      // Invoke a Supabase function to handle the database insertion.
      // This function is responsible for transforming data keys (e.g., 'ID' -> 'id').
      const { data, error } = await supabase.functions.invoke('upload-players', {
        body: { playerData: jsonData.PlayerData }
      });

      if (error) throw error;

      toast({
        title: 'Upload Successful',
        description: `Successfully processed and uploaded ${data.count} players.`,
      });
      
      // NOTE: Roster is not automatically changed. The user must now search for a team
      // to load the newly uploaded players into the roster.

    } catch (error) {
      console.error('JSON upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Could not process the JSON file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingJson(false);
      // Reset the file input so the user can upload the same file again if needed.
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* File Upload Button */}
        <Button
          type="button"
          variant="outline"
          disabled={isUploadingJson}
          onClick={() => document.getElementById('json-upload')?.click()}
          className="w-full sm:w-auto"
        >
          {isUploadingJson ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Player JSON
            </>
          )}
        </Button>
        <input
          id="json-upload"
          type="file"
          accept=".json"
          onChange={handleJsonUpload}
          className="hidden"
        />
      </div>
      
      {/* Team Search Input and Popover */}
      <div className="flex gap-2">
        <Input
          placeholder="Search for a team to load roster..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchTeams()}
          className="flex-1"
        />
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button 
              onClick={searchTeams} 
              disabled={isSearching || !searchQuery.trim()}
            >
              <Search className="mr-2 h-4 w-4" />
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Filter found teams..." />
              <CommandList>
                <CommandEmpty>No teams found.</CommandEmpty>
                <CommandGroup heading="Select a Team">
                  {teams.map((team) => (
                    <CommandItem
                      key={team.id}
                      onSelect={() => loadTeamPlayers(team.id, team.name)}
                      disabled={isLoadingPlayers}
                      className="cursor-pointer"
                    >
                      {isLoadingPlayers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <img src={team.logo} alt="" className="w-6 h-6 mr-3 object-contain" />
                      <span>{team.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{team.country}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Roster Information Display */}
      {roster.length > 0 && (
        <div className="p-3 border rounded-md bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="w-4 h-4" />
              <span>{roster.length} Players in Roster</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onRosterChange([])}
              className="h-7 text-xs px-2"
            >
              <X className="mr-1 h-3 w-3" />
              Clear Roster
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterInput;
