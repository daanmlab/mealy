import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { Unit } from '@prisma/client';

@Injectable()
export class ConversionService {
  private readonly logger = new Logger(ConversionService.name);
  private readonly openai: OpenAI | null;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env['OPENAI_API_KEY'];
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  /**
   * Converts `amount` from one unit to another using the stored conversion factor.
   * Returns null if no conversion exists between the two units.
   */
  async convert(
    amount: number,
    fromUnitId: string,
    toUnitId: string,
  ): Promise<number | null> {
    if (fromUnitId === toUnitId) return amount;
    const conversion = await this.prisma.unitConversion.findUnique({
      where: { fromUnitId_toUnitId: { fromUnitId, toUnitId } },
    });
    if (!conversion) return null;
    return amount * conversion.factor;
  }

  /**
   * Ensures a conversion between two units exists in the DB.
   * If not found, asks the LLM to determine the factor (universal conversions only).
   * Saves the result for future use (progressive fill).
   * No-ops if OPENAI_API_KEY is not set.
   */
  async ensureConversion(fromUnit: Unit, toUnit: Unit): Promise<void> {
    if (fromUnit.id === toUnit.id) return;

    const existing = await this.prisma.unitConversion.findUnique({
      where: {
        fromUnitId_toUnitId: { fromUnitId: fromUnit.id, toUnitId: toUnit.id },
      },
    });
    if (existing) return;

    if (!this.openai) return;

    try {
      const factor = await this.askLlmForFactor(fromUnit.symbol, toUnit.symbol);
      if (factor === null) return;

      await this.prisma.unitConversion.createMany({
        data: [
          { fromUnitId: fromUnit.id, toUnitId: toUnit.id, factor },
          { fromUnitId: toUnit.id, toUnitId: fromUnit.id, factor: 1 / factor },
        ],
        skipDuplicates: true,
      });
      this.logger.log(
        `Progressive fill: ${fromUnit.symbol} ↔ ${toUnit.symbol} (×${factor})`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to get conversion for ${fromUnit.symbol}→${toUnit.symbol}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async askLlmForFactor(
    fromSymbol: string,
    toSymbol: string,
  ): Promise<number | null> {
    if (!this.openai) return null;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: `Is there a universal, ingredient-independent conversion factor between the cooking unit "${fromSymbol}" and "${toSymbol}"?

Return: { "factor": <number> } if convertible, or { "factor": null } if not (density-dependent or incompatible measurement types).

Examples of valid: tsp→tbsp (0.333), g→oz (0.035274), ml→cup (0.004167)
Examples of invalid: g→cup (density-dependent), cloves→g (incompatible)`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as { factor: number | null };
    return typeof parsed.factor === 'number' ? parsed.factor : null;
  }
}
