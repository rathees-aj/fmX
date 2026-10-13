import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { RadioStation } from '../../types/station';
import { artworkService, FallbackVisualProps } from '../../services/artwork/artworkService';

interface FmxFallbackCoverProps {
  station: RadioStation;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const FmxFallbackCover: React.FC<FmxFallbackCoverProps> = ({
  station,
  size = 44,
  borderRadius = 4,
  style,
}) => {
  const visualProps: FallbackVisualProps = artworkService.getDeterministicVisualProps(station);
  const isLarge = size >= 60;
  const isMedium = size >= 44;

  const monogramFontSize = Math.max(10, Math.round(size * 0.3));
  const maxBarHeight = Math.max(4, Math.round(size * 0.2));

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
        },
        style,
      ]}
      accessibilityLabel={`Station cover for ${station.name}`}
    >
      {/* Top micro-header */}
      <View style={styles.topRow}>
        <Text style={styles.cornerMarker}>+</Text>
        <Text style={[styles.microBrand, { fontSize: Math.max(6, Math.round(size * 0.13)) }]}>
          fmX
        </Text>
      </View>

      {/* Center Monogram */}
      <View style={styles.centerContainer}>
        <Text
          style={[
            styles.monogramText,
            {
              fontSize: monogramFontSize,
              lineHeight: monogramFontSize + 2,
            },
          ]}
          numberOfLines={1}
        >
          {visualProps.monogram}
        </Text>
      </View>

      {/* Bottom deterministic waveform bars */}
      <View style={styles.bottomRow}>
        {visualProps.bars.map((barRatio, i) => {
          const barHeight = Math.max(2, Math.round(barRatio * maxBarHeight));
          return (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: barHeight,
                  width: Math.max(2, Math.round(size * 0.045)),
                  opacity: 0.6 + barRatio * 0.4,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#2A2A30',
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  cornerMarker: {
    fontFamily: 'Courier',
    fontSize: 7,
    color: '#52525B',
    lineHeight: 8,
  },
  microBrand: {
    fontFamily: 'Courier',
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: 'Courier',
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    height: 8,
  },
  waveformBar: {
    backgroundColor: '#D4D4D8',
    borderRadius: 1,
  },
});
