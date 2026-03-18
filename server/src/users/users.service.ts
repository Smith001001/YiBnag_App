import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { InsertUser, UpdateUser, User } from '@/storage/database/shared/schema';

@Injectable()
export class UsersService {
  private client = getSupabaseClient();

  async createUser(userData: InsertUser): Promise<User> {
    const dbData = {
      openid: userData.openid,
      nickname: userData.nickname,
      avatar: userData.avatar,
      phone: userData.phone,
      student_id: userData.studentId,
      real_name: userData.realName,
      location: userData.location,
    };

    const { data, error } = await this.client
      .from('users')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return data;
  }

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  async getUserByOpenid(openid: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('openid', openid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  async updateUser(id: string, updateData: UpdateUser): Promise<User> {
    const dbData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updateData.nickname !== undefined) dbData.nickname = updateData.nickname;
    if (updateData.avatar !== undefined) dbData.avatar = updateData.avatar;
    if (updateData.phone !== undefined) dbData.phone = updateData.phone;
    if (updateData.studentId !== undefined) dbData.student_id = updateData.studentId;
    if (updateData.realName !== undefined) dbData.real_name = updateData.realName;
    if (updateData.location !== undefined) dbData.location = updateData.location;
    if (updateData.isActive !== undefined) dbData.is_active = updateData.isActive;

    const { data, error } = await this.client
      .from('users')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data;
  }

  async getOrCreateUser(openid: string, nickname?: string, avatar?: string): Promise<User> {
    let user = await this.getUserByOpenid(openid);

    if (!user) {
      user = await this.createUser({
        openid,
        nickname: nickname || '用户',
        avatar: avatar || '',
      });
    }

    return user;
  }
}
