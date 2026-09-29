import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

interface ComeYaLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Logo oficial de ComeYa (`assets/images/comeya-logo-nuevo.png`), generado
 * desde el SVG que envió el cliente: cuadrado rojo #EB0000 con el emblema
 * circular (anillo blanco, COMEYA, repartidor y "EL DELIVERY DE SORIA").
 *
 * Se muestra tal cual, sin recortar ni reinterpretar: el archivo anterior era
 * un círculo antiguo que no era el logo del cliente.
 */
export const ComeYaLogo: React.FC<ComeYaLogoProps> = ({
  size = 200,
  style,
}) => {
  return (
    <Image
      source={require("../../assets/images/comeya-logo-nuevo.png")}
      style={[{ width: size, height: size, resizeMode: "contain" }, style]}
    />
  );
};

export const RabbitFoodLogo = ComeYaLogo;
