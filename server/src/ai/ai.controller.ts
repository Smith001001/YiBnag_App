import { Controller, Post, Body, Headers } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('recommend')
  async recommendOrders(
    @Body('userDescription') userDescription: string,
    @Body('userLatitude') userLatitude?: number,
    @Body('userLongitude') userLongitude?: number
  ) {
    try {
      const recommendations = await this.aiService.recommendOrders(
        userDescription,
        userLatitude,
        userLongitude
      );

      return {
        code: 200,
        msg: '智能推荐成功',
        data: recommendations,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '智能推荐失败',
        data: null,
      };
    }
  }

  @Post('parse-order')
  async parseOrderFromText(
    @Body('text') text: string,
    @Body('publisherId') publisherId: string,
    @Body('pickupLocation') pickupLocation: any,
    @Body('deliveryLocation') deliveryLocation: any
  ) {
    try {
      const orderData = await this.aiService.parseOrderFromText(
        text,
        publisherId,
        pickupLocation,
        deliveryLocation
      );

      return {
        code: 200,
        msg: '订单解析成功',
        data: orderData,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '订单解析失败',
        data: null,
      };
    }
  }
}
