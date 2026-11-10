// Variables d'environnement de test, chargées avant tout import de l'application
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.API_VERSION = "v1";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
