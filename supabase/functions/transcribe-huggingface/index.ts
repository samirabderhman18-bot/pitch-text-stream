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
    const { audioData, languageCode = 'en' } = await req.json();
    const huggingFaceToken = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');

    if (!huggingFaceToken) {
      throw new Error('HuggingFace API token not configured');
    }

    console.log(`Starting HuggingFace transcription for language: ${languageCode}`);

    // Convert base64 to binary
    const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));

    // Call HuggingFace Whisper API
    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${huggingFaceToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: audioBuffer,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('HuggingFace API error:', error);
      throw new Error(`HuggingFace API error: ${error}`);
    }

    const result = await response.json();
    console.log('Transcription completed:', result);

    return new Response(
      JSON.stringify({ text: result.text || '' }),
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
