import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { InsertOrder, UpdateOrder, Order, User } from '@/storage/database/shared/schema';
import { insertOrderSchema, updateOrderSchema } from '@/storage/database/shared/schema';

@Injectable()
export class OrdersService {
  private client = getSupabaseClient();

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

    return data;
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
