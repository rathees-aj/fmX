import { RadioStation } from './station';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface AudioPlaybackState {
  status: PlaybackStatus;
  currentStation: RadioStation | null;
  errorMessage: string | null;
  volume: number;
  isMuted: boolean;
  bufferingProgress: number; // 0 to 1
}

export interface AudioPlaybackEngineListener {
  onStatusChange: (state: AudioPlaybackState) => void;
}
