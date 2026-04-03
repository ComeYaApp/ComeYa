import React from 'react';
import Svg, { Circle, Path, Line } from 'react-native-svg';

interface ComeYaLogoProps {
  size?: number;
}

export const ComeYaLogo: React.FC<ComeYaLogoProps> = ({ size = 200 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Circle cx="100" cy="100" r="100" fill="#FF6B35"/>
      <Line x1="72" y1="88" x2="72" y2="148" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      <Line x1="63" y1="52" x2="63" y2="80" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <Line x1="72" y1="52" x2="72" y2="80" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <Line x1="81" y1="52" x2="81" y2="80" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      <Path d="M 63 80 Q 63 90 72 90 Q 81 90 81 80" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <Path d="M 110 52 Q 124 58 124 76 Q 124 88 110 88 L 110 52 Z" fill="white"/>
      <Line x1="110" y1="88" x2="110" y2="148" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      <Path d="M 52 132 Q 91 158 148 132" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <Line x1="136" y1="76" x2="158" y2="76" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.75"/>
      <Line x1="140" y1="90" x2="158" y2="90" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
      <Line x1="144" y1="104" x2="158" y2="104" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.3"/>
    </Svg>
  );
};

export const RabbitFoodLogo = ComeYaLogo;
