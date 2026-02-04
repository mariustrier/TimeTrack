import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getAnthropicClient } from "./client";
import { checkBudget, trackUsage } from "./cost-tracking";
import { redactContractText } from "./redact-contract";

const EXTRACTION_MODEL = "claude-3-5-haiku-20241022";

const SYSTEM_PROMPT = `You are a contract analysis assistant. Extract key terms from this contract document. Return a JSON object with these fields:
- maxHours: number or null (maximum hours allowed)
- maxBudget: number or null (maximum budget amount)
- budgetCurrency: string or null (currency code like "USD", "DKK", "EUR")
- deadline: string or null (ISO date string if a deadline is mentioned)
- scopeDescription: string or null (brief description of the project scope)
- scopeKeywords: string[] (key topics/technologies mentioned)
- exclusions: string[] (things explicitly excluded from scope)

Return ONLY the JSON object, no other text.`;

const SYSTEM_PROMPT_ANONYMIZED = `You are a contract analysis assistant. Extract key terms from this contract text. The text has been anonymized — entities like [PERSON_1], [COMPANY], [PROJECT_1], [EMAIL_1] etc. are placeholders for redacted information.

Return a JSON object with these fields:
- maxHours: number or null (maximum hours allowed)
- maxBudget: number or null (maximum budget amount)
- budgetCurrency: string or null (currency code like "USD", "DKK", "EUR")
- deadline: string or null (ISO date string if a deadline is mentioned)
- scopeDescription: string or null (brief description of the project scope — use placeholders as-is, do not try to reconstruct original names)
- scopeKeywords: string[] (key topics/technologies mentioned — focus on technical/business keywords, not anonymized entities)
- exclusions: string[] (things explicitly excluded from scope)

Return ONLY the JSON object, no other text.`;

interface ExtractedTerms {
  maxHours: number | null;
  maxBudget: number | null;
  budgetCurrency: string | null;
  deadline: string | null;
  scopeDescription: string | null;
  scopeKeywords: string[];
  exclusions: string[];
}

export async function extractContractTerms(
  contractId: string,
  companyId: string,
  options?: { skipAnonymization?: boolean }
): Promise<ExtractedTerms | { scannedPdf: true } | null> {
  try {
    const budget = await checkBudget(companyId);
    if (!budget.allowed) {
      throw new Error(
        `AI budget exceeded. Daily: ${budget.dailyUsed}/${budget.dailyLimit}, Monthly: ${budget.monthlyUsed}/${budget.monthlyLimit}`
      );
    }

    const contract = await db.contract.findUnique({
      where: { id: contractId },
      include: { project: true },
    });

    if (!contract) {
      throw new Error("Contract not found");
    }

    // Check if anonymization is enabled
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { aiAnonymization: true, name: true },
    });
    const shouldAnonymize = (company?.aiAnonymization ?? true) && !options?.skipAnonymization;

    const fileResponse = await fetch(contract.fileUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch contract file: ${fileResponse.statusText}`);
    }

    const isPdf = contract.fileType === "application/pdf";
    const client = getAnthropicClient();

    let userContent: Anthropic.Messages.ContentBlockParam[];
    let systemPrompt = SYSTEM_PROMPT;

    if (shouldAnonymize && isPdf) {
      // Anonymized PDF path: extract text, redact, send as plain text
      const buffer = Buffer.from(await fileResponse.arrayBuffer());

      // Fetch known names for scrubbing
      const [users, projects] = await Promise.all([
        db.user.findMany({
          where: { companyId, deletedAt: null },
          select: { firstName: true, lastName: true },
        }),
        db.project.findMany({
          where: { companyId },
          select: { name: true },
        }),
      ]);

      const knownNames = {
        companyName: company?.name || "",
        employeeNames: users
          .map((u) => `${u.firstName || ""} ${u.lastName || ""}`.trim())
          .filter((n) => n.length > 0),
        projectNames: projects.map((p) => p.name),
      };

      const redaction = await redactContractText(buffer, knownNames);

      if (redaction.isScannedPdf) {
        return { scannedPdf: true };
      }

      console.log(
        `[AI] Contract redacted: ${redaction.stats.originalLength} chars → ${redaction.redactedText.length} chars, ` +
        `${redaction.stats.chunksKept}/${redaction.stats.chunksTotal} chunks, ${redaction.stats.redactionsApplied} redactions`
      );

      userContent = [
        {
          type: "text",
          text: `Extract the key contract terms from this document:\n\n${redaction.redactedText}`,
        },
      ];
      systemPrompt = SYSTEM_PROMPT_ANONYMIZED;
    } else if (isPdf) {
      // Non-anonymized PDF path: send raw base64
      const buffer = await fileResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      userContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        },
        {
          type: "text",
          text: "Extract the key contract terms from this document.",
        },
      ];
    } else {
      // Text/DOCX path (no anonymization for non-PDF text files)
      const text = await fileResponse.text();

      userContent = [
        {
          type: "text",
          text: `Extract the key contract terms from this document:\n\n${text}`,
        },
      ];
    }

    const response = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const terms: ExtractedTerms = JSON.parse(textBlock.text);

    await db.contract.update({
      where: { id: contractId },
      data: {
        extractedTerms: JSON.parse(JSON.stringify(terms)),
        extractedAt: new Date(),
        maxHours: terms.maxHours,
        maxBudget: terms.maxBudget,
        budgetCurrency: terms.budgetCurrency,
        deadline: terms.deadline ? new Date(terms.deadline) : null,
        scopeDescription: terms.scopeDescription,
        scopeKeywords: terms.scopeKeywords ?? [],
        exclusions: terms.exclusions ?? [],
      },
    });

    await trackUsage(
      companyId,
      "extract-terms",
      EXTRACTION_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    return terms;
  } catch (error) {
    console.error("[AI] Error extracting contract terms:", error);
    throw error;
  }
}
