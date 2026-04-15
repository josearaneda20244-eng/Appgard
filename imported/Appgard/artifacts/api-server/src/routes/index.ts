import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import roundsRouter from "./rounds";
import checkpointsRouter from "./checkpoints";
import incidentsRouter from "./incidents";
import messagesRouter from "./messages";
import panicRouter from "./panic";
import locationRouter from "./location";
import dashboardRouter from "./dashboard";
import seedRouter from "./seed";
import companiesRouter from "./companies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(roundsRouter);
router.use(checkpointsRouter);
router.use(incidentsRouter);
router.use(messagesRouter);
router.use(panicRouter);
router.use(locationRouter);
router.use(dashboardRouter);
router.use(seedRouter);
router.use(companiesRouter);

export default router;
