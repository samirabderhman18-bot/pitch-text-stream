import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, teamId, season } = await req.json();
    const apiKey = Deno.env.get('API_FOOTBALL_KEY');

    if (!apiKey) {
      throw new Error('API_FOOTBALL_KEY not configured');
    }

    const currentYear = new Date().getFullYear();
    const currentSeason = season || currentYear;

    let url = '';
    
    if (action === 'search-teams') {
      // Search for teams by name
      url = `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(query)}`;
    } else if (action === 'get-players') {
      // Get players for a specific team
      url = `https://v3.football.api-sports.io/players?team=${teamId}&season=${currentSeason}`;
    } else {
      throw new Error('Invalid action');
    }

    console.log('Fetching from API-Football:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('API-Football error:', error);
      throw new Error(`API-Football error: ${error}`);
    }

    const data = await response.json();
    
    console.log('API-Football response:', JSON.stringify(data).substring(0, 200));

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
