import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface BadgeProps {
  label: string;
  variant?: 'outline' | 'solid' | 'active';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'outline', style }) => {
  return (
    <View
      style={[
        styles.base,
        variant === 'outline' && styles.outline,
        variant === 'solid' && styles.solid,
        variant === 'active' && styles.active,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === 'active' && styles.activeText,
          variant === 'solid' && styles.solidText,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.borderSubtle,
  },
  solid: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderMedium,
  },
  active: {
    backgroundColor: colors.pureWhite,
    borderColor: colors.pureWhite,
  },
  text: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  solidText: {
    color: colors.silverBright,
  },
  activeText: {
    color: colors.void,
  },
});
