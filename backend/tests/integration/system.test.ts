import { adminToken, api, prismaMock, recruiterToken } from "../helpers";

describe("Routes système et tableau de bord", () => {
  it("GET / renvoie le message d'accueil", async () => {
    const res = await api().get("/");
    expect(res.status).toBe(200);
    expect(res.body.api).toBe("/v1");
  });

  it("GET /v1/health renvoie UP", async () => {
    const res = await api().get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("UP");
  });

  it("GET /v1/ready renvoie READY quand la base répond", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }] as any);

    const res = await api().get("/v1/ready");

    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe("CONNECTED");
  });

  it("GET /v1/ready renvoie 503 quand la base est indisponible", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connexion refusée"));

    const res = await api().get("/v1/ready");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.database).toBe("DISCONNECTED");
  });

  it("GET /v1/info renvoie les informations de l'API", async () => {
    const res = await api().get("/v1/info");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "SouverainRecrut API", apiVersion: "v1" });
  });

  it("GET /v1/dashboard/stats agrège les compteurs", async () => {
    prismaMock.user.count.mockResolvedValue(3);
    prismaMock.candidate.count.mockResolvedValue(10);
    prismaMock.job.count.mockResolvedValue(4);
    prismaMock.application.count.mockResolvedValueOnce(12).mockResolvedValueOnce(5);

    const res = await api().get("/v1/dashboard/stats").set("Authorization", recruiterToken());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      users: 3,
      candidates: 10,
      jobs: 4,
      applications: 12,
      pendingApplications: 5,
    });
  });

  it("route inconnue : 404 au format JSON", async () => {
    const res = await api().get("/v1/inexistante").set("Authorization", adminToken());
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Route /v1/inexistante introuvable.");
  });

  it("erreur inattendue : 500 sans fuite du détail technique", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.candidate.findUnique.mockRejectedValue(new Error("panne SQL interne"));

    const res = await api().get("/v1/candidates/cand-1").set("Authorization", adminToken());

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe("Erreur interne du serveur.");
    expect(JSON.stringify(res.body)).not.toContain("panne SQL");
    spy.mockRestore();
  });
});
