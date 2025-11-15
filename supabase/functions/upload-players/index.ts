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

    const { playerData } = await req.json();

    if (!playerData || !Array.isArray(playerData)) {
      throw new Error('Invalid player data format');
    }

    console.log(`Processing ${playerData.length} players...`);

    // Transform the data to match our schema
    const players = playerData.map((player: any) => ({
      id: player.ID,
      forename: player.Forename,
      surname: player.Surname,
      image_url: player.ImageURL,
    }));

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