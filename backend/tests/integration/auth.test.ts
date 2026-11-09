import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

import { api, fakeUser, prismaMock, recruiterToken, tokenFor } from "../helpers";

describe("Authentification - POST /v1/auth/login", () => {
  const password = "password123";
  const hashed = bcrypt.hashSync(password, 4);

  it("renvoie un token JWT et l'utilisateur sans mot de passe", async () => {
    prismaMock.user.findUnique.mockResolvedValue(fakeUser({ password: hashed }) as any);

    const res = await api()
      .post("/v1/auth/login")
      .send({ email: "alice@souverainrecrut.com", password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.email).toBe("alice@souverainrecrut.com");

    const decoded = jwt.verify(res.body.data.token, "test-secret") as any;
    expect(decoded).toMatchObject({ id: "user-1", role: Role.RECRUITER });
  });

  it("refuse un email inconnu (401)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await api()
      .post("/v1/auth/login")
      .send({ email: "inconnu@example.com", password });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Email ou mot de passe invalide.");
  });

  it("refuse un mauvais mot de passe (401)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(fakeUser({ password: hashed }) as any);

    const res = await api()
      .post("/v1/auth/login")
      .send({ email: "alice@souverainrecrut.com", password: "mauvais" });

    expect(res.status).toBe(401);
  });
});

describe("Authentification - GET /v1/auth/me", () => {
  it("renvoie le profil de l'utilisateur connecté", async () => {
    const { password: _password, ...profile } = fakeUser();
    prismaMock.user.findUnique.mockResolvedValue(profile as any);

    const res = await api().get("/v1/auth/me").set("Authorization", recruiterToken());

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("alice@souverainrecrut.com");
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "recruiter-1" } })
    );
  });

  it("renvoie 404 si l'utilisateur du token n'existe plus", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await api().get("/v1/auth/me").set("Authorization", recruiterToken());

    expect(res.status).toBe(404);
  });

  it("exige un token (401)", async () => {
    const res = await api().get("/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Authentification requise.");
  });

  it("refuse un schéma d'autorisation autre que Bearer (401)", async () => {
    const res = await api().get("/v1/auth/me").set("Authorization", `Basic ${tokenFor(Role.ADMIN)}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Token invalide.");
  });

  it("refuse un token signé avec une autre clé (401)", async () => {
    const forged = jwt.sign({ id: "x", role: Role.ADMIN }, "autre-secret");
    const res = await api().get("/v1/auth/me").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Token invalide ou expiré.");
  });

  it("refuse un token expiré (401)", async () => {
    const expired = jwt.sign({ id: "x", role: Role.ADMIN }, "test-secret", { expiresIn: -10 });
    const res = await api().get("/v1/auth/me").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});
