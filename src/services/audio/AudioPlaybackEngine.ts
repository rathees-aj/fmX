import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import { Platform } from 'react-native';
import { RadioStation } from '../../types/station';
import { AudioPlaybackState, PlaybackStatus } from '../../types/audio';
import { streamHealthTracker } from './streamHealthTracker';
import { formatStationLocation } from '../../utils/locationFormatter';

type Listener = (state: AudioPlaybackState) => void;

class AudioPlaybackEngine {
  private static instance: AudioPlaybackEngine;
  private sound: AudioPlayer | null = null;
  private htmlAudio: HTMLAudioElement | null = null;
  private hlsInstance: any = null;
  private listeners: Set<Listener> = new Set();
  private audioModeConfigured = false;
  private currentPlayRequestId = 0;
  private wasPlayingBeforeInterruption = false;

  private state: AudioPlaybackState = {
    status: 'idle',
    currentStation: null,
    errorMessage: null,
    volume: 1.0,
    isMuted: false,
    bufferingProgress: 0,
  };

  private constructor() {
    this.configureAudioMode();
    this.setupNetworkAndHardwareListeners();
  }

  static getInstance(): AudioPlaybackEngine {
    if (!AudioPlaybackEngine.instance) {
      AudioPlaybackEngine.instance = new AudioPlaybackEngine();
    }
    return AudioPlaybackEngine.instance;
  }

  private async configureAudioMode() {
    if (this.audioModeConfigured) return;
    try {
      if (Platform.OS !== 'web') {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
      }
      this.audioModeConfigured = true;
    } catch (err) {
      console.warn('[fmX Audio] Audio mode config notice:', err);
    }
  }

  private setupNetworkAndHardwareListeners() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('offline', () => {
        if (this.state.status === 'playing') {
          this.wasPlayingBeforeInterruption = true;
          this.notify({
            status: 'error',
            errorMessage: 'Network disconnected — audio stream suspended',
          });
        }
      });

