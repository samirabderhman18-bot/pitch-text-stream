import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { text, roster, language } = await req.json();
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Enhancing transcription with Gemini AI');

    // Fetch players from database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: dbPlayers } = await supabaseClient
      .from('players')
      .select('forename, surname, full_name');

    const allPlayers = dbPlayers ? dbPlayers.map(p => p.full_name) : [];
    const combinedRoster = roster && roster.length > 0 ? [...new Set([...roster, ...allPlayers])] : allPlayers;
    
    console.log(`Total players available: ${combinedRoster.length}`);

    const rosterContext = combinedRoster.length > 0 
      ? `\n\nTeam Roster: ${combinedRoster.slice(0, 100).join(', ')}`
      : '';

    const systemPrompt = language === 'ar'
      ? `أنت مساعد متخصص في تصحيح نصوص تعليقات كرة القدم. قم بتصحيح الأخطاء في أسماء اللاعبين والمصطلحات الكروية. احتفظ بجميع المعلومات الأصلية ولكن صحح الأخطاء فقط.${rosterContext}`
      : `You are a soccer commentary correction assistant. Fix any errors in player names and soccer terminology. Keep all original information but correct mistakes only.${rosterContext}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Correct this transcription: "${text}"` }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${error}`);
    }

    const result = await response.json();
    const enhancedText = result.choices[0].message.content;

    console.log('Enhancement completed');

    return new Response(
      JSON.stringify({ text: enhancedText }),
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
