import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, Text } from 'react-native';
import { RadioStation } from '../../types/station';
import { artworkService } from '../../services/artwork/artworkService';
import { FmxFallbackCover } from './FmxFallbackCover';

interface StationArtworkProps {
  station: RadioStation;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  showBadge?: boolean;
}

export const StationArtwork: React.FC<StationArtworkProps> = ({
  station,
  size = 44,
  borderRadius = 4,
  style,
  showBadge = false,
}) => {
  const resolved = artworkService.resolveStationArtwork(station);
  const targetUri = resolved.uri;

  const [hasErrorForUri, setHasErrorForUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If the target URI was already marked as errored for this specific station, or if it has no URI
  const isFailed = !targetUri || hasErrorForUri === targetUri || artworkService.isUrlFailed(targetUri);

  // Timeout guard for slow/unresponsive remote image servers
  useEffect(() => {
    if (!targetUri || isFailed) return;

    let isCancelled = false;
    const timer = setTimeout(() => {
      if (!isCancelled && isLoading) {
        setHasErrorForUri(targetUri);
        setIsLoading(false);
        artworkService.recordImageLoadError(targetUri);
      }
    }, 7000); // 7-second network timeout

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [targetUri, isLoading, isFailed]);

  if (isFailed || resolved.isFallback) {
    return (
      <FmxFallbackCover
        station={station}
        size={size}
        borderRadius={borderRadius}
        style={style}
      />
    );
  }

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
    >
      <Image
        key={`${station.id || 'station'}:${targetUri}`}
        source={{ uri: targetUri }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
        resizeMode="cover"
        onLoadStart={() => setIsLoading(true)}
        onLoad={() => {
          setIsLoading(false);
          artworkService.recordImageLoadSuccess(targetUri);
        }}
        onError={() => {
          setHasErrorForUri(targetUri);
          setIsLoading(false);
          artworkService.recordImageLoadError(targetUri);
        }}
        accessibilityLabel={`Artwork for ${station.name || 'station'}`}
      />

      {/* Loading Skeleton Placeholder to prevent any layout shifts */}
      {isLoading && (
        <View
          style={[
            styles.skeletonPlaceholder,
            {
              width: size,
              height: size,
              borderRadius,
            },
          ]}
        />
      )}

      {/* Optional provenance badge for larger card views */}
      {showBadge && size >= 60 && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>
            {resolved.isOfficial ? 'OFFICIAL' : 'DIRECTORY'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#2A2A30',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    backgroundColor: '#161618',
  },
  skeletonPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1F1F24',
    opacity: 0.8,
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#3F3F46',
  },
  badgeText: {
    fontFamily: 'Courier',
    fontSize: 7,
    fontWeight: '800',
    color: '#D4D4D8',
    letterSpacing: 0.4,
  },
});
