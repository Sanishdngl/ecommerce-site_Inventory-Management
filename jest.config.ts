import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: [
    "**/tests/unit/**/*.test.ts",
    "**/tests/integration/**/*.test.ts",
  ],
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/shared/src/$1",
    "^@infrastructure/(.*)$": "<rootDir>/infrastructure/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tests/tsconfig.json",
      },
    ],
  },
  setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
  collectCoverageFrom: [
    "shared/src/**/*.ts",
    "gateway/src/**/*.ts",
    "services/*/src/**/*.ts",
    "!**/*.d.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};

export default config;
