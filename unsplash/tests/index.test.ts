import { expect, test } from "bun:test";
import { createUnsplashProvider } from "../src/index.js";
const photo = {
  id: "abc",
  width: 1200,
  height: 800,
  alt_description: "Pilates equipment",
  description: null,
  urls: {
    raw: "https://images.unsplash.com/photo-abc?ixid=keep",
    regular: "https://images.unsplash.com/photo-abc?w=1000&ixid=keep",
    small: "https://images.unsplash.com/photo-abc?w=300&ixid=keep",
  },
  links: {
    html: "https://unsplash.com/photos/abc",
    download_location: "https://api.unsplash.com/photos/abc/download?ixid=keep",
  },
  user: { name: "Test Person", links: { html: "https://unsplash.com/@test" } },
};
test("search hotlinks exact API URLs, maps square and includes attribution", async () => {
  const provider = createUnsplashProvider({
    apiKey: "key",
    appName: "absolutejs",
    transport: async (url, init) => {
      expect(url.searchParams.get("orientation")).toBe("squarish");
      expect(init.headers).toMatchObject({ Authorization: "Client-ID key" });
      return Response.json({ results: [photo], total: 2, total_pages: 2 });
    },
  });
  const result = await provider.search({
    query: "Pilates",
    orientation: "square",
  });
  expect(result.nextPage).toBe(2);
  expect(result.images[0]?.urls.display).toBe(photo.urls.regular);
  expect(result.images[0]?.photographer.url).toContain("utm_source=absolutejs");
  expect(result.images[0]?.usage.selectionNotificationRequired).toBe(true);
});
test("only selection tracks download and preserves returned query", async () => {
  const urls: string[] = [];
  const provider = createUnsplashProvider({
    apiKey: "key",
    appName: "absolutejs",
    transport: async (url) => {
      urls.push(url.href);
      return Response.json(
        url.pathname.endsWith("/download") ? { url: photo.urls.raw } : photo,
      );
    },
  });
  await provider.get("abc");
  expect(urls).toHaveLength(1);
  await provider.select("abc");
  expect(urls).toHaveLength(3);
  expect(urls[2]).toBe(photo.links.download_location);
});
test("failed tracking prevents selection and hostile tracking paths never receive auth", async () => {
  let calls = 0;
  const provider = createUnsplashProvider({
    apiKey: "key",
    appName: "absolutejs",
    transport: async () => {
      calls++;
      return Response.json({
        ...photo,
        links: {
          ...photo.links,
          download_location: "https://api.unsplash.com/other",
        },
      });
    },
  });
  await expect(provider.select("abc")).rejects.toThrow("invalid_response");
  expect(calls).toBe(1);
  const failing = createUnsplashProvider({
    apiKey: "key",
    appName: "absolutejs",
    transport: async (url) =>
      url.pathname.endsWith("/download")
        ? new Response("", { status: 500 })
        : Response.json(photo),
  });
  await expect(failing.select("abc")).rejects.toThrow("unavailable");
});
