import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Search, Users } from 'lucide-react';
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
  roster: string[];
  onRosterChange: (roster: string[]) => void;
}

const RosterInput = ({ roster, onRosterChange }: RosterInputProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const searchTeams = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-team-roster', {
        body: { action: 'search-teams', query: searchQuery },
      });

      if (error) throw error;

      if (data.response && data.response.length > 0) {
        setTeams(data.response.map((item: any) => ({
          id: item.team.id,
          name: item.team.name,
          logo: item.team.logo,
          country: item.team.country,
        })));
        setOpen(true);
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

  const loadTeamPlayers = async (teamId: number, teamName: string) => {
    setIsLoadingPlayers(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-team-roster', {
        body: { action: 'get-players', teamId },
      });

      if (error) throw error;

      if (data.response && data.response.length > 0) {
        const playerNames = data.response.map((item: any) => 
          `${item.player.firstname} ${item.player.lastname}`
        );
        onRosterChange(playerNames);
        toast({
          title: "Roster loaded",
          description: `Loaded ${playerNames.length} players from ${teamName}`,
        });
        setOpen(false);
      } else {
        toast({
          title: "No players found",
          description: "This team has no players in the database for the current season",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading players:', error);
      toast({
        title: "Error",
        description: "Failed to load team roster. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const removePlayer = (player: string) => {
    onRosterChange(roster.filter(p => p !== player));
  };

  const clearRoster = () => {
    onRosterChange([]);
  };

  return (
    <div className="space-y-4">
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
                      onSelect={() => loadTeamPlayers(team.id, team.name)}
                      disabled={isLoadingPlayers}
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
      
      {roster.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{roster.length} players</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearRoster}
              className="h-8 text-xs"
            >
              Clear All
            </Button>
          </div>
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
        </div>
      )}
    </div>
  );
};

export default RosterInput;
