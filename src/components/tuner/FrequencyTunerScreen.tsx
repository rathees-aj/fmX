import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  PanResponder,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { RadioStation } from '../../types/station';
import { colors } from '../../theme/colors';
import { useAudioPlayer } from '../../services/audio/useAudioPlayer';
import { WaveformIndicator } from '../common/WaveformIndicator';
import { formatStationLocation } from '../../utils/locationFormatter';

interface FrequencyTunerScreenProps {
  stations: RadioStation[];
  selectedStation: RadioStation | null;
  onSelectStation: (station: RadioStation) => void;
  onToggleFavorite: (stationId: string) => void;
  favoriteIds: Set<string>;
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
}

export const FrequencyTunerScreen: React.FC<FrequencyTunerScreenProps> = ({
  stations,
  selectedStation,
  onSelectStation,
  onToggleFavorite,
  favoriteIds,
}) => {
  const { width } = useWindowDimensions();
  const { currentStation, status, playStation, pause, resume } = useAudioPlayer();

  const isCurrentPlaying = currentStation?.id === selectedStation?.id && status === 'playing';
  const isCurrentLoading = currentStation?.id === selectedStation?.id && status === 'loading';

  // Tuner range: 87.5 MHz to 108.0 MHz
  const MIN_FREQ = 87.5;
  const MAX_FREQ = 108.0;

  // Extract stations with known numeric frequencies
  const fmStations = useMemo(() => {
    return stations
      .map((s) => {
        const match = s.frequency ? s.frequency.match(/(\d+\.?\d*)/) : null;
        const val = match ? parseFloat(match[1]) : null;
        return {
          ...s,
          numericFreq: val,
        };
      })
      .filter((s) => s.numericFreq !== null && s.numericFreq >= MIN_FREQ && s.numericFreq <= MAX_FREQ)
      .sort((a, b) => (a.numericFreq! - b.numericFreq!));
  }, [stations]);

  // Digital stations without terrestrial FM frequency
  const digitalStations = useMemo(() => {
    return stations.filter(
      (s) => !s.frequency || !s.frequency.match(/(\d+\.?\d*)/)
    );
  }, [stations]);

  // Current dial frequency
  const [currentFreq, setCurrentFreq] = useState<number>(() => {
    if (selectedStation?.frequency) {
      const match = selectedStation.frequency.match(/(\d+\.?\d*)/);
      if (match) return parseFloat(match[1]);
    }
    return 94.3; // Default European/Global center FM frequency
  });

  const [tunerMode, setTunerMode] = useState<'FM' | 'DIGITAL'>('FM');

  // Update dial when station is selected from outside
  useEffect(() => {
    if (selectedStation?.frequency) {
      const match = selectedStation.frequency.match(/(\d+\.?\d*)/);
      if (match) {
        const freq = parseFloat(match[1]);
        if (freq >= MIN_FREQ && freq <= MAX_FREQ) {
          setCurrentFreq(freq);
          setTunerMode('FM');
          return;
        }
      }
    }
    if (selectedStation && (!selectedStation.frequency || !selectedStation.frequency.match(/(\d+\.?\d*)/))) {
      setTunerMode('DIGITAL');
    }
  }, [selectedStation]);

  // Drag Gesture for analog-style horizontal frequency scale
  const panStartX = useRef(0);
  const startFreq = useRef(currentFreq);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          panStartX.current = evt.nativeEvent.pageX;
          startFreq.current = currentFreq;
        },
        onPanResponderMove: (evt) => {
          const deltaX = evt.nativeEvent.pageX - panStartX.current;
          // Scale: 120 pixels per 1.0 MHz
          const deltaFreq = -(deltaX / 140);
          let newFreq = Math.round((startFreq.current + deltaFreq) * 10) / 10;
          newFreq = Math.max(MIN_FREQ, Math.min(MAX_FREQ, newFreq));
          setCurrentFreq(newFreq);

          // Find if any station is close within ±0.25 MHz and snap
          const nearest = fmStations.find(
            (s) => Math.abs(s.numericFreq! - newFreq) <= 0.25
          );
          if (nearest && nearest.id !== selectedStation?.id) {
            onSelectStation(nearest);
          }
        },
        onPanResponderRelease: () => {
          // Snap to exact station if near
          const nearest = fmStations.find(
            (s) => Math.abs(s.numericFreq! - currentFreq) <= 0.35
          );
          if (nearest) {
            setCurrentFreq(nearest.numericFreq!);
            onSelectStation(nearest);
          }
        },
      }),
    [currentFreq, fmStations, selectedStation, onSelectStation]
  );

  const handleStepFreq = (delta: number) => {
    const next = Math.max(MIN_FREQ, Math.min(MAX_FREQ, Math.round((currentFreq + delta) * 10) / 10));
    setCurrentFreq(next);
    const nearest = fmStations.find((s) => Math.abs(s.numericFreq! - next) <= 0.25);
    if (nearest) {
      onSelectStation(nearest);
    }
  };

  const activeIsFavorite = selectedStation ? favoriteIds.has(selectedStation.id) : false;

  return (
    <View style={styles.container}>
      {/* 1. Precision Digital Readout Panel */}
      <View style={styles.readoutCard}>
        <View style={styles.readoutTopRow}>
          <View style={styles.tuningStatusPill}>
            <View
              style={[
                styles.tuningLed,
                isCurrentPlaying && styles.tuningLedLive,
                isCurrentLoading && styles.tuningLedLoading,
              ]}
            />
            <Text style={styles.tuningStatusText}>
              {isCurrentPlaying
                ? 'STEREO // SIGNAL LOCKED'
                : isCurrentLoading
                ? 'TUNING FREQUENCY...'
                : 'DIGITAL RECEIVER READY'}
            </Text>
          </View>

          <View style={styles.modeSwitchGroup}>
            <TouchableOpacity
              onPress={() => setTunerMode('FM')}
              style={[styles.modeBtn, tunerMode === 'FM' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeBtnText, tunerMode === 'FM' && styles.modeBtnTextActive]}>
                FM BAND
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTunerMode('DIGITAL')}
              style={[styles.modeBtn, tunerMode === 'DIGITAL' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeBtnText, tunerMode === 'DIGITAL' && styles.modeBtnTextActive]}>
                DIGITAL
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Large Typography Numerical Frequency Display */}
        <View style={styles.displayMain}>
          {tunerMode === 'FM' ? (
            <View style={styles.freqHeroRow}>
              <Text style={styles.heroFreqNumber}>{currentFreq.toFixed(1)}</Text>
              <View style={styles.freqUnitCol}>
                <Text style={styles.heroFreqUnit}>MHz</Text>
                <Text style={styles.heroBandTag}>VHF FM</Text>
              </View>
            </View>
          ) : (
            <View style={styles.digitalHeroRow}>
              <Text style={styles.digitalHeroTitle}>INTERNET STREAM</Text>
              <Text style={styles.digitalHeroSub}>GLOBAL IP BROADCAST</Text>
            </View>
          )}

          {isCurrentPlaying && (
            <View style={styles.waveformWrapper}>
              <WaveformIndicator status={status} barCount={5} height={20} />
            </View>
          )}
        </View>

        {/* Sub-readout: Location and signal specifications */}
        <View style={styles.readoutFooter}>
          <Text style={styles.readoutStationTitle} numberOfLines={1}>
            {selectedStation ? selectedStation.name : 'Seek Frequency along Scale'}
          </Text>
          <Text style={styles.readoutMetaText} numberOfLines={1}>
            {selectedStation
              ? `${formatStationLocation(selectedStation)} • ${
                  selectedStation.bitrate ? `${selectedStation.bitrate}K` : '128K'
                } ${selectedStation.codec || 'MP3'}`
              : 'Tuning Dial active — Drag scale to acquire broadcast'}
          </Text>
        </View>
      </View>

      {/* 2. Horizontal Precision Analog-Inspired Tuning Scale (FM Band) */}
      {tunerMode === 'FM' && (
        <View style={styles.scaleContainer}>
          {/* Top Dial Indicators */}
          <View style={styles.dialHeader}>
            <TouchableOpacity onPress={() => handleStepFreq(-0.2)} style={styles.seekStepBtn}>
              <Text style={styles.seekStepText}>◀ −0.2</Text>
            </TouchableOpacity>
            <Text style={styles.scaleTitle}>87.5 — 108.0 MHz FM TUNER SCALE</Text>
            <TouchableOpacity onPress={() => handleStepFreq(0.2)} style={styles.seekStepBtn}>
              <Text style={styles.seekStepText}>+0.2 ▶</Text>
            </TouchableOpacity>
          </View>

          {/* Interactive Dial Ruler Area */}
          <View style={styles.rulerTrack} {...panResponder.panHandlers}>
            {/* Center Hairline Needle */}
            <View style={styles.needleLine} />
            <View style={styles.needlePointer} />

            {/* Simulated Ticks Window (displays ~4 MHz centered on currentFreq) */}
            <View style={styles.rulerWindow}>
              {[-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0].map((offset) => {
                const tickFreq = Math.round((currentFreq + offset) * 10) / 10;
                if (tickFreq < MIN_FREQ || tickFreq > MAX_FREQ) return null;

                const isWhole = Math.abs(tickFreq - Math.round(tickFreq)) < 0.05;
                const stationAtFreq = fmStations.find(
                  (s) => Math.abs(s.numericFreq! - tickFreq) < 0.15
                );

                return (
                  <View key={tickFreq} style={styles.tickWrapper}>
                    {stationAtFreq && (
                      <View
                        style={[
                          styles.stationBeaconDot,
                          selectedStation?.id === stationAtFreq.id && styles.stationBeaconDotActive,
                        ]}
                      />
                    )}
                    <View
                      style={[
                        styles.tickMark,
                        isWhole ? styles.tickMarkMajor : styles.tickMarkMinor,
                      ]}
                    />
                    {isWhole && (
                      <Text style={styles.tickLabel}>{Math.round(tickFreq)}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
          <Text style={styles.rulerHint}>DRAG HORIZONTALLY TO TUNE FREQUENCY</Text>
        </View>
      )}

      {/* 3. Frequency Spectrum Station Badges Row */}
      <View style={styles.spectrumSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {tunerMode === 'FM' ? 'BROADCAST STATIONS ON DIAL' : 'DIGITAL RADIO DIRECTORY'}
          </Text>
          <Text style={styles.sectionCount}>
            {tunerMode === 'FM' ? `${fmStations.length} STATIONS` : `${digitalStations.length} STATIONS`}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.spectrumList}
        >
          {(tunerMode === 'FM' ? fmStations : digitalStations).map((station) => {
            const isSelected = selectedStation?.id === station.id;
            return (
              <TouchableOpacity
                key={station.id}
                onPress={() => {
                  onSelectStation(station);
                  const match = station.frequency ? station.frequency.match(/(\d+\.?\d*)/) : null;
                  if (match) setCurrentFreq(parseFloat(match[1]));
                }}
                style={[styles.freqPill, isSelected && styles.freqPillActive]}
              >
                <Text style={[styles.freqPillMhz, isSelected && styles.freqPillMhzActive]}>
                  {station.frequency || 'DIGITAL'}
                </Text>
                <Text style={[styles.freqPillName, isSelected && styles.freqPillNameActive]} numberOfLines={1}>
                  {station.name}
                </Text>
                <Text style={[styles.freqPillCity, isSelected && styles.freqPillCityActive]} numberOfLines={1}>
                  {station.city}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Active Station Action Card */}
      {selectedStation && (
        <View style={styles.actionCard}>
          <View style={styles.actionCardLeft}>
            <View style={styles.stationMonogramBox}>
              <Text style={styles.stationMonogramText}>
                {selectedStation.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.actionInfoCol}>
              <Text style={styles.actionStationName} numberOfLines={1}>
                {selectedStation.name}
              </Text>
              <Text style={styles.actionStationLocation} numberOfLines={1}>
                {formatStationLocation(selectedStation)} • {selectedStation.genres[0] || 'GENERAL'}
              </Text>
            </View>
          </View>

          <View style={styles.actionCardRight}>
            <TouchableOpacity
              onPress={() => onToggleFavorite(selectedStation.id)}
              style={styles.favActionBtn}
              accessibilityLabel="Favorite station"
            >
              <Text style={[styles.favActionText, activeIsFavorite && styles.favActionTextActive]}>
                {activeIsFavorite ? '★' : '☆'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (isCurrentPlaying) pause();
                else if (currentStation?.id === selectedStation.id && status === 'paused') resume();
                else playStation(selectedStation);
              }}
              style={[styles.tunePlayBtn, isCurrentPlaying && styles.tunePlayBtnActive]}
            >
              <Text style={[styles.tunePlayBtnText, isCurrentPlaying && styles.tunePlayBtnTextActive]}>
                {isCurrentPlaying ? 'PAUSE' : 'PLAY'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pureBlack,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  readoutCard: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 3,
    padding: 16,
    gap: 12,
  },
  readoutTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tuningStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tuningLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.steelGray,
  },
  tuningLedLive: {
    backgroundColor: colors.white,
  },
  tuningLedLoading: {
    backgroundColor: colors.silver,
  },
  tuningStatusText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.8,
  },
  modeSwitchGroup: {
    flexDirection: 'row',
    backgroundColor: colors.charcoal,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modeBtnActive: {
    backgroundColor: colors.white,
  },
  modeBtnText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '800',
    color: colors.silver,
    letterSpacing: 0.6,
  },
  modeBtnTextActive: {
    color: colors.pureBlack,
  },
  displayMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  freqHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  heroFreqNumber: {
    fontFamily: 'Courier',
    fontSize: 54,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -1,
  },
  freqUnitCol: {
    gap: 2,
  },
  heroFreqUnit: {
    fontFamily: 'Courier',
    fontSize: 18,
    fontWeight: '800',
    color: colors.lightSilver,
    letterSpacing: 1,
  },
  heroBandTag: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.steelGray,
    letterSpacing: 1.5,
  },
  digitalHeroRow: {
    gap: 2,
    paddingVertical: 8,
  },
  digitalHeroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 1,
  },
  digitalHeroSub: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: colors.silver,
    letterSpacing: 1.2,
  },
  waveformWrapper: {
    paddingRight: 6,
  },
  readoutFooter: {
    gap: 2,
  },
  readoutStationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.2,
  },
  readoutMetaText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: colors.silver,
    letterSpacing: 0.4,
  },
  scaleContainer: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 3,
    padding: 12,
    gap: 8,
  },
  dialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scaleTitle: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.steelGray,
    letterSpacing: 1,
  },
  seekStepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 2,
  },
  seekStepText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '800',
    color: colors.lightSilver,
  },
  rulerTrack: {
    height: 72,
    backgroundColor: colors.charcoal,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  needleLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    backgroundColor: colors.white,
    zIndex: 10,
  },
  needlePointer: {
    position: 'absolute',
    top: 2,
    left: '50%',
    marginLeft: -4,
    width: 10,
    height: 6,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.white,
    zIndex: 11,
  },
  rulerWindow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  tickWrapper: {
    alignItems: 'center',
    width: 32,
    position: 'relative',
  },
  stationBeaconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.steelGray,
    marginBottom: 4,
  },
  stationBeaconDotActive: {
    backgroundColor: colors.white,
  },
  tickMark: {
    width: 1.5,
    backgroundColor: colors.steelGray,
  },
  tickMarkMajor: {
    height: 24,
    backgroundColor: colors.lightSilver,
  },
  tickMarkMinor: {
    height: 12,
  },
  tickLabel: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '700',
    color: colors.silver,
    marginTop: 4,
  },
  rulerHint: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: colors.steelGray,
    textAlign: 'center',
    letterSpacing: 1,
  },
  spectrumSection: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '700',
    color: colors.steelGray,
    letterSpacing: 1,
  },
  sectionCount: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: colors.silver,
  },
  spectrumList: {
    gap: 8,
    paddingVertical: 2,
  },
  freqPill: {
    width: 120,
    padding: 10,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 2,
    gap: 2,
  },
  freqPillActive: {
    borderColor: colors.white,
    backgroundColor: colors.charcoal,
  },
  freqPillMhz: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '800',
    color: colors.lightSilver,
  },
  freqPillMhzActive: {
    color: colors.white,
  },
  freqPillName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  freqPillNameActive: {
    color: colors.white,
  },
  freqPillCity: {
    fontSize: 10,
    color: colors.silver,
  },
  freqPillCityActive: {
    color: colors.lightSilver,
  },
  actionCard: {
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 3,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stationMonogramBox: {
    width: 36,
    height: 36,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationMonogramText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: '900',
    color: colors.white,
  },
  actionInfoCol: {
    flex: 1,
    gap: 2,
  },
  actionStationName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  actionStationLocation: {
    fontSize: 11,
    color: colors.silver,
  },
  actionCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  favActionBtn: {
    padding: 6,
  },
  favActionText: {
    fontSize: 18,
    color: colors.silver,
  },
  favActionTextActive: {
    color: colors.white,
  },
  tunePlayBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 2,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tunePlayBtnActive: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  tunePlayBtnText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '800',
    color: colors.pureBlack,
    letterSpacing: 0.8,
  },
  tunePlayBtnTextActive: {
    color: colors.white,
  },
});
