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
    const { audioData, languageCode = 'en' } = await req.json(); // Default to English
    const assemblyAiKey = Deno.env.get('ASSEMBLYAI_API_KEY');

    if (!assemblyAiKey) {
      throw new Error('Assembly AI API key not configured');
    }

    console.log(`Starting transcription process for language: ${languageCode}`);

    // Upload audio to Assembly AI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': assemblyAiKey,
        'content-type': 'application/octet-stream',
      },
      body: Uint8Array.from(atob(audioData), c => c.charCodeAt(0)),
    });

    const { upload_url } = await uploadResponse.json();
    console.log('Audio uploaded:', upload_url);

    // Create transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': assemblyAiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        language_code: languageCode, // Use the provided language code
      }),
    });

    const transcript = await transcriptResponse.json();
    console.log('Transcription started:', transcript.id);

    return new Response(
      JSON.stringify({ transcriptId: transcript.id }),
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
