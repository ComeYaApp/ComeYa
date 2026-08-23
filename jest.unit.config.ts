import type { Config } from "jest";

// Config mínima para tests unitarios PUROS (sin BD remota ni seed).
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/unit"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      { tsconfig: "<rootDir>/tsconfig.json" },
    ],
  },
};

export default config;
