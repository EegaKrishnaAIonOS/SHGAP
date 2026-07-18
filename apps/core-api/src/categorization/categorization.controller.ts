import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CategorizationService,
  CategorySuggestion,
} from './categorization.service';
import { CategorizeRequestDto } from './dto/categorize-request.dto';

@ApiTags('categorization')
@ApiBearerAuth()
@Controller('categorization')
export class CategorizationController {
  constructor(private readonly categorizationService: CategorizationService) {}

  @Post('suggest')
  @ApiOperation({
    summary:
      'Suggest up to 3 taxonomy categories for a product name/description',
    description:
      'A prefill hint for the product form only — the category picker remains fully user-editable. Returns an empty list if ml-services is unreachable or no suggestion clears the confidence floor.',
  })
  suggest(@Body() dto: CategorizeRequestDto): Promise<CategorySuggestion[]> {
    return this.categorizationService.suggest(dto.name, dto.description);
  }
}
