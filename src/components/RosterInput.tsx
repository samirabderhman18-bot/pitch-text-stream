import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const RosterInput = () => {
  const [isUploadingJson, setIsUploadingJson] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const { toast } = useToast();

  const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingJson(true);
    setUploadSuccess(false);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      // Handle different JSON structures
      let players = [];
      
      if (Array.isArray(jsonData)) {
        players = jsonData;
      } else if (jsonData.players && Array.isArray(jsonData.players)) {
        players = jsonData.players;
      } else if (jsonData.data && Array.isArray(jsonData.data)) {
        players = jsonData.data;
      } else {
        throw new Error('Invalid JSON format. Expected an array of players or an object with a players/data array.');
      }

      // Validate and transform player data
      const validPlayers = players.filter(player => {
        // Must have at least an id and name information
        return player.id && (player.forename || player.name || player.full_name);
      }).map(player => ({
        id: player.id,
        forename: player.forename || player.first_name || (player.name ? player.name.split(' ')[0] : '') || '',
        surname: player.surname || player.last_name || (player.name ? player.name.split(' ').slice(1).join(' ') : '') || '',
        full_name: player.full_name || player.name || `${player.forename || ''} ${player.surname || ''}`.trim(),
        number: player.number || player.jersey_number || player.shirt_number || null,
        image_url: player.image_url || player.photo || player.image || null,
      }));

      if (validPlayers.length === 0) {
        throw new Error('No valid players found in JSON file');
      }

      // Upload to database via edge function
      const { data, error } = await supabase.functions.invoke('upload-players', {
        body: { players: validPlayers }
      });

      if (error) throw error;

      setPlayerCount(validPlayers.length);
      setUploadSuccess(true);
      
      toast({
        title: "Success",
        description: `${validPlayers.length} players uploaded successfully`,
      });

      // Reset file input
      event.target.value = '';
      
    } catch (error) {
      console.error('Error uploading JSON:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload player data",
        variant: "destructive",
      });
      setUploadSuccess(false);
    } finally {
      setIsUploadingJson(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="file"
            accept=".json"
            onChange={handleJsonUpload}
            className="hidden"
            id="json-upload"
            disabled={isUploadingJson}
          />
          <label htmlFor="json-upload">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploadingJson}
              className="cursor-pointer"
              asChild
            >
              <span>
                {isUploadingJson ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload JSON
                  </>
                )}
              </span>
            </Button>
          </label>
        </div>
        
        {uploadSuccess && (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Badge variant="secondary">
              {playerCount} players loaded
            </Badge>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>JSON format: Array of player objects with fields:</p>
        <ul className="list-disc list-inside ml-2">
          <li><code>id</code> (required)</li>
          <li><code>forename</code> and <code>surname</code> (or <code>name</code>)</li>
          <li><code>number</code> - Jersey/shirt number (recommended for number-based detection)</li>
          <li><code>image_url</code> (optional)</li>
        </ul>
      </div>
    </div>
  );
};

export default RosterInput;
