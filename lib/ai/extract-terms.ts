import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getAnthropicClient } from "./client";
import { checkBudget, trackUsage } from "./cost-tracking";

const EXTRACTION_MODEL = "claude-3-haiku-20241022";

const SYSTEM_PROMPT = `You are a contract analysis assistant. Extract key terms from this contract document. Return a JSON object with these fields:
- maxHours: number or null (maximum hours allowed)
- maxBudget: number or null (maximum budget amount)
- budgetCurrency: string or null (currency code like "USD", "DKK", "EUR")
- deadline: string or null (ISO date string if a deadline is mentioned)
- scopeDescription: string or null (brief description of the project scope)
- scopeKeywords: string[] (key topics/technologies mentioned)
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
  companyId: string
) {
  try {
    const budget = await checkBudget(companyId);
    if (!budget.allowed) {
      console.log(
        `[AI] Budget exceeded for company ${companyId}. Daily: ${budget.dailyUsed}/${budget.dailyLimit}, Monthly: ${budget.monthlyUsed}/${budget.monthlyLimit}`
      );
      return null;
    }

    const contract = await db.contract.findUnique({
      where: { id: contractId },
      include: { project: true },
    });

    if (!contract) {
      console.error(`[AI] Contract ${contractId} not found`);
      return null;
    }

    const fileResponse = await fetch(contract.fileUrl);
    if (!fileResponse.ok) {
      console.error(
        `[AI] Failed to fetch contract file: ${fileResponse.statusText}`
      );
      return null;
    }

    const isPdf = contract.fileType === "application/pdf";

    const client = getAnthropicClient();

    let userContent: Anthropic.Messages.ContentBlockParam[];

    if (isPdf) {
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
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error("[AI] No text response from Claude");
      return null;
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
    return null;
  }
}
