import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { InsertOrder, UpdateOrder } from '@/storage/database/shared/schema';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() orderData: InsertOrder) {
    try {
      const order = await this.ordersService.createOrder(orderData);
      return {
        code: 200,
        msg: '订单创建成功',
        data: order,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '订单创建失败',
        data: null,
      };
    }
  }

  @Get()
  async getOrders(
    @Query('status') status?: string,
    @Query('publisherId') publisherId?: string,
    @Query('accepterId') accepterId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    try {
      const orders = await this.ordersService.getOrders({
        status,
        publisherId,
        accepterId,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
      return {
        code: 200,
        msg: '获取订单列表成功',
        data: orders,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '获取订单列表失败',
        data: null,
      };
    }
  }

  @Get('nearby')
  async getNearbyOrders(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const orders = await this.ordersService.getOrdersByDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        {
          status,
          limit: limit ? parseInt(limit) : 20,
        }
      );
      return {
        code: 200,
        msg: '获取附近订单成功',
        data: orders,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '获取附近订单失败',
        data: null,
      };
    }
  }

  @Get(':id')
  async getOrderById(@Param('id') id: string) {
    try {
      const order = await this.ordersService.getOrderById(id);
      if (!order) {
        return {
          code: 404,
          msg: '订单不存在',
          data: null,
        };
      }
      return {
        code: 200,
        msg: '获取订单详情成功',
        data: order,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '获取订单详情失败',
        data: null,
      };
    }
  }

  @Put(':id')
  async updateOrder(@Param('id') id: string, @Body() updateData: UpdateOrder) {
    try {
      const order = await this.ordersService.updateOrder(id, updateData);
      return {
        code: 200,
        msg: '订单更新成功',
        data: order,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '订单更新失败',
        data: null,
      };
    }
  }

  @Post(':id/accept')
  async acceptOrder(@Param('id') id: string, @Body('accepterId') accepterId: string) {
    try {
      const order = await this.ordersService.acceptOrder(id, accepterId);
      return {
        code: 200,
        msg: '订单接受成功',
        data: order,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '订单接受失败',
        data: null,
      };
    }
  }

  @Delete(':id')
  async deleteOrder(@Param('id') id: string) {
    try {
      await this.ordersService.deleteOrder(id);
      return {
        code: 200,
        msg: '订单删除成功',
        data: null,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '订单删除失败',
        data: null,
      };
    }
  }
}
