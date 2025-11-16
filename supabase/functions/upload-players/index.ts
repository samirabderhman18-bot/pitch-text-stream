import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { players: playerData } = await req.json();

    if (!playerData || !Array.isArray(playerData)) {
      throw new Error('Invalid player data format');
    }

    console.log(`Processing ${playerData.length} players...`);

    // Generate random numbers for players without numbers
    const usedNumbers = new Set<number>();
    
    const players = playerData.map((player: any) => {
      let number = player.number || player.jersey_number || player.shirt_number;
      
      // Generate random number if not provided
      if (!number) {
        do {
          number = Math.floor(Math.random() * 99) + 1; // 1-99
        } while (usedNumbers.has(number));
      }
      
      usedNumbers.add(number);
      
      return {
        id: player.id,
        forename: player.forename || player.first_name || (player.name ? player.name.split(' ')[0] : '') || '',
        surname: player.surname || player.last_name || (player.name ? player.name.split(' ').slice(1).join(' ') : '') || '',
        full_name: player.full_name || player.name || `${player.forename || ''} ${player.surname || ''}`.trim(),
        number: number,
        image_url: player.image_url || player.photo || player.image || null,
      };
    });

    // Use upsert to handle duplicates
    const { data, error } = await supabaseClient
      .from('players')
      .upsert(players, { onConflict: 'id' });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log(`Successfully uploaded ${players.length} players`);

    return new Response(
      JSON.stringify({
        success: true,
        count: players.length,
        message: `Successfully uploaded ${players.length} players`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});