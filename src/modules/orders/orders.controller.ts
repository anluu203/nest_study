import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthUser } from '../../core/types/auth-user.type';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get('cart')
  getCart(@CurrentUser() user: AuthUser) {
    return this.service.getCart(user.sub);
  }

  @Post('cart/items')
  addItem(@CurrentUser() user: AuthUser, @Body() dto: AddCartItemDto) {
    return this.service.addItem(user.sub, dto);
  }

  @Patch('cart/items/:itemId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.service.updateCartItem(user.sub, itemId, dto);
  }

  @Delete('cart/items/:itemId')
  removeItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.service.removeCartItem(user.sub, itemId);
  }

  @Delete('cart')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearCart(@CurrentUser() user: AuthUser) {
    return this.service.clearCart(user.sub);
  }

  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser) {
    return this.service.checkout(user.sub);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findUserOrders(user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOrderById(user.sub, id);
  }
}
