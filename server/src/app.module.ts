import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { OrdersModule } from '@/orders/orders.module';
import { UsersModule } from '@/users/users.module';
import { AiModule } from '@/ai/ai.module';

@Module({
  imports: [OrdersModule, UsersModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
