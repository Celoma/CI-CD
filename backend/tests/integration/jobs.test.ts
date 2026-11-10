import { adminToken, api, fakeJob, prismaMock, recruiterToken } from "../helpers";

const validJob = {
  title: "Développeur Backend",
  description: "API Node.js / Express / Prisma",
  location: "Rennes",
  company: "SouverainRecrut",
  recruiterId: "user-1",
};

describe("Offres d'emploi - /v1/jobs", () => {
  it("GET / liste les offres avec pagination", async () => {
    prismaMock.job.findMany.mockResolvedValue([fakeJob(), fakeJob({ id: "job-2" })] as any);
    prismaMock.job.count.mockResolvedValue(2);

    const res = await api().get("/v1/jobs?limit=500").set("Authorization", recruiterToken());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    // la limite est plafonnée à 100
    expect(res.body.pagination.limit).toBe(100);
  });

  it("GET /:id renvoie une offre", async () => {
    prismaMock.job.findUnique.mockResolvedValue(fakeJob() as any);

    const res = await api().get("/v1/jobs/job-1").set("Authorization", recruiterToken());

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Développeur Backend");
  });

  it("GET /:id renvoie 404 si l'offre n'existe pas", async () => {
    prismaMock.job.findUnique.mockResolvedValue(null);

    const res = await api().get("/v1/jobs/absent").set("Authorization", recruiterToken());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Offre introuvable.");
  });

  it("POST / crée une offre", async () => {
    prismaMock.job.create.mockResolvedValue(fakeJob() as any);

    const res = await api().post("/v1/jobs").set("Authorization", recruiterToken()).send(validJob);

    expect(res.status).toBe(201);
    expect(prismaMock.job.create).toHaveBeenCalledWith({ data: validJob });
  });

  it("POST / refuse une offre invalide (400)", async () => {
    const res = await api()
      .post("/v1/jobs")
      .set("Authorization", recruiterToken())
      .send({ ...validJob, title: "AB", description: "court" });

    expect(res.status).toBe(400);
    expect(prismaMock.job.create).not.toHaveBeenCalled();
  });

  it("PUT /:id met à jour une offre", async () => {
    prismaMock.job.findUnique.mockResolvedValue(fakeJob() as any);
    prismaMock.job.update.mockResolvedValue(fakeJob({ location: "Paris" }) as any);

    const res = await api()
      .put("/v1/jobs/job-1")
      .set("Authorization", recruiterToken())
      .send({ location: "Paris" });

    expect(res.status).toBe(200);
    expect(res.body.data.location).toBe("Paris");
  });

  it("PUT /:id renvoie 404 si l'offre n'existe pas", async () => {
    prismaMock.job.findUnique.mockResolvedValue(null);

    const res = await api()
      .put("/v1/jobs/absent")
      .set("Authorization", recruiterToken())
      .send({ location: "Paris" });

    expect(res.status).toBe(404);
  });

  it("DELETE /:id supprime une offre (ADMIN)", async () => {
    prismaMock.job.findUnique.mockResolvedValue(fakeJob() as any);
    prismaMock.job.delete.mockResolvedValue(fakeJob() as any);

    const res = await api().delete("/v1/jobs/job-1").set("Authorization", adminToken());

    expect(res.status).toBe(200);
  });

  it("DELETE /:id est interdit au RECRUITER (403)", async () => {
    const res = await api().delete("/v1/jobs/job-1").set("Authorization", recruiterToken());
    expect(res.status).toBe(403);
  });
});
