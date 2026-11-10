import { ApplicationStatus } from "@prisma/client";

import { ApplicationService } from "../../src/services/application.service";
import { AppError } from "../../src/errors/app.error";
import { adminToken, api, fakeApplication, prismaMock, recruiterToken } from "../helpers";

describe("Candidatures - /v1/applications", () => {
  it("GET / liste les candidatures avec candidat et offre", async () => {
    prismaMock.application.findMany.mockResolvedValue([fakeApplication()] as any);
    prismaMock.application.count.mockResolvedValue(1);

    const res = await api().get("/v1/applications").set("Authorization", recruiterToken());

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
    expect(prismaMock.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { candidate: true, job: true } })
    );
  });

  it("GET /:id renvoie une candidature", async () => {
    prismaMock.application.findUnique.mockResolvedValue(fakeApplication() as any);

    const res = await api().get("/v1/applications/app-1").set("Authorization", recruiterToken());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PENDING");
  });

  it("GET /:id renvoie 404 si la candidature n'existe pas", async () => {
    prismaMock.application.findUnique.mockResolvedValue(null);

    const res = await api().get("/v1/applications/absent").set("Authorization", recruiterToken());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Candidature introuvable.");
  });

  it("POST / crée une candidature", async () => {
    prismaMock.application.create.mockResolvedValue(fakeApplication() as any);

    const res = await api()
      .post("/v1/applications")
      .set("Authorization", recruiterToken())
      .send({ candidateId: "cand-1", jobId: "job-1" });

    expect(res.status).toBe(201);
    expect(prismaMock.application.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { candidateId: "cand-1", jobId: "job-1" } })
    );
  });

  it("POST / refuse un statut inconnu (400)", async () => {
    const res = await api()
      .post("/v1/applications")
      .set("Authorization", recruiterToken())
      .send({ candidateId: "cand-1", jobId: "job-1", status: "INCONNU" });

    expect(res.status).toBe(400);
  });

  it("PUT /:id change le statut d'une candidature", async () => {
    prismaMock.application.findUnique.mockResolvedValue(fakeApplication() as any);
    prismaMock.application.update.mockResolvedValue(fakeApplication({ status: "ACCEPTED" }) as any);

    const res = await api()
      .put("/v1/applications/app-1")
      .set("Authorization", recruiterToken())
      .send({ status: ApplicationStatus.ACCEPTED });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ACCEPTED");
  });

  it("PUT /:id exige un statut (400)", async () => {
    const res = await api()
      .put("/v1/applications/app-1")
      .set("Authorization", recruiterToken())
      .send({});

    expect(res.status).toBe(400);
  });

  it("DELETE /:id supprime une candidature (ADMIN)", async () => {
    prismaMock.application.findUnique.mockResolvedValue(fakeApplication() as any);
    prismaMock.application.delete.mockResolvedValue(fakeApplication() as any);

    const res = await api().delete("/v1/applications/app-1").set("Authorization", adminToken());

    expect(res.status).toBe(200);
  });

  it("DELETE /:id est interdit au RECRUITER (403)", async () => {
    const res = await api().delete("/v1/applications/app-1").set("Authorization", recruiterToken());
    expect(res.status).toBe(403);
  });
});

describe("ApplicationService.updateStatus", () => {
  const service = new ApplicationService();

  it("met à jour uniquement le statut", async () => {
    prismaMock.application.findUnique.mockResolvedValue(fakeApplication() as any);
    prismaMock.application.update.mockResolvedValue(fakeApplication({ status: "REVIEWED" }) as any);

    const result = await service.updateStatus("app-1", ApplicationStatus.REVIEWED);

    expect(result.status).toBe("REVIEWED");
    expect(prismaMock.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "app-1" }, data: { status: "REVIEWED" } })
    );
  });

  it("lève une erreur 404 si la candidature n'existe pas", async () => {
    prismaMock.application.findUnique.mockResolvedValue(null);

    await expect(service.updateStatus("absent", ApplicationStatus.REJECTED)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.updateStatus("absent", ApplicationStatus.REJECTED)).rejects.toBeInstanceOf(AppError);
  });
});
