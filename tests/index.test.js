import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index.js";
let server;

describe("index.js", () => {
  beforeAll(async () => {
    server = app.listen(0);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("responds to GET / with status ok", async () => {
    const res = await request(server).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});
