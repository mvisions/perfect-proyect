import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const projectRoot = new URL(".", import.meta.url).pathname;
const themes = [
  {
    id: "gardening",
    search: "city park garden flowers filemime:image/jpeg",
    relevant: /garden|park|flower|plant|community/i,
    exclude: /watercolou?r|painting|botanic.*butterfly/i
  },
  {
    id: "transport",
    search: "public transit city bus in service bus filemime:image/jpeg",
    relevant: /bus|transit|transport/i,
    exclude: /map|clock|stop sign|logo/i
  },
  {
    id: "sports",
    exclude: /logo|poster|diagram|map|stadium exterior/i,
    monthlySearches: [
      { label: "Fútbol", search: "association football match player filemime:image/jpeg", relevant: /football|soccer/i },
      { label: "Baloncesto", search: "basketball game player filemime:image/jpeg", relevant: /basketball/i },
      { label: "Tenis", search: "tennis match player filemime:image/jpeg", relevant: /tennis/i },
      { label: "Natación", search: "competitive swimming race filemime:image/jpeg", relevant: /swimming|swimmer/i },
      { label: "Atletismo", search: "athletics track field race filemime:image/jpeg", relevant: /athletics|track and field/i },
      { label: "Ciclismo", search: "cycling road race cyclist filemime:image/jpeg", relevant: /cycling|cyclist/i },
      { label: "Voleibol", search: "volleyball match player filemime:image/jpeg", relevant: /volleyball/i },
      { label: "Rugby", search: "rugby match player filemime:image/jpeg", relevant: /rugby/i },
      { label: "Béisbol", search: "baseball game player filemime:image/jpeg", relevant: /baseball/i },
      { label: "Gimnasia", search: "gymnastics competition filemime:image/jpeg", relevant: /gymnastics|gymnast/i },
      { label: "Boxeo", search: "boxing match boxer filemime:image/jpeg", relevant: /boxing|boxer/i },
      { label: "Esquí", search: "skiing race skier filemime:image/jpeg", relevant: /skiing|skier/i }
    ]
  },
  {
    id: "animals",
    exclude: /logo|diagram|map|statue|toy/i,
    monthlySearches: [
      { label: "Gatos", search: "cat animal filemime:image/jpeg", relevant: /\bcat\b|cats|feline/i },
      { label: "Perros", search: "dog animal filemime:image/jpeg", relevant: /\bdog\b|dogs|canine/i },
      { label: "Caballos", search: "horse animal filemime:image/jpeg", relevant: /\bhorse\b|horses|equine/i },
      { label: "Elefantes", search: "elephant animal filemime:image/jpeg", relevant: /elephant/i },
      { label: "Leones", search: "lion animal filemime:image/jpeg", relevant: /\blion\b|lions/i },
      { label: "Aves", search: "bird wildlife filemime:image/jpeg", relevant: /\bbird\b|birds|avian/i },
      { label: "Delfines", search: "dolphin animal filemime:image/jpeg", relevant: /dolphin/i },
      { label: "Osos", search: "bear wildlife filemime:image/jpeg", relevant: /\bbear\b|bears/i },
      { label: "Zorros", search: "fox wildlife filemime:image/jpeg", relevant: /\bfox\b|foxes/i },
      { label: "Ciervos", search: "deer wildlife filemime:image/jpeg", relevant: /\bdeer\b/i },
      { label: "Tigres", search: "tiger animal filemime:image/jpeg", relevant: /tiger/i },
      { label: "Pingüinos", search: "penguin animal filemime:image/jpeg", relevant: /penguin/i }
    ]
  },
  {
    id: "school",
    search: "school children classroom filemime:image/jpeg",
    relevant: /school|classroom|student|pupil|child/i,
    exclude: /logo|building|stadium/i
  },
  {
    id: "security",
    search: "police officers street filemime:image/jpeg",
    relevant: /police|officer|security|guard|patrol/i,
    exclude: /insignia|badge|logo|rank/i
  }
];

