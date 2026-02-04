import { PDFParse } from "pdf-parse";

// --- Types ---

export interface KnownNames {
  companyName: string;
  employeeNames: string[];
  projectNames: string[];
}

export interface RedactionResult {
  redactedText: string;
  isScannedPdf: boolean;
  stats: {
    originalLength: number;
    chunksKept: number;
    chunksTotal: number;
    redactionsApplied: number;
  };
}

// --- Keyword groups for chunk scoring ---

const KEYWORD_GROUPS: Record<string, string[]> = {
  budget: ["budget", "fee", "cap", "invoice", "cost", "price", "payment", "rate", "compensation", "amount", "billing", "remuneration"],
  hours: ["hours", "hourly", "maximum", "limit", "time", "duration", "period", "man-hours", "work hours", "working hours"],
  deadline: ["deadline", "term", "expires", "expiration", "termination", "completion", "delivery", "effective date", "commencement"],
  scope: ["scope", "services", "deliverables", "obligations", "responsibilities", "shall", "undertake", "perform", "provide"],
  exclusions: ["exclusion", "excluded", "not included", "limitation", "restriction", "shall not", "does not include", "outside scope"],
};

// --- Regex patterns for PII ---

const PII_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: "CPR", regex: /\b\d{6}-\d{4}\b/g },
  { name: "IBAN", regex: /\b[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{0,4}[\s]?\d{0,2}\b/g },
  { name: "CVR", regex: /\bDK[\s-]?\d{8}\b/gi },
  { name: "POSTAL", regex: /\b\d{4}\s+[A-ZÆØÅ][a-zæøåA-ZÆØÅ]+\b/g },
  // PHONE last — it's the most greedy and would otherwise match IBAN/CVR/CPR patterns
  { name: "PHONE", regex: /(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g },
];

// --- Core functions ---

export function splitIntoChunks(text: string): string[] {
  // Split by double newlines, numbered sections (1. 2. etc), or section-like headings
  const raw = text.split(/\n{2,}|(?=\n\d+[.)]\s)|(?=\n[A-Z][A-Z\s]{2,}:?\n)/);
  return raw
    .map((c) => c.trim())
    .filter((c) => c.length > 20); // drop very short fragments
}

export function scoreChunk(chunk: string): number {
  const lower = chunk.toLowerCase();
  let score = 0;
  for (const keywords of Object.values(KEYWORD_GROUPS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score++;
      }
    }
  }
  return score;
}

export function selectRelevantChunks(chunks: string[], maxChunks: number = 12): string[] {
  if (chunks.length <= 15) return chunks; // small contract, keep all

  const scored = chunks.map((chunk, index) => ({ chunk, index, score: scoreChunk(chunk) }));
  scored.sort((a, b) => b.score - a.score);

  // Keep top N scored chunks
  const selected = scored.slice(0, maxChunks);

  // Sort back by original order so the text reads naturally
  selected.sort((a, b) => a.index - b.index);

  return selected.map((s) => s.chunk);
}

export function scrubPii(text: string): { scrubbed: string; count: number } {
  let result = text;
  let totalCount = 0;
  const counters: Record<string, number> = {};

  for (const { name, regex } of PII_PATTERNS) {
    // Reset regex lastIndex for global patterns
    regex.lastIndex = 0;
    const seen = new Map<string, string>(); // original → placeholder (deterministic)

    result = result.replace(regex, (match) => {
      // Skip pure numbers that are likely amounts/hours (4-6 digit numbers without context)
      if (name === "PHONE" && /^\d{4,6}$/.test(match.trim())) {
        return match;
      }

      if (seen.has(match)) {
        return seen.get(match)!;
      }

      counters[name] = (counters[name] || 0) + 1;
      const placeholder = `[${name}_${counters[name]}]`;
      seen.set(match, placeholder);
      totalCount++;
      return placeholder;
    });
  }

  return { scrubbed: result, count: totalCount };
}

export function scrubKnownNames(text: string, names: KnownNames): { scrubbed: string; count: number } {
  let result = text;
  let count = 0;

  // Build replacement pairs, longest first
  const replacements: [string, string][] = [];

  if (names.companyName) {
    replacements.push([names.companyName, "[COMPANY]"]);
  }

  const personCounter = { n: 0 };
  const personMap = new Map<string, string>();

  // Assign numbers per full employee name; partial names share the same number
  for (const name of names.employeeNames) {
    personCounter.n++;
    const placeholder = `[PERSON_${personCounter.n}]`;
    personMap.set(name, placeholder);
    replacements.push([name, placeholder]);

    // Add partial names (first/last) with the SAME number as the full name
    const parts = name.split(/\s+/);
    if (parts.length > 1) {
      for (const part of parts) {
        if (part.length >= 3 && !personMap.has(part)) {
          personMap.set(part, placeholder);
          replacements.push([part, placeholder]);
        }
      }
    }
  }

  const projectCounter = { n: 0 };
  for (const name of names.projectNames) {
    projectCounter.n++;
    replacements.push([name, `[PROJECT_${projectCounter.n}]`]);
  }

  // Sort longest first to prevent partial matches
  replacements.sort((a, b) => b[0].length - a[0].length);

  for (const [from, to] of replacements) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
      count++;
    }
  }

  return { scrubbed: result, count };
}

export async function redactContractText(
  pdfBuffer: Buffer,
  knownNames: KnownNames
): Promise<RedactionResult> {
  // A. Extract text
  const parser = new PDFParse({ data: pdfBuffer });
  const textResult = await parser.getText();
  await parser.destroy();
  const rawText = textResult.text || "";
  const numPages = textResult.total || 1;

  // Check for scanned PDF (low text density)
  const density = rawText.length / numPages;
  if (density < 100) {
    return {
      redactedText: "",
      isScannedPdf: true,
      stats: { originalLength: rawText.length, chunksKept: 0, chunksTotal: 0, redactionsApplied: 0 },
    };
  }

  // B. Chunk and score
  const allChunks = splitIntoChunks(rawText);
  const relevantChunks = selectRelevantChunks(allChunks);
  let text = relevantChunks.join("\n\n");

  // C. Regex PII scrubbing
  const piiResult = scrubPii(text);
  text = piiResult.scrubbed;

  // D. Known-name replacement
  const nameResult = scrubKnownNames(text, knownNames);
  text = nameResult.scrubbed;

  return {
    redactedText: text,
    isScannedPdf: false,
    stats: {
      originalLength: rawText.length,
      chunksKept: relevantChunks.length,
      chunksTotal: allChunks.length,
      redactionsApplied: piiResult.count + nameResult.count,
    },
  };
}
