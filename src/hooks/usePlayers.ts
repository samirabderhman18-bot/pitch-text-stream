import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * @interface Player
 * Defines the data structure for a player as used in the application.
 * Your Supabase 'players' table columns should match this structure.
 */
interface Player {
  id: number;
  name: string;
  club_id: number;
  position: string | null;
  overall_rating: number | null;
  age: number | null;
  nationality: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A custom hook to fetch and manage player data from Supabase,
 * with a primary focus on fetching players for a specific club.
 */
export const usePlayers = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches all players associated with a specific club ID.
   * If the clubId is null, it clears the player list.
   * @param clubId The ID of the club/team to fetch players for.
   */
  const fetchPlayersByClubId = useCallback(async (clubId: number | null) => {
    // If no club is selected, clear the list and do nothing else.
    if (clubId === null) {
      setPlayers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all players where the 'club_id' column matches the provided clubId.
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('club_id', clubId)
        .order('name', { ascending: true });

      if (error) throw error;
      
      setPlayers(data || []);
    } catch (err) {
      console.error('Error fetching players by club ID:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch the club roster.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetches ALL players from the database.
   * Use this for pages that might need a full player directory.
   */
  const fetchAllPlayers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      setPlayers(data || []);
    } catch (err) {
      console.error('Error fetching all players:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch players.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Performs a client-side search on the currently loaded players.
   * @param query The search string.
   */
  const searchPlayers = (query: string): Player[] => {
    if (!query) return players;
    const lowerQuery = query.toLowerCase();
    return players.filter(player =>
      player.name.toLowerCase().includes(lowerQuery)
    );
  };

  return {
    players,
    isLoading,
    error,
    fetchPlayersByClubId, // The primary function for this use case
    fetchAllPlayers,
    searchPlayers,
  };
};
