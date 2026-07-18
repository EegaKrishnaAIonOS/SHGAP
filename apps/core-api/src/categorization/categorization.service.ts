import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  parentCategoryName: string | null;
  score: number;
}

/**
 * Proxies to ml-services' `/categorize` (T08) — not exposed to the frontend
 * directly, matching the T01 container diagram (web -> core-api -> ml
 * services). Best-effort like ReverseGeocodeService: if ml-services is
 * unreachable or errors, returns an empty suggestion list rather than
 * failing product creation, since the category picker built in T07 already
 * requires an explicit, FK-validated categoryId regardless of what this
 * returns — these are prefill hints only.
 */
@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('ML_SERVICES_URL');
  }

  async suggest(
    name: string,
    description: string | undefined,
  ): Promise<CategorySuggestion[]> {
    try {
      const response = await fetch(`${this.baseUrl}/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description ?? null }),
      });
      if (!response.ok) {
        this.logger.warn(`ml-services /categorize returned ${response.status}`);
        return [];
      }
      const body = (await response.json()) as {
        suggestions: Array<{
          category_id: string;
          category_name: string;
          parent_category_name: string | null;
          score: number;
        }>;
      };
      return body.suggestions.map((s) => ({
        categoryId: s.category_id,
        categoryName: s.category_name,
        parentCategoryName: s.parent_category_name,
        score: s.score,
      }));
    } catch (err) {
      this.logger.warn(
        `ml-services /categorize unreachable: ${(err as Error).message}`,
      );
      return [];
    }
  }
}
