import { handle } from "hono/vercel";
import app from "../backend/hono";

export default handle(app);
