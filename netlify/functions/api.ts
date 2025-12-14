import type { Context } from "@netlify/functions";
import app from "../../backend/hono";

export default async (req: Request, context: Context) => {
  return app.fetch(req, { netlifyContext: context });
};