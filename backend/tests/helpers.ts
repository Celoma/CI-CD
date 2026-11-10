import { PrismaClient, Role } from "@prisma/client";
import { DeepMockProxy } from "jest-mock-extended";
import jwt from "jsonwebtoken";
import request from "supertest";

import app from "../src/app";
import { prisma } from "../src/config/prisma";

/** Client Prisma simulé (voir tests/setup/prisma-mock.ts) */
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

export const api = () => request(app);

export const tokenFor = (role: Role, id = `${role.toLowerCase()}-1`) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET as string, { expiresIn: "1h" });

export const adminToken = () => `Bearer ${tokenFor(Role.ADMIN)}`;
export const recruiterToken = () => `Bearer ${tokenFor(Role.RECRUITER)}`;

const now = new Date("2026-01-01T00:00:00.000Z");

export const fakeUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  firstName: "Alice",
  lastName: "Diallo",
  email: "alice@souverainrecrut.com",
  password: "hashed",
  role: Role.RECRUITER,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

export const fakeCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: "cand-1",
  fullName: "Mamadou Bah",
  email: "mamadou@example.com",
  phone: "0600000000",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

export const fakeJob = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  title: "Développeur Backend",
  description: "API Node.js / Express / Prisma",
  location: "Rennes",
  company: "SouverainRecrut",
  recruiterId: "user-1",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

export const fakeApplication = (overrides: Record<string, unknown> = {}) => ({
  id: "app-1",
  candidateId: "cand-1",
  jobId: "job-1",
  status: "PENDING" as const,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});