      window.addEventListener('online', () => {
        if (this.wasPlayingBeforeInterruption && this.state.currentStation) {
          this.wasPlayingBeforeInterruption = false;
          this.playStation(this.state.currentStation);
        }
      });
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): AudioPlaybackState {
    return { ...this.state };
  }

  private notify(updates: Partial<AudioPlaybackState>) {
    this.state = { ...this.state, ...updates };
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (e) {
        console.error('[fmX Audio] Listener error:', e);
      }
    });
  }

  /**
   * Update Lock Screen & System Notification Media Session Controls
   */
  private updateSystemMediaMetadata(station: RadioStation | null) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      if (!station) {
        navigator.mediaSession.metadata = null;
        return;
      }

      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: station.name,
          artist: formatStationLocation(station),
          album: 'fmX Global Radio',
          artwork: [
            { src: '/icon.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon.png', sizes: '512x512', type: 'image/png' },
          ],
        });

        navigator.mediaSession.setActionHandler('play', () => this.resume());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('stop', () => this.stopAndUnload());
      } catch {}
    }
  }

  async playStation(station: RadioStation): Promise<void> {
    const requestId = ++this.currentPlayRequestId;

    // If already playing this station, do nothing
    if (this.state.currentStation?.id === station.id && this.state.status === 'playing') {
      return;
    }

    // If resuming the paused station
    if (this.state.currentStation?.id === station.id && this.state.status === 'paused') {
      return this.resume();
    }

    // Check if the URL is valid
    if (!streamHealthTracker.isValidStreamUrl(station.streamUrl)) {
      this.notify({
        status: 'error',
        currentStation: station,
        errorMessage: 'Invalid or unsupported broadcast stream URL syntax',
        bufferingProgress: 0,
      });
      return;
    }

    await this.stopAndUnload(false);

    // Verify this request is still the latest one
    if (requestId !== this.currentPlayRequestId) return;

    this.notify({
      status: 'loading',
      currentStation: station,
      errorMessage: null,
      bufferingProgress: 0.15,
    });

    this.updateSystemMediaMetadata(station);

    if (Platform.OS === 'web') {
      return this.playWebStream(station, requestId);
    }

    return this.playNativeStream(station, requestId);
  }

  private async playNativeStream(station: RadioStation, requestId: number): Promise<void> {
    try {
      await this.configureAudioMode();

      if (requestId !== this.currentPlayRequestId) return;

      if (this.sound) {
        try {
          this.sound.pause();
          this.sound.remove();
        } catch {}
        this.sound = null;
      }

      const player = createAudioPlayer(station.streamUrl, {
        updateInterval: 500,
      });

      player.volume = this.state.isMuted ? 0 : this.state.volume;

      player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        this.onPlaybackStatusUpdate(status, requestId, station);
      });

      try {
        player.setActiveForLockScreen(true, {
          title: station.name,
          artist: formatStationLocation(station),
          albumTitle: 'fmX Global Radio',
        });
      } catch (lockErr) {
        console.warn('[fmX Audio] Lock screen setup notice:', lockErr);
      }

      if (requestId !== this.currentPlayRequestId) {
        player.remove();
        return;
      }

      this.sound = player;
      player.play();
    } catch (err: any) {
      if (requestId !== this.currentPlayRequestId) return;

      console.error('[fmX Audio] Failed to connect to native stream:', err);
      streamHealthTracker.recordStreamFailure(station.streamUrl, err?.message);

      this.notify({
        status: 'error',
        errorMessage: err?.message || 'Unable to connect to live stream signal',
        bufferingProgress: 0,
      });
    }
  }

  private onPlaybackStatusUpdate = (
    status: AudioStatus,
    requestId: number,
    station: RadioStation
  ) => {
    if (requestId !== this.currentPlayRequestId) return;

    if (status.error) {
      streamHealthTracker.recordStreamFailure(station.streamUrl, status.error);
      this.notify({
        status: 'error',
        errorMessage: `Stream error: ${status.error}`,
        bufferingProgress: 0,
      });
      return;
    }

    if (status.isBuffering) {
      this.notify({
        status: 'loading',
        bufferingProgress: 0.6,
      });
    } else if (status.playing) {
      streamHealthTracker.recordStreamSuccess(station.streamUrl);
      this.notify({
        status: 'playing',
        errorMessage: null,
        bufferingProgress: 1,
      });
    } else if (status.isLoaded) {
      if (this.state.status !== 'paused' && this.state.status !== 'idle') {
        this.notify({ status: 'paused' });
      }
    }
  };

  /**
   * Web-specific resilient audio streaming with HLS.js fallback
   */
  private playWebStream(station: RadioStation, requestId: number) {
    try {
      if (this.hlsInstance) {
        this.hlsInstance.destroy();
        this.hlsInstance = null;
      }
      if (this.htmlAudio) {
        this.htmlAudio.pause();
        this.htmlAudio.src = '';
        this.htmlAudio = null;
      }

      const audio = new window.Audio();
      this.htmlAudio = audio;
      audio.preload = 'auto';
      audio.volume = this.state.isMuted ? 0 : this.state.volume;

      const isHlsStream =
        station.streamUrl.includes('.m3u8') ||
        station.streamUrl.includes('mpegurl') ||
        (station.codec === 'AAC' && station.streamUrl.includes('playlist'));

      // Shared event listeners
      audio.onwaiting = () => {
        if (requestId !== this.currentPlayRequestId) return;
        this.notify({ status: 'loading', bufferingProgress: 0.4 });
      };

      audio.onplaying = () => {
        if (requestId !== this.currentPlayRequestId) return;
        streamHealthTracker.recordStreamSuccess(station.streamUrl);
        this.notify({ status: 'playing', errorMessage: null, bufferingProgress: 1 });
      };

      audio.onpause = () => {
        if (requestId !== this.currentPlayRequestId) return;
        if (this.state.status === 'playing') {
          this.notify({ status: 'paused' });
        }
      };

      const handleDirectAudioError = () => {
        if (requestId !== this.currentPlayRequestId) return;
        const errCode = audio.error?.code;
        let detail = 'Stream unavailable or endpoint unreachable';
        if (errCode === 1) detail = 'Stream playback was aborted';
        else if (errCode === 2) detail = 'Network error: could not connect to audio server';
        else if (errCode === 3) detail = 'Audio decode error: corrupted broadcast format';
        else if (errCode === 4) detail = 'Format not supported or mixed-content blocked by browser';

        streamHealthTracker.recordStreamFailure(station.streamUrl, detail);
        this.notify({
          status: 'error',
          errorMessage: detail,
          bufferingProgress: 0,
        });
      };

      // Format-aware stream handling: Prefer Hls.js on Chromium/Edge/Firefox, native HLS on Safari
      const isSafari =
        typeof navigator !== 'undefined' &&
        /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const canNativeHls = isSafari && audio.canPlayType('application/vnd.apple.mpegurl') !== '';

      if (isHlsStream) {
        if (canNativeHls) {
          // Native Safari / Apple AVFoundation HLS playback
          audio.onerror = handleDirectAudioError;
          audio.oncanplay = () => {
            if (requestId !== this.currentPlayRequestId) return;
            audio.play().catch((err) => {
              if (requestId !== this.currentPlayRequestId) return;
              this.notify({
                status: 'error',
                errorMessage: err?.message || 'Autoplay blocked by browser policy',
              });
            });
          };
          audio.src = station.streamUrl;
          audio.load();
          return;
        }

        // Chromium, Firefox, Edge: Demux HLS via Hls.js
        let Hls: any = null;
        if (typeof window !== 'undefined' && (window as any).Hls) {
          Hls = (window as any).Hls;
        } else {
          try {
            const mod = require('hls.js');
            Hls = mod?.default || mod;
          } catch (hlsErr) {
            console.warn('[fmX Audio] Hls.js module load notice:', hlsErr);
          }
        }

        if (Hls && typeof Hls.isSupported === 'function' && Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            manifestLoadingTimeOut: 12000,
            manifestLoadingMaxRetry: 3,
          });
          this.hlsInstance = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (requestId !== this.currentPlayRequestId) return;
            audio.play().catch((err) => {
              if (requestId !== this.currentPlayRequestId) return;
              this.notify({
                status: 'error',
                errorMessage: err?.message || 'Autoplay blocked by browser policy',
              });
            });
          });

          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (data.fatal) {
              if (requestId !== this.currentPlayRequestId) return;
              let errDetail = data.details || 'HLS transmission failure';
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                errDetail = 'Network error or CORS restriction on stream segments';
                hls.startLoad();
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                errDetail = 'Media decode error on stream track';
                hls.recoverMediaError();
              } else {
                streamHealthTracker.recordStreamFailure(station.streamUrl, errDetail);
                this.notify({
                  status: 'error',
                  errorMessage: `Stream error: ${errDetail}`,
                  bufferingProgress: 0,
                });
                hls.destroy();
                this.hlsInstance = null;
              }
            }
          });

          hls.loadSource(station.streamUrl);
          hls.attachMedia(audio);
          return;
        } else {
          // Explicit truthful explanation if HLS is unsupported in this environment
          this.notify({
            status: 'error',
            errorMessage: 'HLS stream requires browser MediaSource extension or native HLS support',
            bufferingProgress: 0,
          });
          return;
        }
      }

      // Direct MP3, AAC, or OGG stream playback
      audio.onerror = handleDirectAudioError;
      audio.oncanplay = () => {
        if (requestId !== this.currentPlayRequestId) return;
        audio.play().catch((err) => {
          if (requestId !== this.currentPlayRequestId) return;
          this.notify({
            status: 'error',
            errorMessage: err?.message || 'Autoplay blocked by browser policy',
          });
        });
      };

      audio.src = station.streamUrl;
      audio.load();
    } catch (err: any) {
      if (requestId !== this.currentPlayRequestId) return;
      streamHealthTracker.recordStreamFailure(station.streamUrl, err?.message);
      this.notify({
        status: 'error',
        errorMessage: err?.message || 'Web audio error',
      });
    }
  }

  async pause(): Promise<void> {
    if (this.state.status !== 'playing') return;

    try {
      if (Platform.OS === 'web' && this.htmlAudio) {
        this.htmlAudio.pause();
      } else if (this.sound) {
        this.sound.pause();
      }
      this.notify({ status: 'paused' });
    } catch (err: any) {
      console.warn('[fmX Audio] Pause notice:', err);
    }
  }

  async resume(): Promise<void> {
    if (this.state.status !== 'paused' || !this.state.currentStation) return;

    this.notify({ status: 'loading', bufferingProgress: 0.3 });

    try {
      if (Platform.OS === 'web' && this.htmlAudio) {
        await this.htmlAudio.play();
      } else if (this.sound) {
        this.sound.play();
      }
      this.notify({ status: 'playing' });
    } catch (err: any) {
      console.warn('[fmX Audio] Resume retry:', err);
      if (this.state.currentStation) {
        await this.playStation(this.state.currentStation);
      }
    }
  }

  async togglePlayPause(): Promise<void> {
    if (this.state.status === 'playing') {
      await this.pause();
    } else if (this.state.status === 'paused') {
      await this.resume();
    } else if (this.state.currentStation) {
      await this.playStation(this.state.currentStation);
    }
  }

  async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, volume));
    this.notify({ volume: clamped });

    if (this.state.isMuted) return;

    if (Platform.OS === 'web' && this.htmlAudio) {
      this.htmlAudio.volume = clamped;
    } else if (this.sound) {
      this.sound.volume = clamped;
    }
  }

  async toggleMute(): Promise<void> {
    const nextMute = !this.state.isMuted;
    this.notify({ isMuted: nextMute });

    const targetVolume = nextMute ? 0 : this.state.volume;
    if (Platform.OS === 'web' && this.htmlAudio) {
      this.htmlAudio.volume = targetVolume;
    } else if (this.sound) {
      this.sound.muted = nextMute;
      this.sound.volume = targetVolume;
    }
  }

  async stopAndUnload(resetStation = true): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (this.hlsInstance) {
          this.hlsInstance.destroy();
          this.hlsInstance = null;
        }
        if (this.htmlAudio) {
          this.htmlAudio.pause();
          this.htmlAudio.src = '';
          this.htmlAudio = null;
        }
      }

      if (this.sound) {
        try {
          this.sound.pause();
          this.sound.clearLockScreenControls();
          this.sound.remove();
        } catch (e) {
          console.warn('[fmX Audio] Player cleanup notice:', e);
        }
        this.sound = null;
      }
    } catch (err) {
      console.warn('[fmX Audio] Unload notice:', err);
    }

    this.notify({
      status: 'idle',
      errorMessage: null,
      bufferingProgress: 0,
      ...(resetStation ? { currentStation: null } : {}),
    });

    if (resetStation) {
      this.updateSystemMediaMetadata(null);
    }
  }
}

export const audioPlaybackEngine = AudioPlaybackEngine.getInstance();