const allowedLicense = /^(Public domain|CC0|CC BY(?:-SA)? \d(?:\.\d)?)$/i;
const sourcesPath = join(projectRoot, "assets", "background-themes", "SOURCES.json");
let credits = {};
try {
  credits = JSON.parse(await readFile(sourcesPath, "utf8"));
} catch {}
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function downloadImage(url, originalUrl, title) {
  const alternateThumbnailUrl = url.replace(
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/"
  );
  const imageUrls = [...new Set([url, alternateThumbnailUrl, originalUrl])];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let response;
    try {
      response = await fetch(imageUrls[Math.min(attempt, imageUrls.length - 1)], {
        headers: { "User-Agent": "MemoriaLaboral/1.0 (background asset download)" },
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      if (attempt === 4) throw new Error(`Image request timed out: ${title}`, { cause: error });
      await wait(2000 * (attempt + 1));
      continue;
    }
    if (response.ok) return response;
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Image download failed: ${title} (${response.status})`);
    }

    await response.body?.cancel();
    const retryAfter = Number(response.headers.get("Retry-After"));
    await wait(retryAfter > 0 ? Math.min(retryAfter * 1000, 10000) : 2000 * (attempt + 1));
  }
  throw new Error(`Image download kept failing after retries: ${title}`);
}

async function searchPages(theme, search) {
  const parameters = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: search,
    gsrnamespace: "6",
    gsrlimit: "50",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
    format: "json"
  });
  let response;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      response = await fetch(`https://commons.wikimedia.org/w/api.php?${parameters}`, {
        headers: { "User-Agent": "MemoriaLaboral/1.0 (background asset download)" },
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      if (attempt === 5) throw new Error(`Commons search timed out for ${theme.id}`, { cause: error });
      await wait(3000 * (attempt + 1));
      continue;
    }

    if (response.ok) break;
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Commons search failed for ${theme.id}: ${response.status}`);
    }

    await response.body?.cancel();
    const retryAfter = Number(response.headers.get("Retry-After"));
    await wait(retryAfter > 0 ? retryAfter * 1000 : 5000 * (attempt + 1));
  }
  if (!response?.ok) throw new Error(`Commons search failed for ${theme.id}: ${response?.status || "timeout"}`);

  const data = await response.json();
  return Object.values(data.query?.pages || {}).sort((first, second) => first.index - second.index);
}

function isSuitablePhoto(page, theme, relevant) {
  const info = page.imageinfo?.[0];
  const license = info?.extmetadata?.LicenseShortName?.value || "";
  const imageUrl = info?.thumburl || "";
  const searchableText = `${page.title} ${info?.extmetadata?.ImageDescription?.value || ""}`;
  return /\.jpe?g(?:$|\?)/i.test(imageUrl)
    && allowedLicense.test(license)
    && relevant.test(searchableText)
    && !theme.exclude.test(page.title);
}

async function searchTheme(theme) {
  if (theme.monthlySearches) {
    const selected = [];
    const selectedPageIds = new Set();

    for (const monthlySearch of theme.monthlySearches) {
      const candidates = await searchPages(theme, monthlySearch.search);
      const photo = candidates.find((page) => (
        !selectedPageIds.has(page.pageid)
        && isSuitablePhoto(page, theme, monthlySearch.relevant)
      ));
      if (!photo) {
        throw new Error(`${theme.id}: no suitable licensed photo found for ${monthlySearch.label}`);
      }
      selected.push(photo);
      selectedPageIds.add(photo.pageid);
      await wait(2200);
    }
    return selected;
  }

  const pages = await searchPages(theme, theme.search);
  const selected = pages.filter((page) => isSuitablePhoto(page, theme, theme.relevant)).slice(0, 12);

  if (selected.length < 12) {
    throw new Error(`${theme.id}: found only ${selected.length} suitable licensed photos, expected 12`);
  }
  return selected;
}

for (const theme of themes) {
  const directory = join(projectRoot, "assets", "background-themes", theme.id);
  await mkdir(directory, { recursive: true });
  const completeCredits = credits[theme.id]?.length === 12;
  const completeFiles = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
    try {
      return (await stat(join(directory, `month-${String(index + 1).padStart(2, "0")}.jpg`))).size > 0;
    } catch {
      return false;
    }
  }));
  if (completeCredits && completeFiles.every(Boolean)) {
    console.log(`${theme.id}: 12 photos already present`);
    continue;
  }

  const pages = await searchTheme(theme);
  credits[theme.id] = [];

  for (const [index, page] of pages.entries()) {
    const info = page.imageinfo[0];
    const filename = `month-${String(index + 1).padStart(2, "0")}.jpg`;
    const path = join(directory, filename);
    let fileExists = false;
    try {
      fileExists = (await stat(path)).size > 0;
    } catch {}

    if (!fileExists) {
      const response = await downloadImage(info.thumburl, info.url, page.title);
      const image = Buffer.from(await response.arrayBuffer());
      await writeFile(path, image);
    }

    credits[theme.id].push({
      month: index + 1,
      file: `assets/background-themes/${theme.id}/${filename}`,
      title: page.title.replace(/^File:/, ""),
      subject: theme.monthlySearches?.[index]?.label || null,
      source: info.descriptionurl,
      author: info.extmetadata?.Artist?.value || "Unknown author",
      license: info.extmetadata?.LicenseShortName?.value || "",
      licenseUrl: info.extmetadata?.LicenseUrl?.value || ""
    });
    if (!fileExists) await wait(1200);
  }
  console.log(`${theme.id}: downloaded ${credits[theme.id].length} photos`);
  await writeFile(sourcesPath, `${JSON.stringify(credits, null, 2)}\n`);
}

await mkdir(dirname(sourcesPath), { recursive: true });
await writeFile(sourcesPath, `${JSON.stringify(credits, null, 2)}\n`);