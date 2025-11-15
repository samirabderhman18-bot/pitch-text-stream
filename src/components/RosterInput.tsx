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
  logo_url: string;
}

// Props for the component - now accepts selectedClubId instead of roster
interface RosterInputProps {
  selectedClubId: number | null;
  onClubSelected: (clubId: number | null) => void;
}

const RosterInput = ({ selectedClubId, onClubSelected }: RosterInputProps) => {
  // State for the club list
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isClubsLoading, setIsClubsLoading] = useState(true);
  const [playerCount, setPlayerCount] = useState<number>(0);
  
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
          .from('teams')
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
  }, [toast]);

  // Effect to load player count when club is selected
  useEffect(() => {
    const loadPlayerCount = async () => {
      if (!selectedClubId) {
        setPlayerCount(0);
        return;
      }

      setIsLoadingPlayers(true);
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', selectedClubId);

        if (error) throw error;

        const count = data?.length || 0;
        setPlayerCount(count);
        
        if (count === 0) {
          toast({
            title: "No players found",
            description: "This club has no players associated with it in the database.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error loading player count:', error);
        toast({
          title: "Error",
          description: "Failed to load player count. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingPlayers(false);
      }
    };

    loadPlayerCount();
  }, [selectedClubId, toast]);

  /**
   * Handles the selection of a club from the dropdown.
   */
  const handleClubSelect = (club: Club) => {
    onClubSelected(club.id);
    setIsPopoverOpen(false);
    toast({
      title: "Club Selected",
      description: `Selected ${club.name}. Loading player roster...`,
    });
  };
  
  /**
   * Handles the upload of a player data JSON file.
   */
  const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingJson(true);
    
    toast({
      title: 'Uploading...',
      description: 'Reading JSON file and preparing data...',
    });

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Validate JSON structure
      if (!jsonData.PlayerData || !Array.isArray(jsonData.PlayerData)) {
        throw new Error('Invalid JSON format. Expected a root object with a "PlayerData" array.');
      }

      toast({
        title: 'Processing...',
        description: `Uploading ${jsonData.PlayerData.length} players to database...`,
      });

      // Call edge function to process and insert data
      const { data, error } = await supabase.functions.invoke('upload-players', {
        body: { playerData: jsonData.PlayerData }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to upload players to database');
      }

      // Success feedback
      toast({
        title: 'Upload Successful! ✓',
        description: `${data.playersInserted || data.count || jsonData.PlayerData.length} players and their teams have been saved to the database.`,
      });
      
      // Refresh clubs list to show newly added teams
      toast({
        title: 'Refreshing...',
        description: 'Loading updated club list...',
      });

      const { data: clubsData, error: clubsError } = await supabase
        .from('teams')
        .select('id, name, logo_url')
        .order('name', { ascending: true });

      if (clubsError) {
        console.error('Error refreshing clubs:', clubsError);
      } else if (clubsData) {
        setClubs(clubsData);
        toast({
          title: 'Ready!',
          description: `Club list updated. ${clubsData.length} clubs available.`,
        });
      }
      
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
   * Clears the current club selection.
   */
  const clearSelection = () => {
    onClubSelected(null);
    setPlayerCount(0);
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
      
      {/* Club & Player Information Display */}
      {selectedClubId && (
        <div className="p-3 border rounded-md bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="w-4 h-4" />
              <span>
                {isLoadingPlayers ? (
                  <>
                    <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
                    Loading players...
                  </>
                ) : (
                  `${playerCount} Player${playerCount !== 1 ? 's' : ''} in Roster`
                )}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearSelection}
              className="h-7 text-xs px-2"
            >
              <X className="mr-1 h-3 w-3" />
              Clear Selection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RosterInput;
