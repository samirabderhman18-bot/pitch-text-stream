import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Configuration thresholds
const SHORT_AUDIO_THRESHOLD = 30000; // 30 seconds in ms
const MAX_RETRIES = 3;
const POLL_INTERVAL = 2000; // 2 seconds

interface TranscriptionRequest {
  audioData: string;
  languageCode?: string;
  roster?: string[];
  audioDuration?: number;
  needsSpeakerLabels?: boolean;
  webhookUrl?: string;
}

interface TranscriptionResult {
  text: string;
  enhanced?: string;
  speakers?: any[];
  service: string;
  processingTime: number;
}

// Service selector based on requirements
function selectTranscriptionService(req: TranscriptionRequest): 'huggingface' | 'assemblyai' {
  // Always use AssemblyAI as it's more reliable
  // HuggingFace Whisper endpoint has been deprecated
  return 'assemblyai';
}

// HuggingFace Whisper transcription
async function transcribeWithHuggingFace(audioData: string): Promise<string> {
  const token = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
  if (!token) throw new Error('HuggingFace token not configured');

  console.log('Transcribing with HuggingFace Whisper...');
  const audioBuffer = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));

  const response = await fetch(
    'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: audioBuffer,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HuggingFace API error: ${error}`);
  }

  const result = await response.json();
  return result.text || '';
}

// Process base64 in chunks to prevent memory issues and maintain audio integrity
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// AssemblyAI transcription with polling
async function transcribeWithAssemblyAI(
  audioData: string, 
  languageCode: string,
  needsSpeakerLabels: boolean
): Promise<{ text: string; speakers?: any[] }> {
  const apiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
  if (!apiKey) throw new Error('AssemblyAI API key not configured');

  console.log('Uploading to AssemblyAI...');
  
  // Process audio data in chunks for better memory handling
  const audioBytes = processBase64Chunks(audioData);
  
  // Create a Blob with the correct MIME type for AssemblyAI
  const audioBlob = new Blob([audioBytes.buffer as ArrayBuffer], { type: 'audio/webm; codecs=opus' });
  
  // Upload audio
  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'authorization': apiKey,
    },
    body: audioBlob,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Upload failed: ${errorText}`);
  }

  const { upload_url } = await uploadResponse.json();
  console.log('Audio uploaded, creating transcript...');

  // Create transcription
  const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'authorization': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: upload_url,
      speaker_labels: needsSpeakerLabels,
      language_code: languageCode,
    }),
  });

  const transcript = await transcriptResponse.json();
  
  if (transcript.error) {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
  }
  
  const transcriptId = transcript.id;
  console.log('Transcript created:', transcriptId);

  // Poll for completion
  let attempts = 0;
  while (attempts < MAX_RETRIES * 10) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    
    const statusResponse = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: { 'authorization': apiKey },
      }
    );

    const status = await statusResponse.json();
    
    if (status.status === 'completed') {
      console.log('Transcription completed');
      return {
        text: status.text || '',
        speakers: status.utterances || undefined,
      };
    } else if (status.status === 'error') {
      throw new Error(`AssemblyAI transcription failed: ${status.error}`);
    }
    
    attempts++;
  }
  
  throw new Error('Transcription timeout');
}

// Enhance transcription with Gemini AI
async function enhanceWithGemini(
  text: string, 
  roster: string[] = [], 
  language: string = 'en'
): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    console.warn('Gemini API key not configured, skipping enhancement');
    return text;
  }

  console.log('Enhancing with Gemini AI...');

  const rosterContext = roster.length > 0 
    ? `\n\nTeam Roster: ${roster.join(', ')}`
    : '';

  const systemPrompt = language === 'ar'
    ? `أنت مساعد متخصص في تصحيح نصوص تعليقات كرة القدم. قم بتصحيح الأخطاء في أسماء اللاعبين والمصطلحات الكروية. احتفظ بجميع المعلومات الأصلية ولكن صحح الأخطاء فقط.${rosterContext}`
    : `You are a soccer commentary correction assistant. Fix any errors in player names and soccer terminology. Keep all original information but correct mistakes only.${rosterContext}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
    console.warn('Gemini enhancement failed:', error);
    return text; // Return original if enhancement fails
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

// Main coordinator function
async function processTranscription(req: TranscriptionRequest): Promise<TranscriptionResult> {
  const startTime = Date.now();
  const service = selectTranscriptionService(req);
  const languageCode = req.languageCode || 'en';
  
  console.log(`Selected service: ${service}`);
  
  let transcriptionText: string;
  let speakers: any[] | undefined;

  // Step 1: Transcribe
  if (service === 'huggingface') {
    transcriptionText = await transcribeWithHuggingFace(req.audioData);
  } else {
    const result = await transcribeWithAssemblyAI(
      req.audioData,
      languageCode,
      req.needsSpeakerLabels || false
    );
    transcriptionText = result.text;
    speakers = result.speakers;
  }

  // Step 2: Enhance with Gemini (optional but recommended)
  const enhancedText = await enhanceWithGemini(
    transcriptionText,
    req.roster,
    languageCode
  );

  const processingTime = Date.now() - startTime;

  return {
    text: transcriptionText,
    enhanced: enhancedText,
    speakers,
    service,
    processingTime,
  };
}

// HTTP handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: TranscriptionRequest = await req.json();

    // Validate required fields
    if (!requestData.audioData) {
      throw new Error('audioData is required');
    }

    console.log('Processing transcription request...');
    const result = await processTranscription(requestData);

    console.log(`Transcription completed in ${result.processingTime}ms using ${result.service}`);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
