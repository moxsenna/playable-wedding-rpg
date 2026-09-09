// M16 CSV guest import: reusable parser + validation layer (no React here).
// Robust against BOM, header row, blank rows, quoted commas, dupes, missing names.
import { guestImportRowSchema, type GuestImportRow } from "@wedding-rpg/contracts";

export interface CsvParseOk {
  rowNumber: number;
  row: GuestImportRow;
}

export interface CsvRejected {
  rowNumber: number;
  reason: string;
  raw: string;
}

export interface CsvParseResult {
  valid: CsvParseOk[];
  rejected: CsvRejected[];
  skippedBlank: number;
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/^\uFEFF/, "");
}

const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  nama: "name",
  guest: "name",
  guest_name: "name",
  fullname: "name",
  "full name": "name",
  phone: "phone",
  tel: "phone",
  telepon: "phone",
  no_hp: "phone",
  email: "email",
  e_mail: "email",
  group: "group",
  grup: "group",
  category: "group",
  notes: "notes",
  note: "notes",
  catatan: "notes",
};

export function parseGuestCsv(input: string): CsvParseResult {
  const text = stripBom(input).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  const valid: CsvParseOk[] = [];
  const rejected: CsvRejected[] = [];
  let skippedBlank = 0;
  const seenNames = new Set<string>();

  let startIdx = 0;
  let colIndex: Record<string, number> = { name: 0 };
  if (lines.length > 0) {
    const first = splitCsvLine(lines[0]).map(normalizeHeader);
    const mapped = first.map((h) => HEADER_ALIASES[h] ?? "");
    const hasName = mapped.includes("name");
    const looksLikeHeader =
      hasName || first.some((h) => ["phone", "email", "group", "notes", "nama"].includes(h));
    if (looksLikeHeader && hasName) {
      startIdx = 1;
      colIndex = {};
      mapped.forEach((m, i) => {
        if (m && colIndex[m] === undefined) colIndex[m] = i;
      });
    } else if (looksLikeHeader && !hasName) {
      // Header without a name column: every data row is rejected, not silently shifted.
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim().length === 0) {
          skippedBlank++;
          continue;
        }
        rejected.push({ rowNumber: i + 1, reason: "missing name column in header", raw: lines[i].slice(0, 120) });
      }
      return { valid, rejected, skippedBlank };
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) {
      // Ignore a single trailing newline as "no row"; count interior blanks.
      if (i !== lines.length - 1) skippedBlank++;
      continue;
    }
    const cols = splitCsvLine(line);
    const rowNumber = i + 1;
    const get = (key: string): string => {
      const idx = colIndex[key];
      if (idx === undefined) return "";
      return (cols[idx] ?? "").trim();
    };
    // Headerless single-column CSV: colIndex={name:0} already handles it.
    const candidate = {
      name: get("name"),
      phone: get("phone") || undefined,
      email: get("email") || undefined,
      group: get("group") || undefined,
      notes: get("notes") || undefined,
    };
    if (!candidate.name) {
      rejected.push({ rowNumber, reason: "missing name", raw: line.slice(0, 120) });
      continue;
    }
    const parsed = guestImportRowSchema.safeParse(candidate);
    if (!parsed.success) {
      rejected.push({
        rowNumber,
        reason: parsed.error.issues[0]?.message ?? "invalid row",
        raw: line.slice(0, 120),
      });
      continue;
    }
    const key = parsed.data.name.toLowerCase();
    if (seenNames.has(key)) continue; // intra-file dupe: skip, not reject
    seenNames.add(key);
    valid.push({ rowNumber, row: parsed.data });
  }
  return { valid, rejected, skippedBlank };
}
