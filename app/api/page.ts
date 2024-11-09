import { Hono } from "hono";
import { handle } from "hono/vercel";
import { app } from "./app";

export const runtime = "edge";

export const GET = handle(app);
export const POST = handle(app);
