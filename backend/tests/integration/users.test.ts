import bcrypt from "bcrypt";
import { Role } from "@prisma/client";

import { adminToken, api, fakeUser, prismaMock, recruiterToken } from "../helpers";

const newUser = {
  firstName: "Fatou",
  lastName: "Camara",
  email: "fatou@souverainrecrut.com",
  password: "motdepasse123",
  role: Role.RECRUITER,
};

describe("Utilisateurs - /v1/users (réservé ADMIN)", () => {
  it("GET / liste les utilisateurs", async () => {
    prismaMock.user.findMany.mockResolvedValue([fakeUser()] as any);
    prismaMock.user.count.mockResolvedValue(1);

    const res = await api().get("/v1/users").set("Authorization", adminToken());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("GET /:id renvoie un utilisateur", async () => {
    prismaMock.user.findUnique.mockResolvedValue(fakeUser() as any);

    const res = await api().get("/v1/users/user-1").set("Authorization", adminToken());

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("user-1");
  });

  it("GET /:id renvoie 404 si l'utilisateur n'existe pas", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await api().get("/v1/users/absent").set("Authorization", adminToken());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Utilisateur introuvable.");
  });

  it("POST / crée un utilisateur avec un mot de passe haché", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(fakeUser({ email: newUser.email }) as any);

    const res = await api().post("/v1/users").set("Authorization", adminToken()).send(newUser);

    expect(res.status).toBe(201);
    const { data } = prismaMock.user.create.mock.calls[0][0] as { data: { password: string } };
    expect(data.password).not.toBe(newUser.password);
    expect(await bcrypt.compare(newUser.password, data.password)).toBe(true);
  });

  it("POST / refuse un email déjà utilisé (409)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(fakeUser() as any);

    const res = await api().post("/v1/users").set("Authorization", adminToken()).send(newUser);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Cet email est déjà utilisé.");
  });

  it("POST / refuse un mot de passe trop court (400)", async () => {
    const res = await api()
      .post("/v1/users")
      .set("Authorization", adminToken())
      .send({ ...newUser, password: "court" });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("password");
  });

  it("PUT /:id met à jour un utilisateur", async () => {
    prismaMock.user.findUnique.mockResolvedValue(fakeUser() as any);
    prismaMock.user.update.mockResolvedValue(fakeUser({ lastName: "Sow" }) as any);

    const res = await api()
      .put("/v1/users/user-1")
      .set("Authorization", adminToken())
      .send({ lastName: "Sow" });

    expect(res.status).toBe(200);
    expect(res.body.data.lastName).toBe("Sow");
  });

  it("PUT /:id renvoie 404 si l'utilisateur n'existe pas", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await api()
      .put("/v1/users/absent")
      .set("Authorization", adminToken())
      .send({ lastName: "Sow" });

    expect(res.status).toBe(404);
  });

  it("DELETE /:id supprime un utilisateur", async () => {
    prismaMock.user.findUnique.mockResolvedValue(fakeUser() as any);
    prismaMock.user.delete.mockResolvedValue(fakeUser() as any);

    const res = await api().delete("/v1/users/user-1").set("Authorization", adminToken());

    expect(res.status).toBe(200);
  });

  it.each([
    ["GET", "/v1/users"],
    ["GET", "/v1/users/user-1"],
    ["POST", "/v1/users"],
    ["PUT", "/v1/users/user-1"],
    ["DELETE", "/v1/users/user-1"],
  ])("%s %s est interdit au RECRUITER (403)", async (method, url) => {
    const req = api()[method.toLowerCase() as "get"](url).set("Authorization", recruiterToken());
    const res = await req.send(newUser);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("Accès refusé. Permissions insuffisantes.");
  });
});
