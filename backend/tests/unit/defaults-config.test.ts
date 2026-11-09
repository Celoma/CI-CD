import { ApplicationService } from "../../src/services/application.service";
import { CandidateService } from "../../src/services/candidate.service";
import { JobService } from "../../src/services/job.service";
import { UserService } from "../../src/services/user.service";
import { ApplicationRepository } from "../../src/repositories/application.repository";
import { CandidateRepository } from "../../src/repositories/candidate.repository";
import { JobRepository } from "../../src/repositories/job.repository";
import { UserRepository } from "../../src/repositories/user.repository";
import { prismaMock } from "../helpers";

describe("Pagination par défaut des services et repositories", () => {
  beforeEach(() => {
    for (const model of ["user", "candidate", "job", "application"] as const) {
      (prismaMock[model].findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock[model].count as jest.Mock).mockResolvedValue(0);
    }
  });

  it.each([
    ["UserService", () => new UserService().getAll(), "user"],
    ["CandidateService", () => new CandidateService().getAll(), "candidate"],
    ["JobService", () => new JobService().getAll(), "job"],
    ["ApplicationService", () => new ApplicationService().getAll(), "application"],
    ["UserRepository", () => new UserRepository().findAll(), "user"],
    ["CandidateRepository", () => new CandidateRepository().findAll(), "candidate"],
    ["JobRepository", () => new JobRepository().findAll(), "job"],
    ["ApplicationRepository", () => new ApplicationRepository().findAll(), "application"],
  ] as const)("%s.getAll() utilise skip=0 et take=10", async (_name, call, model) => {
    await expect(call()).resolves.toEqual({ items: [], total: 0 });
    expect(prismaMock[model].findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 })
    );
  });
});

describe("config/env", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  const loadEnv = () => {
    let env: typeof import("../../src/config/env").env | undefined;
    jest.isolateModules(() => {
      env = require("../../src/config/env").env;
    });
    return env!;
  };

  it("lit les variables d'environnement", () => {
    process.env.PORT = "4000";
    process.env.JWT_SECRET = "secret";
    const env = loadEnv();
    expect(env.port).toBe(4000);
    expect(env.jwtSecret).toBe("secret");
  });

  it("applique des valeurs par défaut quand elles sont absentes", () => {
    for (const key of ["PORT", "NODE_ENV", "DATABASE_URL", "JWT_SECRET", "API_VERSION", "FRONTEND_URL"]) {
      delete process.env[key];
    }
    // empêche dotenv de recharger un éventuel fichier .env local
    jest.doMock("dotenv", () => ({ config: jest.fn(), default: { config: jest.fn() } }));
    const env = loadEnv();
    jest.dontMock("dotenv");

    expect(env).toEqual({
      port: 4500,
      nodeEnv: "development",
      databaseUrl: "",
      jwtSecret: "",
      apiVersion: "v1",
      frontendUrl: "http://localhost:5173",
    });
  });
});

describe("middlewares/logger", () => {
  it("utilise le format 'combined' en production", () => {
    const morgan = jest.fn(() => "middleware");
    jest.isolateModules(() => {
      jest.doMock("morgan", () => morgan);
      jest.doMock("../../src/config/env", () => ({ env: { nodeEnv: "production" } }));
      require("../../src/middlewares/logger.middleware");
    });
    expect(morgan).toHaveBeenCalledWith("combined");
  });

  it("utilise le format 'dev' hors production", () => {
    const morgan = jest.fn(() => "middleware");
    jest.isolateModules(() => {
      jest.doMock("morgan", () => morgan);
      jest.doMock("../../src/config/env", () => ({ env: { nodeEnv: "development" } }));
      require("../../src/middlewares/logger.middleware");
    });
    expect(morgan).toHaveBeenCalledWith("dev");
  });
});
