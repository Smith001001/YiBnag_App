import { Injectable, OnModuleInit } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { InsertOrder, UpdateOrder, Order, User } from '@/storage/database/shared/schema';
import { insertOrderSchema, updateOrderSchema } from '@/storage/database/shared/schema';

// 模拟订单数据模板
const MOCK_ORDER_TEMPLATES = [
  {
    title: '代拿快递 - 京东包裹',
    description: '帮忙从校门口取快递，送到3号宿舍楼',
    type: 'delivery_pickup',
    price: 5,
    pickup_location: { latitude: 39.9042, longitude: 116.4074, address: '校门口快递点' },
    delivery_location: { latitude: 39.9052, longitude: 116.4084, address: '3号宿舍楼' },
  },
  {
    title: '代取外卖 - 麦当劳',
    description: '帮忙从麦当劳取外卖，送到图书馆',
    type: 'delivery_food',
    price: 6,
    pickup_location: { latitude: 39.9062, longitude: 116.4094, address: '麦当劳' },
    delivery_location: { latitude: 39.9072, longitude: 116.4104, address: '图书馆' },
  },
  {
    title: '代拿快递 - 顺丰包裹',
    description: '帮忙从顺丰网点取快递，送到食堂',
    type: 'delivery_pickup',
    price: 4,
    pickup_location: { latitude: 39.9082, longitude: 116.4114, address: '顺丰网点' },
    delivery_location: { latitude: 39.9092, longitude: 116.4124, address: '学生食堂' },
  },
  {
    title: '代取外卖 - 肯德基',
    description: '帮忙从肯德基取外卖，送到宿舍楼',
    type: 'delivery_food',
    price: 7,
    pickup_location: { latitude: 39.9102, longitude: 116.4134, address: '肯德基' },
    delivery_location: { latitude: 39.9112, longitude: 116.4144, address: '5号宿舍楼' },
  },
  {
    title: '代拿快递 - 菜鸟驿站',
    description: '帮忙从菜鸟驿站取快递，送到教学楼',
    type: 'delivery_pickup',
    price: 5,
    pickup_location: { latitude: 39.9122, longitude: 116.4154, address: '菜鸟驿站' },
    delivery_location: { latitude: 39.9132, longitude: 116.4164, address: 'A教学楼' },
  },
  {
    title: '代取外卖 - 瑞幸咖啡',
    description: '帮忙从瑞幸咖啡取饮料，送到实验楼',
    type: 'delivery_food',
    price: 5,
    pickup_location: { latitude: 39.9142, longitude: 116.4174, address: '瑞幸咖啡' },
    delivery_location: { latitude: 39.9152, longitude: 116.4184, address: '实验楼' },
  },
  {
    title: '代拿快递 - 邮政局',
    description: '帮忙从邮政局取包裹，送到体育馆',
    type: 'delivery_pickup',
    price: 6,
    pickup_location: { latitude: 39.9162, longitude: 116.4194, address: '邮政局' },
    delivery_location: { latitude: 39.9172, longitude: 116.4204, address: '体育馆' },
  },
  {
    title: '代取外卖 - 喜茶',
    description: '帮忙从喜茶取奶茶，送到行政楼',
    type: 'delivery_food',
    price: 8,
    pickup_location: { latitude: 39.9182, longitude: 116.4214, address: '喜茶' },
    delivery_location: { latitude: 39.9192, longitude: 116.4224, address: '行政楼' },
  },
];

// 系统模拟用户ID
const SYSTEM_USER_ID = '919dbf8f-039b-41f2-b086-1cbf1884a1c5';

@Injectable()
export class OrdersService implements OnModuleInit {
  private client = getSupabaseClient();

  // 模块初始化时确保有模拟订单
  async onModuleInit() {
    await this.ensureSystemUser();
    await this.checkAndRefillMockOrders();
  }

  // 确保系统用户存在
  private async ensureSystemUser() {
    try {
      const { data: systemUser } = await this.client
        .from('users')
        .select('id')
        .eq('id', SYSTEM_USER_ID)
        .single();

      if (!systemUser) {
        await this.client.from('users').insert({
          id: SYSTEM_USER_ID,
          openid: 'system-mock-user',
          nickname: '系统模拟用户',
          avatar: '',
        });
        console.log('✅ 系统模拟用户已创建');
      }
    } catch (error) {
      console.error('创建系统用户失败:', error);
    }
  }

