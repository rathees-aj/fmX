import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface FmXLogoProps {
  size?: number;
  showWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Official fmX branding component.
 * Renders the authentic, crisp fmX logo without blur or glare.
 * - Wordmark: assets/fmx logo.png (1796 x 565, aspect ratio ~3.179)
 * - Icon: assets/fmX icon.png (1076 x 715, aspect ratio ~1.505)
 */
export const FmXLogo: React.FC<FmXLogoProps> = ({
  size = 36,
  showWordmark = true,
  style,
}) => {
  if (showWordmark) {
    const height = size;
    const width = Math.round(size * 3.179);
    return (
      <View style={[styles.container, style]}>
        <Image
          source={require('../../../assets/fmx logo.png')}
          style={{ width, height }}
          resizeMode="contain"
          accessibilityLabel="fmX Global Radio Logo"
        />
      </View>
    );
  }

  const height = size;
  const width = Math.round(size * 1.505);
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../../assets/fmX icon.png')}
        style={{ width, height }}
        resizeMode="contain"
        accessibilityLabel="fmX App Icon"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
