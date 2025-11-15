import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * @interface Player
 * Defines the data structure for a player as used in the application.
 * IMPORTANT: Your Supabase 'players' table columns should match this structure
 * (e.g., 'id', 'forename', 'surname', 'full_name', 'image_url').
 * The transformation from the JSON's PascalCase (e.g., 'Forename') to this
 * snake_case format must be handled by your 'upload-players' Supabase function.
 */
interface Player {
  id: number;
  forename: string;
  surname: string;
  full_name: string;
  image_url: string | null;
}

/**
 * Custom hook to fetch, manage, and search player data from Supabase.
 */
export const usePlayers = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  /**
   * Fetches all players from the 'players' table in Supabase.
   */
  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      setError(null); // Reset error state on new fetch

      // Select all columns and order by surname for consistent display.
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('surname', { ascending: true });

      if (error) {
        // If Supabase returns an error, throw it to be caught by the catch block.
        throw error;
      }
      
      // Set the fetched data. If data is null, default to an empty array.
      setPlayers(data || []);

    } catch (err) {
      console.error('Error fetching players:', err);
      // Set a user-friendly error message.
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching players.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Performs a client-side search on the already fetched players.
   * @param query The search string.
   * @returns A filtered array of players matching the query.
   */
  const searchPlayers = (query: string): Player[] => {
    // If there's no query, return the full list of players.
    if (!query) return players;

    const lowerQuery = query.toLowerCase();

    // Filter by checking if the query appears in the full name, forename, or surname.
    return players.filter(player => 
      player.full_name.toLowerCase().includes(lowerQuery) ||
      player.forename.toLowerCase().includes(lowerQuery) ||
      player.surname.toLowerCase().includes(lowerQuery)
    );
  };

  // Expose state and functions to the component using this hook.
  return { 
    players, 
    isLoading, 
    error, 
    searchPlayers, 
    refetch: fetchPlayers // Expose a function to allow manual refetching.
  };
};
