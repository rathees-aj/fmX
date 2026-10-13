import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface FrequencyDisplayProps {
  frequency?: string;
  bitrate?: number;
  codec?: string;
  latitude?: number;
  longitude?: number;
}

export const FrequencyDisplay: React.FC<FrequencyDisplayProps> = ({
  frequency,
  bitrate,
  codec,
  latitude,
  longitude,
}) => {
  const formatCoord = (lat?: number, lng?: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
    const lngStr = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
    return `${latStr} ${lngStr}`;
  };

  const coords = formatCoord(latitude, longitude);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {frequency && (
          <View style={styles.segment}>
            <Text style={styles.metaLabel}>FREQ</Text>
            <Text style={styles.metaValue}>{frequency}</Text>
          </View>
        )}

        {bitrate && (
          <View style={styles.segment}>
            <Text style={styles.metaLabel}>BITRATE</Text>
            <Text style={styles.metaValue}>{bitrate} KBPS</Text>
          </View>
        )}

        {codec && (
          <View style={styles.segment}>
            <Text style={styles.metaLabel}>CODEC</Text>
            <Text style={styles.metaValue}>{codec}</Text>
          </View>
        )}
      </View>

      {coords && (
        <View style={styles.coordRow}>
          <Text style={styles.coordLabel}>GEO-COORDINATES</Text>
          <Text style={styles.coordValue}>{coords}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.silverMuted,
    letterSpacing: 1,
  },
  metaValue: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '700',
    color: colors.silverBright,
    letterSpacing: 0.5,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  coordLabel: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '700',
    color: colors.silverMuted,
    letterSpacing: 1.2,
  },
  coordValue: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.8,
  },
});
