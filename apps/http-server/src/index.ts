import cors from "cors";
import "dotenv/config";
import express from "express";
import { studentRouter } from "./routes/student";
import { adminRouter } from "./routes/admin";

const app = express();
app.use(express.json());
app.use(cors());

app.use("/student", studentRouter);
app.use("/admin", adminRouter);

app.listen(3001);
