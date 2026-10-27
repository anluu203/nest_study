import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../core/constants/user-role.enum';
import { Roles } from '../../core/decorators/roles.decorator';
import {
  RegisterWarrantyProductDto,
  UpdateWarrantyProductDto,
} from './dto/register-warranty-product.dto';
import { UpdateWarrantyRequestDto } from './dto/update-warranty-request.dto';
import {
  AdminWarrantyProductQueryDto,
  AdminWarrantyRequestQueryDto,
} from './dto/warranty-query.dto';
import { WarrantiesService } from './warranties.service';

@ApiTags('Admin Warranties')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN)
@Controller('admin/warranties')
export class AdminWarrantiesController {
  constructor(private readonly service: WarrantiesService) {}

  @Get('products')
  products(@Query() query: AdminWarrantyProductQueryDto) {
    return this.service.findProducts(query);
  }

  @Post('products')
  @ApiOperation({
    summary:
      'Register a physical unit from a historical delivered order with verified dates',
  })
  register(@Body() dto: RegisterWarrantyProductDto) {
    return this.service.registerProduct(dto);
  }

  @Get('products/:id')
  product(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findProduct(id);
  }

  @Patch('products/:id')
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarrantyProductDto,
  ) {
    return this.service.updateProduct(id, dto);
  }

  @Get('requests/stats')
  stats() {
    return this.service.requestStats();
  }

  @Get('requests')
  requests(@Query() query: AdminWarrantyRequestQueryDto) {
    return this.service.findRequests(query);
  }

  @Get('requests/:id')
  request(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findRequest(id);
  }

  @Patch('requests/:id/status')
  @ApiOperation({
    summary:
      'Append a customer-visible note, keeping the status or advancing one step',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarrantyRequestDto,
  ) {
    return this.service.updateRequest(id, dto);
  }
}
