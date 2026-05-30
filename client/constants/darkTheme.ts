// Dark Mode Theme for ComeYa App
export const darkTheme = {
  colors: {
    primary: "#FF6B35",
    primaryDark: "#E55A25",
    primaryLight: "#FF8C5A",
    secondary: "#E0E0E0",
    background: "#121212",
    backgroundSecondary: "#1E1E1E",
    surface: "#2A2A2A",
    error: "#EF5350",
    warning: "#FBBF24",
    success: "#4ADE80",
    info: "#60A5FA",
    text: {
      primary: "#F5F5F5",
      secondary: "#AAAAAA",
      disabled: "#555555",
      inverse: "#1A1A1A",
    },
    border: "#333333",
    divider: "#2A2A2A",
    overlay: "rgba(0, 0, 0, 0.7)",
    carnival: {
      pink: "#FF6B35",
      purple: "#E55A25",
      gold: "#FBBF24",
    },
  },
};

export type DarkTheme = typeof darkTheme;
export const ComeYaDarkColors = darkTheme.colors;
export const ComeYaDarkColors = darkTheme.colors; // Legacy alias
