import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { InsertUser, UpdateUser } from '@/storage/database/shared/schema';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async createUser(@Body() userData: InsertUser) {
    try {
      const user = await this.usersService.createUser(userData);
      return {
        code: 200,
        msg: '用户创建成功',
        data: user,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '用户创建失败',
        data: null,
      };
    }
  }

  @Get('openid/:openid')
  async getUserByOpenid(@Param('openid') openid: string) {
    try {
      const user = await this.usersService.getUserByOpenid(openid);
      if (!user) {
        return {
          code: 404,
          msg: '用户不存在',
          data: null,
        };
      }
      return {
        code: 200,
        msg: '获取用户信息成功',
        data: user,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '获取用户信息失败',
        data: null,
      };
    }
  }

  @Post('get-or-create')
  async getOrCreateUser(
    @Body('openid') openid: string,
    @Body('nickname') nickname?: string,
    @Body('avatar') avatar?: string
  ) {
    try {
      const user = await this.usersService.getOrCreateUser(openid, nickname, avatar);
      return {
        code: 200,
        msg: '用户获取或创建成功',
        data: user,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '用户获取或创建失败',
        data: null,
      };
    }
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    try {
      const user = await this.usersService.getUserById(id);
      if (!user) {
        return {
          code: 404,
          msg: '用户不存在',
          data: null,
        };
      }
      return {
        code: 200,
        msg: '获取用户信息成功',
        data: user,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '获取用户信息失败',
        data: null,
      };
    }
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() updateData: UpdateUser) {
    try {
      const user = await this.usersService.updateUser(id, updateData);
      return {
        code: 200,
        msg: '用户更新成功',
        data: user,
      };
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '用户更新失败',
        data: null,
      };
    }
  }
}
