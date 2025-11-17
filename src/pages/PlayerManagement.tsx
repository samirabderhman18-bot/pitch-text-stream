import { useEffect } from 'react';
import PlayerManagementTable from '@/components/PlayerManagementTable';
import { usePlayers } from '@/hooks/usePlayers';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PlayerManagement = () => {
  const { players, fetchAllPlayers } = usePlayers();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllPlayers();
  }, [fetchAllPlayers]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-pitch-green/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Player Management</h1>
        </div>
        
        <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
          <PlayerManagementTable
            players={players}
            onPlayersUpdate={fetchAllPlayers}
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerManagement;