  // 确保数据库中有足够的模拟订单（服务启动时使用，已废弃）
  async ensureMockOrders() {
    await this.ensureSystemUser();
    await this.checkAndRefillMockOrders();
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    // Convert camelCase to snake_case for database fields
    const dbData = {
      publisher_id: orderData.publisherId,
      type: orderData.type,
      title: orderData.title,
      description: orderData.description,
      pickup_location: orderData.pickupLocation,
      delivery_location: orderData.deliveryLocation,
      price: orderData.price,
      deadline: orderData.deadline,
      pickup_time: orderData.pickupTime,
      images: orderData.images,
    };

    const { data, error } = await this.client
      .from('orders')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create order: ${error.message}`);
    }

    return data;
  }

  async getOrders(filters?: {
    status?: string;
    publisherId?: string;
    accepterId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    let query = this.client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.publisherId) {
      query = query.eq('publisher_id', filters.publisherId);
    }

    if (filters?.accepterId) {
      query = query.eq('accepter_id', filters.accepterId);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    return data || [];
  }

  async getOrderById(id: string): Promise<Order | null> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch order: ${error.message}`);
    }

    return data;
  }

  async updateOrder(id: string, updateData: UpdateOrder): Promise<Order> {
    const { data, error } = await this.client
      .from('orders')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update order: ${error.message}`);
    }

    // 如果订单被取消，检查并补充模拟订单
    if (updateData.status === 'cancelled') {
      await this.checkAndRefillMockOrders();
    }

    return data;
  }

  async acceptOrder(orderId: string, accepterId: string): Promise<Order> {
    const { data, error } = await this.client
      .from('orders')
      .update({
        accepter_id: accepterId,
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to accept order: ${error.message}`);
    }

    // 接单成功后，检查并补充模拟订单
    await this.checkAndRefillMockOrders();

    return data;
  }

  // 检查并补充模拟订单（保持至少3个待接订单）
  private async checkAndRefillMockOrders() {
    try {
      // 检查当前pending订单数量
      const { data: pendingOrders } = await this.client
        .from('orders')
        .select('id')
        .eq('status', 'pending');

      const pendingCount = pendingOrders?.length || 0;
      const minOrders = 3;

      if (pendingCount < minOrders) {
        const ordersToCreate = minOrders - pendingCount;
        console.log(`📦 检测到待接订单不足，将补充 ${ordersToCreate} 个模拟订单`);

        // 随机选择模板创建新订单
        const usedIndices = new Set<number>();
        for (let i = 0; i < ordersToCreate; i++) {
          let randomIndex;
          // 避免重复选择同一个模板
          do {
            randomIndex = Math.floor(Math.random() * MOCK_ORDER_TEMPLATES.length);
          } while (usedIndices.has(randomIndex) && usedIndices.size < MOCK_ORDER_TEMPLATES.length);
          
          usedIndices.add(randomIndex);
          const template = MOCK_ORDER_TEMPLATES[randomIndex];
          
          await this.client.from('orders').insert({
            publisher_id: SYSTEM_USER_ID,
            title: template.title,
            description: template.description,
            type: template.type,
            price: template.price,
            pickup_location: template.pickup_location,
            delivery_location: template.delivery_location,
            status: 'pending',
            images: [],
          });
        }
        console.log(`✅ 已补充 ${ordersToCreate} 个模拟订单`);
      }
    } catch (error) {
      console.error('补充模拟订单失败:', error);
    }
  }

  async getOrdersByDistance(
    userLatitude: number,
    userLongitude: number,
    filters?: {
      status?: string;
      limit?: number;
    }
  ): Promise<Order[]> {
    let query = this.client
      .from('orders')
      .select('*')
      .eq('status', filters?.status || 'pending')
      .order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Calculate distance for each order and sort
    const ordersWithDistance = data.map((order) => {
      const distance = this.calculateDistance(
        userLatitude,
        userLongitude,
        parseFloat(order.pickup_location?.latitude || '0'),
        parseFloat(order.pickup_location?.longitude || '0')
      );
      return { ...order, distance };
    });

    // Sort by distance
    ordersWithDistance.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    return ordersWithDistance;
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async deleteOrder(id: string): Promise<void> {
    const { error } = await this.client
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete order: ${error.message}`);
    }
  }
}
