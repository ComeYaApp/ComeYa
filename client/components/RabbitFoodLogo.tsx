import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface ComeYaLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export const ComeYaLogo: React.FC<ComeYaLogoProps> = ({ size = 200, style }) => {
  return (
    <Image
      source={require('../../assets/images/comeya-logo-final.png')}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
};

export const RabbitFoodLogo = ComeYaLogo;
