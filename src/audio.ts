import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import playSound from 'play-sound';

const PLAYERS = ['mpv', 'ffplay', 'mplayer', 'afplay', 'mpg123', 'cvlc', 'cmdmp3'] as never;
const SHELLS = ['powershell', 'pwsh'];
const MP3_KBPS = 48;

const player = playSound({ players: PLAYERS });

function windowsScript(filePath: string, fallbackDurationMs: number): string {
  const url = pathToFileURL(filePath).href.replace(/'/g, "''");

  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName presentationCore
$media = New-Object System.Windows.Media.MediaPlayer
$media.Open([uri]'${url}')
$media.Play()
$waited = 0
while (-not $media.NaturalDuration.HasTimeSpan -and $waited -lt 5000) {
  Start-Sleep -Milliseconds 100
  $waited += 100
}
if ($media.NaturalDuration.HasTimeSpan) {
  $total = $media.NaturalDuration.TimeSpan.TotalMilliseconds
  while ($media.Position.TotalMilliseconds -lt $total -and $waited -lt $total + 10000) {
    Start-Sleep -Milliseconds 100
    $waited += 100
  }
} else {
  Start-Sleep -Milliseconds ${Math.round(fallbackDurationMs)}
}
$media.Close()
`;
}

function playWithPlayer(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    player.play(filePath, (error) => {
      if (error) reject(new Error(`Failed to play audio with ${player.player}: ${error.message}`));
      else resolve();
    });
  });
}

function spawnShell(shell: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(shell, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${shell} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
    });
  });
}

async function playWithShells(filePath: string, fallbackDurationMs: number): Promise<void> {
  const args = ['-NoProfile', '-NonInteractive', '-Command', windowsScript(filePath, fallbackDurationMs)];
  let lastError: unknown;

  for (const shell of SHELLS) {
    try {
      await spawnShell(shell, args);
      return;
    } catch (error) {
      lastError = error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function playFile(filePath: string): Promise<void> {
  if (player.player) {
    await playWithPlayer(filePath);
    return;
  }

  if (process.platform === 'win32') {
    const { size } = await stat(filePath);
    await playWithShells(filePath, (size * 8) / MP3_KBPS + 1000);
    return;
  }

  throw new Error(`No audio player found. Install one of: ${(PLAYERS as unknown as string[]).join(', ')}`);
}
