import { EdgeTTS } from 'edge-tts-universal';
import { config } from './config';

export async function synthesize(text: string): Promise<Buffer> {
  const tts = new EdgeTTS(text, config.ttsVoice, { rate: config.ttsRate });
  const result = await tts.synthesize();

  return Buffer.from(await result.audio.arrayBuffer());
}
