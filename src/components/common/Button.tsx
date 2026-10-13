import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../../theme/colors';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.void : colors.pureWhite}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              styles[`text_${variant}`],
              styles[`text_size_${size}`],
              textStyle,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 2,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.pureWhite,
    borderColor: colors.pureWhite,
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderMedium,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.borderSubtle,
  },
  danger: {
    backgroundColor: colors.surfaceDark,
    borderColor: colors.borderStrong,
  },
  disabled: {
    opacity: 0.35,
  },
  size_sm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  size_md: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  size_lg: {
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  text: {
    fontFamily: 'Courier',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  text_primary: {
    color: colors.void,
  },
  text_secondary: {
    color: colors.pureWhite,
  },
  text_ghost: {
    color: colors.silverBright,
  },
  text_danger: {
    color: colors.silver,
  },
  text_size_sm: {
    fontSize: 11,
  },
  text_size_md: {
    fontSize: 12,
  },
  text_size_lg: {
    fontSize: 14,
  },
});
