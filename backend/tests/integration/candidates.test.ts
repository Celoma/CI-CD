import { adminToken, api, fakeCandidate, prismaMock, recruiterToken } from "../helpers";

describe("Candidats - /v1/candidates", () => {
  describe("GET /", () => {
    it("liste les candidats avec pagination", async () => {
      prismaMock.candidate.findMany.mockResolvedValue([fakeCandidate()] as any);
      prismaMock.candidate.count.mockResolvedValue(25);

      const res = await api()
        .get("/v1/candidates?page=2&limit=10")
        .set("Authorization", recruiterToken());

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
      expect(prismaMock.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
    });

    it("utilise la pagination par défaut", async () => {
      prismaMock.candidate.findMany.mockResolvedValue([]);
      prismaMock.candidate.count.mockResolvedValue(0);

      const res = await api().get("/v1/candidates").set("Authorization", adminToken());

      expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    });
  });

  describe("GET /:id", () => {
    it("renvoie un candidat", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(fakeCandidate() as any);

      const res = await api().get("/v1/candidates/cand-1").set("Authorization", recruiterToken());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe("cand-1");
    });

    it("renvoie 404 si le candidat n'existe pas", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      const res = await api().get("/v1/candidates/absent").set("Authorization", recruiterToken());

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("Candidat introuvable.");
    });
  });

  describe("POST /", () => {
    it("crée un candidat et normalise l'email en minuscules", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);
      prismaMock.candidate.create.mockResolvedValue(fakeCandidate() as any);

      const res = await api()
        .post("/v1/candidates")
        .set("Authorization", recruiterToken())
        .send({ fullName: "  Mamadou Bah ", email: "MAMADOU@Example.com", phone: "0600000000" });

      expect(res.status).toBe(201);
      expect(prismaMock.candidate.create).toHaveBeenCalledWith({
        data: { fullName: "Mamadou Bah", email: "mamadou@example.com", phone: "0600000000" },
      });
    });

    it("refuse un email déjà utilisé (409)", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(fakeCandidate() as any);

      const res = await api()
        .post("/v1/candidates")
        .set("Authorization", recruiterToken())
        .send({ fullName: "Mamadou Bah", email: "mamadou@example.com" });

      expect(res.status).toBe(409);
      expect(prismaMock.candidate.create).not.toHaveBeenCalled();
    });

    it("refuse des données invalides (400) avec le détail des champs", async () => {
      const res = await api()
        .post("/v1/candidates")
        .set("Authorization", recruiterToken())
        .send({ fullName: "AB", email: "pas-un-email" });

      expect(res.status).toBe(400);
      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(["fullName", "email"]));
    });
  });

  describe("PUT /:id", () => {
    it("met à jour un candidat existant", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(fakeCandidate() as any);
      prismaMock.candidate.update.mockResolvedValue(fakeCandidate({ phone: "0700000000" }) as any);

      const res = await api()
        .put("/v1/candidates/cand-1")
        .set("Authorization", recruiterToken())
        .send({ phone: "0700000000" });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe("0700000000");
    });

    it("renvoie 404 pour un candidat inexistant", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(null);

      const res = await api()
        .put("/v1/candidates/absent")
        .set("Authorization", recruiterToken())
        .send({ phone: "0700000000" });

      expect(res.status).toBe(404);
      expect(prismaMock.candidate.update).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /:id", () => {
    it("supprime un candidat (ADMIN)", async () => {
      prismaMock.candidate.findUnique.mockResolvedValue(fakeCandidate() as any);
      prismaMock.candidate.delete.mockResolvedValue(fakeCandidate() as any);

      const res = await api().delete("/v1/candidates/cand-1").set("Authorization", adminToken());

      expect(res.status).toBe(200);
      expect(prismaMock.candidate.delete).toHaveBeenCalledWith({ where: { id: "cand-1" } });
    });

    it("interdit la suppression à un RECRUITER (403)", async () => {
      const res = await api().delete("/v1/candidates/cand-1").set("Authorization", recruiterToken());

      expect(res.status).toBe(403);
      expect(prismaMock.candidate.delete).not.toHaveBeenCalled();
    });
  });
});
