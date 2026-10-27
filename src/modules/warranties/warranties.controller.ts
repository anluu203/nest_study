import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthUser } from '../../core/types/auth-user.type';
import { CreateWarrantyRequestDto } from './dto/create-warranty-request.dto';
import {
  WarrantyProductQueryDto,
  WarrantyRequestQueryDto,
} from './dto/warranty-query.dto';
import { WarrantiesService } from './warranties.service';

@ApiTags('Warranties')
@ApiBearerAuth('JWT-auth')
@Controller('warranties')
export class WarrantiesController {
  constructor(private readonly service: WarrantiesService) {}

  @Get('products')
  @ApiOperation({
    summary: 'List and search warranty products owned by the current user',
  })
  products(
    @CurrentUser() user: AuthUser,
    @Query() query: WarrantyProductQueryDto,
  ) {
    return this.service.findProducts(query, user.sub);
  }

  @Get('products/:id')
  product(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findProduct(id, user.sub);
  }

  @Get('requests')
  requests(
    @CurrentUser() user: AuthUser,
    @Query() query: WarrantyRequestQueryDto,
  ) {
    return this.service.findRequests(query, user.sub);
  }

  @Post('requests')
  @ApiOperation({
    summary: 'Submit a warranty request for an owned, covered physical unit',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWarrantyRequestDto) {
    return this.service.createRequest(user.sub, dto);
  }

  @Get('requests/:id')
  request(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findRequest(id, user.sub);
  }
}
