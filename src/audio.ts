import playSound from 'play-sound';

const PLAYERS = ['mpv', 'ffplay', 'mplayer', 'afplay', 'cvlc'] as never;

const player = playSound({ players: PLAYERS });

export function playFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    player.play(filePath, (error) => {
      if (error) reject(new Error(`Failed to play audio with ${player.player}: ${error.message}`));
      else resolve();
    });
  });
}
