import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Users, Upload, Loader2, ChevronsUpDown } from 'lucide-react';
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

// This interface now represents a club/team from your database
interface Club {
  id: number;
  name: string;
  logo_url: string; // Assuming 'logo_url' is the column name in your DB
}

// Props for the component, allowing it to manage a roster state in a parent component.
interface RosterInputProps {
  roster: string[]; // Expects an array of player IDs.
  onRosterChange: (roster: string[]) => void;
}

const RosterInput = ({ roster, onRosterChange }: RosterInputProps) => {
  // State for the club list and selection
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [isClubsLoading, setIsClubsLoading] = useState(true);
  
  // State for component interactions
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isUploadingJson, setIsUploadingJson] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { toast } = useToast();

  // Effect to fetch all clubs when the component mounts
  useEffect(() => {
    const fetchAllClubs = async () => {
      setIsClubsLoading(true);
      try {
        const { data, error } = await supabase
          .from('teams') // Make sure this matches your table name for clubs/teams
          .select('id, name, logo_url')
          .order('name', { ascending: true });

        if (error) throw error;
        
        setClubs(data || []);
      } catch (error) {
        console.error("Error fetching clubs:", error);
        toast({
          title: "Failed to fetch clubs",
          description: "Could not load the list of clubs from the database.",
          variant: "destructive",
        });
      } finally {
        setIsClubsLoading(false);
      }
    };

    fetchAllClubs();
  }, [toast]); // Added toast to dependency array as it's used inside the effect

  /**
   * Loads players for a specific team and updates the roster.
   * @param teamId The ID of the team to load players for.
   */
  const loadTeamPlayers = async (teamId: number) => {
    setIsLoadingPlayers(true);
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id')
        .eq('team_id', teamId);

      if (error) throw error;

      if (data && data.length > 0) {
        const playerIds = data.map((player) => player.id.toString());
        onRosterChange(playerIds);
        toast({
          title: "Roster Loaded",
          description: `Loaded ${playerIds.length} players.`,
        });
      } else {
        onRosterChange([]); // Clear roster if no players are found
        toast({
          title: "No players found",
          description: "This club has no players associated with it in the database.",
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
   * Handles the selection of a club from the dropdown.
   * @param club The selected club object.
   */
  const handleClubSelect = (club: Club) => {
    setSelectedClubId(club.id);
    loadTeamPlayers(club.id);
    setIsPopoverOpen(false);
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
      
      if (!jsonData.PlayerData || !Array.isArray(jsonData.PlayerData)) {
        throw new Error('Invalid JSON format. Expected a root object with a "PlayerData" array.');
      }

      const { data, error } = await supabase.functions.invoke('upload-players', {
        body: { playerData: jsonData.PlayerData }
      });

      if (error) throw error;

      toast({
        title: 'Upload Successful',
        description: `Successfully processed ${data.count} players. You can now select a club to load their roster.`,
      });
      
    } catch (error) {
      console.error('JSON upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Could not process the JSON file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingJson(false);
      event.target.value = '';
    }
  };
  
  /**
   * Clears the current roster and resets the club selection.
   */
  const clearRoster = () => {
    onRosterChange([]);
    setSelectedClubId(null);
  };

  const selectedClubName = clubs.find(c => c.id === selectedClubId)?.name || "Select a club...";

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
      
      {/* Club Selector Combobox */}
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isPopoverOpen}
            className="w-full justify-between"
            disabled={isClubsLoading || isLoadingPlayers}
          >
            {isClubsLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              selectedClubName
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0">
          <Command>
            <CommandInput placeholder="Search clubs..." />
            <CommandList>
              {isClubsLoading && (
                <div className="p-4 text-sm text-center">Loading clubs...</div>
              )}
              <CommandEmpty>No clubs found.</CommandEmpty>
              <CommandGroup>
                {clubs.map((club) => (
                  <CommandItem
                    key={club.id}
                    value={club.name}
                    onSelect={() => handleClubSelect(club)}
                    className="cursor-pointer"
                  >
                    <img src={club.logo_url} alt="" className="w-6 h-6 mr-3 object-contain" />
                    <span>{club.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
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
              onClick={clearRoster}
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
