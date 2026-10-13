import React, { createContext, useContext, useEffect, useState } from 'react';
import { AudioPlaybackState } from '../../types/audio';
import { RadioStation } from '../../types/station';
import { audioPlaybackEngine } from './AudioPlaybackEngine';

interface AudioContextValue extends AudioPlaybackState {
  playStation: (station: RadioStation) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  stop: () => Promise<void>;
}

const AudioPlayerContext = createContext<AudioContextValue | null>(null);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AudioPlaybackState>(audioPlaybackEngine.getState());

  useEffect(() => {
    const unsubscribe = audioPlaybackEngine.subscribe((updated) => {
      setState(updated);
    });
    return unsubscribe;
  }, []);

  const value: AudioContextValue = {
    ...state,
    playStation: (station: RadioStation) => audioPlaybackEngine.playStation(station),
    pause: () => audioPlaybackEngine.pause(),
    resume: () => audioPlaybackEngine.resume(),
    togglePlayPause: () => audioPlaybackEngine.togglePlayPause(),
    setVolume: (volume: number) => audioPlaybackEngine.setVolume(volume),
    toggleMute: () => audioPlaybackEngine.toggleMute(),
    stop: () => audioPlaybackEngine.stopAndUnload(),
  };

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
};

export function useAudioPlayer(): AudioContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
