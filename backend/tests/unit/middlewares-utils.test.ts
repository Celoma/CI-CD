import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

import { AppError } from "../../src/errors/app.error";
import { authorize } from "../../src/middlewares/authorize.middleware";
import { buildPaginationMeta, getPagination } from "../../src/utils/pagination";

describe("utils/pagination", () => {
  it("applique les valeurs par défaut", () => {
    expect(getPagination()).toEqual({ page: 1, limit: 10, skip: 0 });
  });

  it("calcule le décalage", () => {
    expect(getPagination("3", "20")).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it("borne les valeurs incohérentes", () => {
    expect(getPagination("-5", "0")).toEqual({ page: 1, limit: 1, skip: 0 });
    expect(getPagination("1", "1000").limit).toBe(100);
  });

  it("construit les métadonnées", () => {
    expect(buildPaginationMeta(1, 10, 21)).toEqual({ page: 1, limit: 10, total: 21, totalPages: 3 });
  });
});

describe("errors/AppError", () => {
  it("porte un code HTTP (500 par défaut)", () => {
    expect(new AppError("boom").statusCode).toBe(500);
    const err = new AppError("introuvable", 404);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
  });
});

describe("middlewares/authorize", () => {
  const run = (user: Request["user"], ...roles: Role[]) => {
    const next = jest.fn() as unknown as NextFunction & jest.Mock;
    authorize(...roles)({ user } as Request, {} as Response, next);
    return next;
  };

  it("laisse passer un rôle autorisé", () => {
    const next = run({ id: "1", role: Role.ADMIN }, Role.ADMIN);
    expect(next).toHaveBeenCalledWith();
  });

  it("renvoie 401 sans utilisateur authentifié", () => {
    const next = run(undefined, Role.ADMIN);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it("renvoie 403 pour un rôle non autorisé", () => {
    const next = run({ id: "1", role: Role.RECRUITER }, Role.ADMIN);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });
});
