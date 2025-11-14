import { pipeline } from '@huggingface/transformers';

let whisperInstance: any = null;

export const initializeWhisper = async () => {
  if (whisperInstance) return whisperInstance;
  
  console.log('Initializing browser-based Whisper model...');
  whisperInstance = await pipeline(
    'automatic-speech-recognition',
    'onnx-community/whisper-tiny',
    { device: 'webgpu' }
  );
  
  return whisperInstance;
};

export const transcribeAudioBrowser = async (audioBlob: Blob): Promise<string> => {
  const whisper = await initializeWhisper();
  
  // Convert blob to array buffer
  const arrayBuffer = await audioBlob.arrayBuffer();
  
  // Transcribe
  const result = await whisper(arrayBuffer);
  
  return result.text || '';
};
