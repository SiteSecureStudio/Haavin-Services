import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, "dist");
const publicDir = resolve(root, "public");

const imageFiles = [
  {
    pathname: "/brand-assests/renukamala.jpeg",
    source: "brand-assests/renukamala.jpeg",
    contentType: "image/jpeg",
  },
  {
    pathname: "/brand-assests/ameer.jpeg",
    source: "brand-assests/ameer.jpeg",
    contentType: "image/jpeg",
  },
  {
    pathname: "/brand-assests/sutha-nair.jpg",
    source: "brand-assests/sutha-nair.jpg",
    contentType: "image/jpeg",
  },
  {
    pathname: "/og-image.jpg",
    source: "og-image.jpg",
    contentType: "image/jpeg",
  },
  {
    pathname: "/apple-touch-icon.png",
    source: "apple-touch-icon.png",
    contentType: "image/png",
  },
];

// Plain-text files search engines look for at fixed paths.
const textFiles = [
  {
    pathname: "/robots.txt",
    source: "robots.txt",
    contentType: "text/plain; charset=utf-8",
  },
  {
    pathname: "/sitemap.xml",
    source: "sitemap.xml",
    contentType: "application/xml; charset=utf-8",
  },
];

const html = await readFile(resolve(root, "index.html"), "utf8");
const texts = Object.fromEntries(
  await Promise.all(
    textFiles.map(async ({ pathname, source, contentType }) => [
      pathname,
      { body: await readFile(resolve(root, source), "utf8"), contentType },
    ]),
  ),
);
const images = Object.fromEntries(
  await Promise.all(
    imageFiles.map(async ({ pathname, source, contentType }) => [
      pathname,
      {
        body: (await readFile(resolve(root, source))).toString("base64"),
        contentType,
      },
    ]),
  ),
);

const worker = `const html = ${JSON.stringify(html)};
const images = ${JSON.stringify(images)};
const texts = ${JSON.stringify(texts)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let pathname;

    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    if (pathname === "/" || pathname === "/index.html") {
      return new Response(request.method === "HEAD" ? null : html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    const text = texts[pathname];
    if (text) {
      return new Response(request.method === "HEAD" ? null : text.body, {
        headers: {
          "content-type": text.contentType,
          "cache-control": "public, max-age=3600",
        },
      });
    }

    const image = images[pathname];
    if (image) {
      return new Response(
        request.method === "HEAD" ? null : decodeBase64(image.body),
        {
          headers: {
            "content-type": image.contentType,
            "cache-control": "public, max-age=31536000, immutable",
          },
        },
      );
    }

    return new Response("Not found", { status: 404 });
  },
};
`;

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });
await writeFile(resolve(dist, "server/index.js"), worker);
await copyFile(
  resolve(root, ".openai/hosting.json"),
  resolve(dist, ".openai/hosting.json"),
);

await rm(publicDir, { recursive: true, force: true });
await mkdir(resolve(publicDir, "brand-assests"), { recursive: true });
await writeFile(resolve(publicDir, "index.html"), html);
await Promise.all([
  ...imageFiles.map(({ source }) =>
    copyFile(resolve(root, source), resolve(publicDir, source)),
  ),
  ...textFiles.map(({ source }) =>
    copyFile(resolve(root, source), resolve(publicDir, source)),
  ),
]);

console.log("Built Haavin Services for deployment.");
