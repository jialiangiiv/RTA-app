import { Router } from "express";
import { usersRouter } from "./users";
import { projectsRouter } from "./projects";
import { researchQuestionsRouter } from "./researchQuestions";
import { interviewQuestionsRouter } from "./interviewQuestions";
import { transcriptsRouter } from "./transcripts";
import { bookmarksRouter } from "./bookmarks";
import { codebooksRouter } from "./codebooks";
import { qualitativeCodesRouter } from "./qualitativeCodes";
import { codedExcerptsRouter } from "./codedExcerpts";

export const apiRouter = Router();

apiRouter.use("/users", usersRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/research-questions", researchQuestionsRouter);
apiRouter.use("/interview-questions", interviewQuestionsRouter);
apiRouter.use("/transcripts", transcriptsRouter);
apiRouter.use("/bookmarks", bookmarksRouter);
apiRouter.use("/codebooks", codebooksRouter);
apiRouter.use("/qualitative-codes", qualitativeCodesRouter);
apiRouter.use("/coded-excerpts", codedExcerptsRouter);
