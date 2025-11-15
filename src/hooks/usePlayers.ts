import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Player {
  id: number;
  forename: string;
  surname: string;
  full_name: string;
  image_url: string | null;
}

export const usePlayers = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('surname', { ascending: true });

      if (error) throw error;
      setPlayers(data || []);
    } catch (err) {
      console.error('Error fetching players:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch players');
    } finally {
      setIsLoading(false);
    }
  };

  const searchPlayers = (query: string): Player[] => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return players.filter(p => 
      p.full_name.toLowerCase().includes(lowerQuery) ||
      p.forename.toLowerCase().includes(lowerQuery) ||
      p.surname.toLowerCase().includes(lowerQuery)
    );
  };

  return { players, isLoading, error, searchPlayers, refetch: fetchPlayers };
};