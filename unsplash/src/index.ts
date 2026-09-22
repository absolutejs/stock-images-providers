import {
  createProviderHttp,
  httpsUrl,
  parseImageId,
  parseSearch,
  StockImageError,
  type ProviderOptions,
  type StockImage,
  type StockImageProvider,
} from "@absolutejs/stock-images";
import { z } from "zod";

const photo = z.object({
  id: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  description: z.string().nullish(),
  alt_description: z.string().nullish(),
  urls: z.object({
    raw: httpsUrl(["images.unsplash.com"]),
    regular: httpsUrl(["images.unsplash.com"]),
    small: httpsUrl(["images.unsplash.com"]),
  }),
  links: z.object({
    html: httpsUrl(["unsplash.com"]),
    download_location: httpsUrl(["api.unsplash.com"]),
  }),
  user: z.object({
    name: z.string().min(1),
    links: z.object({ html: httpsUrl(["unsplash.com"]) }),
  }),
});
export interface UnsplashOptions extends ProviderOptions {
  appName: string;
}
export const createUnsplashProvider = (
  options: UnsplashOptions,
): StockImageProvider => {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(options.appName))
    throw new StockImageError("unsplash", "invalid_input");
  const request = createProviderHttp(
    "unsplash",
    "https://api.unsplash.com",
    options,
    { Authorization: `Client-ID ${options.apiKey}`, "Accept-Version": "v1" },
  );
  const attributed = (value: string) => {
    const url = new URL(value);
    url.searchParams.set("utm_source", options.appName);
    url.searchParams.set("utm_medium", "referral");
    return url.href;
  };
  const normalize = (item: z.infer<typeof photo>): StockImage => ({
    provider: "unsplash",
    id: item.id,
    description: item.alt_description || item.description || null,
    width: item.width,
    height: item.height,
    urls: {
      original: item.urls.raw,
      display: item.urls.regular,
      thumbnail: item.urls.small,
    },
    sourceUrl: attributed(item.links.html),
    photographer: {
      name: item.user.name,
      url: attributed(item.user.links.html),
    },
    attribution: {
      text: `Photo by ${item.user.name} on Unsplash`,
      providerName: "Unsplash",
      providerUrl: attributed("https://unsplash.com"),
      required: true,
    },
    license: {
      name: "Unsplash License and API Guidelines",
      url: "https://unsplash.com/license",
    },
    usage: { hotlinkRequired: true, selectionNotificationRequired: true },
  });
  const read = (id: string, signal?: AbortSignal) =>
    request(
      new URL(
        `https://api.unsplash.com/photos/${parseImageId("unsplash", id, /^[a-zA-Z0-9_-]+$/)}`,
      ),
      photo,
      signal,
    );
  return {
    id: "unsplash",
    name: "Unsplash",
    get: async (id, signal) => normalize(await read(id, signal)),
    async select(id, signal) {
      const item = await read(id, signal);
      const download = new URL(item.links.download_location);
      if (item.id !== id || download.pathname !== `/photos/${id}/download`)
        throw new StockImageError("unsplash", "invalid_response");
      await request(
        download,
        z.object({ url: httpsUrl(["images.unsplash.com"]) }),
        signal,
      );
      return normalize(item);
    },
    async search(input, signal) {
      const parsed = parseSearch(input);
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", parsed.query);
      url.searchParams.set("page", String(parsed.page));
      url.searchParams.set("per_page", String(parsed.perPage));
      url.searchParams.set("content_filter", "high");
      if (parsed.orientation)
        url.searchParams.set(
          "orientation",
          parsed.orientation === "square" ? "squarish" : parsed.orientation,
        );
      const data = await request(
        url,
        z.object({
          results: z.array(photo).max(30),
          total: z.number().int().nonnegative(),
          total_pages: z.number().int().nonnegative(),
        }),
        signal,
      );
      return {
        images: data.results.map(normalize),
        page: parsed.page,
        nextPage: parsed.page < data.total_pages ? parsed.page + 1 : null,
        total: data.total,
      };
    },
  };
};
