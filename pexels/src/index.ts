import {
  createProviderHttp,
  httpsUrl,
  parseImageId,
  parseSearch,
  type ProviderOptions,
  type StockImage,
  type StockImageProvider,
} from "@absolutejs/stock-images";
import { z } from "zod";

const photo = z.object({
  id: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: httpsUrl(["www.pexels.com", "pexels.com"]),
  photographer: z.string().min(1),
  photographer_url: httpsUrl(["www.pexels.com", "pexels.com"]),
  alt: z.string().nullish(),
  src: z.object({
    original: httpsUrl(["images.pexels.com"]),
    large2x: httpsUrl(["images.pexels.com"]),
    medium: httpsUrl(["images.pexels.com"]),
  }),
});
const normalize = (item: z.infer<typeof photo>): StockImage => ({
  provider: "pexels",
  id: String(item.id),
  description: item.alt || null,
  width: item.width,
  height: item.height,
  urls: {
    original: item.src.original,
    display: item.src.large2x,
    thumbnail: item.src.medium,
  },
  sourceUrl: item.url,
  photographer: { name: item.photographer, url: item.photographer_url },
  attribution: {
    text: `Photo by ${item.photographer} on Pexels`,
    providerName: "Pexels",
    providerUrl: "https://www.pexels.com",
    required: true,
  },
  license: { name: "Pexels License", url: "https://www.pexels.com/license/" },
  usage: { hotlinkRequired: false, selectionNotificationRequired: false },
});
export const createPexelsProvider = (
  options: ProviderOptions,
): StockImageProvider => {
  const request = createProviderHttp(
    "pexels",
    "https://api.pexels.com",
    options,
    { Authorization: options.apiKey },
  );
  const get = async (id: string, signal?: AbortSignal) =>
    normalize(
      await request(
        new URL(
          `https://api.pexels.com/v1/photos/${parseImageId("pexels", id, /^[1-9][0-9]*$/)}`,
        ),
        photo,
        signal,
      ),
    );
  return {
    id: "pexels",
    name: "Pexels",
    get,
    select: get,
    async search(input, signal) {
      const parsed = parseSearch(input);
      const url = new URL("https://api.pexels.com/v1/search");
      url.searchParams.set("query", parsed.query);
      url.searchParams.set("page", String(parsed.page));
      url.searchParams.set("per_page", String(parsed.perPage));
      if (parsed.orientation)
        url.searchParams.set("orientation", parsed.orientation);
      const data = await request(
        url,
        z.object({
          photos: z.array(photo).max(80),
          page: z.number().int().positive(),
          per_page: z.number().int().positive(),
          total_results: z.number().int().nonnegative(),
        }),
        signal,
      );
      return {
        images: data.photos.map(normalize),
        page: data.page,
        total: data.total_results,
        nextPage:
          data.page * data.per_page < data.total_results ? data.page + 1 : null,
      };
    },
  };
};
