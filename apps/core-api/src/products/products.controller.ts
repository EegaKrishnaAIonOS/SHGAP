import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentScope } from '../common/decorators/current-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ScopeGuard } from '../common/guards/scope.guard';
import {
  JwtAccessPayload,
  RequestScope,
} from '../common/interfaces/jwt-payload.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { NearbyProductQueryDto } from './dto/nearby-product-query.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductImagesService } from './images/product-images.service';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productImagesService: ProductImagesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Add a product to the caller's SHG (owner or admin only)",
  })
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.sub, isAdmin(user), dto);
  }

  @Get()
  @UseGuards(ScopeGuard)
  @ApiOperation({
    summary:
      "List products visible within the caller's scope, paginated and filterable",
  })
  findAll(
    @CurrentScope() scope: RequestScope,
    @Query() query: QueryProductDto,
  ) {
    return this.productsService.findAllInScope(scope, query);
  }

  @Get('nearby')
  @ApiOperation({
    summary:
      'Find available products within a radius of a point ("products near me")',
  })
  findNearby(@Query() query: NearbyProductQueryDto) {
    return this.productsService.findNearby(
      { lat: query.lat, lng: query.lng },
      query.radiusKm,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by id' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product (owner or admin only)' })
  update(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, user.sub, isAdmin(user), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product (owner or admin only)' })
  async remove(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.productsService.remove(id, user.sub, isAdmin(user));
  }

  @Post(':id/images')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Upload a product image (owner or admin only) — virus-scanned, resized + thumbnailed, stored in MinIO',
  })
  async uploadImage(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.productsService.requireOwnedOrAdmin(id, user.sub, isAdmin(user));
    return this.productImagesService.upload(id, file);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a product image (owner or admin only)' })
  async removeImage(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ): Promise<void> {
    await this.productsService.requireOwnedOrAdmin(id, user.sub, isAdmin(user));
    await this.productImagesService.remove(id, imageId);
  }
}

function isAdmin(user: JwtAccessPayload): boolean {
  return user.roleAssignments.some((ra) => ra.role === 'ADMIN');
}
