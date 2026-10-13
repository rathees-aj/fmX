import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, Platform } from 'react-native';
import { colors } from '../../theme/colors';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'TUNING GLOBAL FREQUENCIES',
  subMessage = 'CONNECTING TO VERIFIED BROADCAST DIRECTORY',
}) => {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const barAnim1 = useRef(new Animated.Value(0.3)).current;
  const barAnim2 = useRef(new Animated.Value(0.7)).current;
  const barAnim3 = useRef(new Animated.Value(0.5)).current;
  const barAnim4 = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Soft breathing pulse animation (calm, natural 3.6s cycle)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.65,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Equalizer wave animation (smooth, normal harmonic timing)
    const animateBar = (anim: Animated.Value, dur: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: dur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.2,
            duration: dur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      ).start();
    };

    animateBar(barAnim1, 950);
    animateBar(barAnim2, 1300);
    animateBar(barAnim3, 1100);
    animateBar(barAnim4, 1450);
  }, [pulseAnim, barAnim1, barAnim2, barAnim3, barAnim4]);

  return (
    <View style={styles.container}>
      {/* Tactical Top Metadata */}
      <View style={styles.topRow}>
        <Text style={styles.cornerMarker}>+</Text>
        <Text style={styles.tacticalHeader}>SYS.BOOT // AUDIO_ENGINE_READY</Text>
        <Text style={styles.cornerMarker}>+</Text>
      </View>

      {/* Center Branding Hero */}
      <View style={styles.centerHero}>
        {/* Official Brand Logo */}
        <Animated.View style={[styles.logoWrapper, { opacity: pulseAnim }]}>
          <Image
            source={require('../../../assets/fmx logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="fmX Global Radio"
          />
        </Animated.View>

        {/* Tactical Equalizer Bars */}
        <View style={styles.equalizerRow}>
          {[barAnim1, barAnim2, barAnim3, barAnim4].map((anim, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.equalizerBar,
                {
                  height: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, 24],
                  }),
                },
              ]}
            />
          ))}
        </View>

        {/* Status Messages */}
        <Text style={styles.statusMessage}>{message}</Text>
        <Text style={styles.subMessage}>{subMessage}</Text>
      </View>

      {/* Tactical Footer */}
      <View style={styles.bottomRow}>
        <Text style={styles.footerText}>fmX • GLOBAL RADIO SYSTEM</Text>
        <Text style={styles.versionText}>v1.0.0 // ENCRYPTED_HLS</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cornerMarker: {
    fontFamily: 'Courier',
    fontSize: 14,
    color: '#52525B',
  },
  tacticalHeader: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 1.5,
  },
  centerHero: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 360,
  },
  logoWrapper: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoImage: {
    width: 222,
    height: 70,
  },
  equalizerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 28,
    gap: 6,
    marginBottom: 24,
  },
  equalizerBar: {
    width: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  statusMessage: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: '800',
    color: '#E4E4E7',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  subMessage: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '600',
    color: '#71717A',
    letterSpacing: 1,
    textAlign: 'center',
  },
  bottomRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#18181B',
    paddingTop: 16,
  },
  footerText: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '700',
    color: '#52525B',
    letterSpacing: 1.2,
  },
  versionText: {
    fontFamily: 'Courier',
    fontSize: 9,
    color: '#3F3F46',
    letterSpacing: 0.8,
  },
});
