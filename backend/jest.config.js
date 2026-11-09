/**
 * Configuration Jest - SouverainRecrut Backend
 * - TypeScript via ts-jest
 * - Prisma simulé (jest-mock-extended) : aucune base de données requise
 * - Rapports : couverture lcov (SonarQube) + JUnit (Jenkins)
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }],
  },
  setupFiles: ["<rootDir>/tests/setup/env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/prisma-mock.ts"],

  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/server.ts",        // point d'entrée (app.listen)
    "!src/docs/**",          // annotations Swagger
    "!src/types/**",         // déclarations de types
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov", "cobertura"],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },

  reporters: [
    "default",
    ["jest-junit", { outputDirectory: "reports", outputName: "junit.xml" }],
  ],
};
