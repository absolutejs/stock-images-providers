import { expect, test } from "bun:test";
import { createPexelsProvider } from "../src/index.js";
const photo = {
  id: 1,
  width: 1200,
  height: 800,
  url: "https://www.pexels.com/photo/test-1/",
  photographer: "Test Person",
  photographer_url: "https://www.pexels.com/@test",
  alt: "A reformer machine",
  src: {
    original: "https://images.pexels.com/photos/1/a.jpg",
    large2x: "https://images.pexels.com/photos/1/a.jpg?w=1000",
    medium: "https://images.pexels.com/photos/1/a.jpg?w=300",
  },
};
test("search preserves metadata, pagination, and server auth", async () => {
  const provider = createPexelsProvider({
    apiKey: "test-key",
    transport: async (url, init) => {
      expect(url.searchParams.get("orientation")).toBe("square");
      expect(init.headers).toEqual({ Authorization: "test-key" });
      return Response.json({
        photos: [photo],
        page: 1,
        per_page: 12,
        total_results: 13,
      });
    },
  });
  const result = await provider.search({
    query: "reformer",
    orientation: "square",
  });
  expect(result.nextPage).toBe(2);
  expect(result.images[0]).toMatchObject({
    description: "A reformer machine",
    urls: { original: photo.src.original },
    attribution: { required: true },
  });
});
test("rejects missing key, path injection, unexpected image host and upstream errors", async () => {
  expect(() => createPexelsProvider({ apiKey: "" })).toThrow("unauthorized");
  let calls = 0;
  const provider = createPexelsProvider({
    apiKey: "key",
    transport: async () => {
      calls++;
      return Response.json({
        ...photo,
        src: { ...photo.src, original: "https://evil.example/x" },
      });
    },
  });
  await expect(provider.get("../secrets")).rejects.toThrow("invalid_input");
  expect(calls).toBe(0);
  await expect(provider.get("1")).rejects.toThrow("invalid_response");
  const limited = createPexelsProvider({
    apiKey: "key",
    transport: async () =>
      new Response("secret upstream body", {
        status: 429,
        headers: { "retry-after": "30" },
      }),
  });
  await expect(limited.search({ query: "test" })).rejects.toMatchObject({
    code: "rate_limited",
    retryAfterSeconds: 30,
  });
});
