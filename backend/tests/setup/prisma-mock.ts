import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "jest-mock-extended";

// Remplace le client Prisma réel par un mock profond : aucune connexion à PostgreSQL.
jest.mock("../../src/config/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from "../../src/config/prisma";

beforeEach(() => {
  mockReset(prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>);
});
