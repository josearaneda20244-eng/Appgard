import express, { type Express } from "express";
  import cors from "cors";
  import pinoHttp from "pino-http";
  import type { IncomingMessage, ServerResponse } from "http";
  import router from "./routes";
  import { logger } from "./lib/logger";

  const app: Express = express();

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req: IncomingMessage & { id?: unknown }) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res: ServerResponse) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );

  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", router);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, "Unhandled API error");
    res.status(500).json({ error: "Error interno del servidor" });
  });

  export default app;
  