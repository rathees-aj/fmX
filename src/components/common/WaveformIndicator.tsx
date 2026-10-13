import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../theme/colors';
import { PlaybackStatus } from '../../types/audio';

interface WaveformIndicatorProps {
  status: PlaybackStatus;
  barCount?: number;
  height?: number;
}

export const WaveformIndicator: React.FC<WaveformIndicatorProps> = ({
  status,
  barCount = 5,
  height = 16,
}) => {
  const animatedValues = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (status === 'playing') {
      const animations = animatedValues.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.3 + ((index * 3) % 7) * 0.1,
              duration: 180 + (index * 70),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.9,
              duration: 220 + (index * 50),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.15,
              duration: 200 + (index * 60),
              useNativeDriver: false,
            }),
          ])
        );
      });

      Animated.parallel(animations).start();
      return () => animations.forEach((a) => a.stop());
    } else if (status === 'loading') {
      const stagger = animatedValues.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(index * 80),
            Animated.timing(anim, {
              toValue: 0.8,
              duration: 250,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.2,
              duration: 250,
              useNativeDriver: false,
            }),
          ])
        );
      });
      Animated.parallel(stagger).start();
      return () => stagger.forEach((a) => a.stop());
    } else {
      // Paused / idle / error
      animatedValues.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [status]);

  return (
    <View style={[styles.container, { height }]}>
      {animatedValues.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [2, height],
              }),
              backgroundColor:
                status === 'playing'
                  ? colors.pureWhite
                  : status === 'loading'
                  ? colors.silver
                  : colors.graphite,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bar: {
    width: 2.5,
    borderRadius: 1,
  },
});
