import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  User, 
  Wallet, 
  Star, 
  Package, 
  Settings, 
  ChevronRight,
  HandHelping,
  Info,
  Award,
  TrendingUp,
} from 'lucide-react-taro';

type UserInfo = {
  id: string;
  openid: string;
  nickname: string;
  avatar: string;
  phone?: string;
  student_id?: string;
  real_name?: string;
  balance: number;
  rating: number;
  total_orders: number;
  completed_orders: number;
};

type UserStats = {
  totalEarnings: number;
  completedOrders: number;
  rating: number;
  totalOrders: number;
};

const ProfilePage = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalEarnings: 0,
    completedOrders: 0,
    rating: 5.0,
    totalOrders: 0,
  });
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    nickname: '',
    phone: '',
    studentId: '',
    realName: '',
  });

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      // 从本地存储获取用户信息
      let storedUser = Taro.getStorageSync('userInfo');
      
      if (!storedUser) {
        // 创建新用户
        const openid = 'user-' + Date.now();
        const res = await Network.request({
          url: '/api/users/get-or-create',
          method: 'POST',
          data: { openid, nickname: '校园用户' },
        });
        if (res.data.code === 200) {
          storedUser = res.data.data;
          Taro.setStorageSync('userInfo', JSON.stringify(storedUser));
        }
      } else {
        storedUser = JSON.parse(storedUser);
      }

      setUserInfo(storedUser);
      setEditForm({
        nickname: storedUser.nickname || '',
        phone: storedUser.phone || '',
        studentId: storedUser.student_id || '',
        realName: storedUser.real_name || '',
      });

      // 计算统计数据
      setStats({
        totalEarnings: storedUser.balance || 0,
        completedOrders: storedUser.completed_orders || 0,
        rating: storedUser.rating || 5.0,
        totalOrders: storedUser.total_orders || 0,
      });
    } catch (error) {
      console.error('加载用户信息失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    }
  };

  const updateUserInfo = async () => {
    if (!userInfo) return;

    try {
      const res = await Network.request({
        url: `/api/users/${userInfo.id}`,
        method: 'PUT',
        data: {
          nickname: editForm.nickname,
          phone: editForm.phone,
          studentId: editForm.studentId,
          realName: editForm.realName,
        },
      });

      if (res.data?.code === 200) {
        const updatedUser = res.data.data;
        setUserInfo(updatedUser);
        Taro.setStorageSync('userInfo', JSON.stringify(updatedUser));
        Taro.showToast({ title: '保存成功', icon: 'success' });
        setShowEditProfile(false);
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' });
      }
    } catch (error) {
      console.error('更新用户信息失败:', error);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  };

  const menuItems = [
    {
      icon: Award,
      title: '历史记录',
      subtitle: '查看所有订单历史',
      onClick: () => {
        Taro.switchTab({ url: '/pages/my-orders/index' });
      },
    },
    {
      icon: TrendingUp,
      title: '收益统计',
      subtitle: '查看收益详情',
      onClick: () => {
        Taro.showToast({ title: '功能开发中', icon: 'none' });
      },
    },
    {
      icon: Settings,
      title: '设置',
      subtitle: '账号设置与隐私',
      onClick: () => {
        setShowEditProfile(true);
      },
    },
    {
      icon: HandHelping,
      title: '帮助中心',
      subtitle: '常见问题与客服',
      onClick: () => {
        Taro.showToast({ title: '功能开发中', icon: 'none' });
      },
    },
    {
      icon: Info,
      title: '关于我们',
      subtitle: '版本信息与协议',
      onClick: () => {
        Taro.showModal({
          title: '校园互助平台',
          content: '版本: 1.0.0\n\n校园互助平台致力于为校园师生提供便捷的互助服务，包括代拿快递、代取外卖等。',
          showCancel: false,
        });
      },
    },
  ];

  if (showEditProfile) {
    return (
      <View className="w-full min-h-screen bg-gray-50">
        <View className="bg-gradient-to-b from-blue-500 to-blue-600 p-6 text-white">
          <Text className="block text-2xl font-bold mb-2">编辑资料</Text>
        </View>

        <View className="p-4">
          <Card>
            <CardContent className="p-4">
              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">昵称</Text>
                <Input
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="请输入昵称"
                  value={editForm.nickname}
                  onInput={(e) => setEditForm({ ...editForm, nickname: e.detail.value })}
                />
              </View>

              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">真实姓名</Text>
                <Input
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="请输入真实姓名（选填）"
                  value={editForm.realName}
                  onInput={(e) => setEditForm({ ...editForm, realName: e.detail.value })}
                />
              </View>

              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">学号/工号</Text>
                <Input
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="请输入学号/工号（选填）"
                  value={editForm.studentId}
                  onInput={(e) => setEditForm({ ...editForm, studentId: e.detail.value })}
                />
              </View>

              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">联系电话</Text>
                <Input
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="请输入联系电话"
                  value={editForm.phone}
                  onInput={(e) => setEditForm({ ...editForm, phone: e.detail.value })}
                />
              </View>

              <View className="flex gap-2">
                <Button
                  className="flex-1 bg-gray-400 text-white"
                  onClick={() => setShowEditProfile(false)}
                >
                  取消
                </Button>
                <Button
                  className="flex-1 bg-blue-500 text-white"
                  onClick={updateUserInfo}
                >
                  保存
                </Button>
              </View>
            </CardContent>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View className="w-full min-h-screen bg-gray-50">
      {/* 头部用户信息 */}
      <View className="bg-gradient-to-b from-blue-500 to-blue-600 p-6 text-white">
        <View className="flex items-center gap-4 mb-4">
          <View className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
            <User size={32} color="white" />
          </View>
          <View className="flex-1">
            <Text className="block text-xl font-bold">{userInfo?.nickname || '校园用户'}</Text>
            <Text className="block text-sm opacity-80">
              ID: {userInfo?.id?.substring(0, 8) || '...'}
            </Text>
          </View>
          <Button
            size="sm"
            className="bg-white bg-opacity-20 text-white"
            onClick={() => setShowEditProfile(true)}
          >
            编辑
          </Button>
        </View>

        {/* 统计数据 */}
        <View className="flex justify-around bg-white bg-opacity-10 rounded-lg p-4">
          <View className="text-center">
            <Text className="block text-2xl font-bold">¥{stats.totalEarnings.toFixed(2)}</Text>
            <Text className="block text-xs opacity-80">总收益</Text>
          </View>
          <View className="text-center">
            <Text className="block text-2xl font-bold">{stats.completedOrders}</Text>
            <Text className="block text-xs opacity-80">完成订单</Text>
          </View>
          <View className="text-center">
            <Text className="block text-2xl font-bold">{stats.rating.toFixed(1)}</Text>
            <Text className="block text-xs opacity-80">评分</Text>
          </View>
        </View>
      </View>

      {/* 快捷功能 */}
      <View className="p-4">
        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="flex justify-around">
              <View className="text-center">
                <View className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
                  <Wallet size={24} color="#3B82F6" />
                </View>
                <Text className="block text-xs text-gray-600">我的钱包</Text>
              </View>
              <View className="text-center">
                <View className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-2">
                  <Star size={24} color="#F97316" />
                </View>
                <Text className="block text-xs text-gray-600">我的评价</Text>
              </View>
              <View className="text-center">
                <View className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-2">
                  <Package size={24} color="#22C55E" />
                </View>
                <Text className="block text-xs text-gray-600">我的发布</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 菜单列表 */}
        <Card>
          <CardContent className="p-0">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <View
                  key={index}
                  className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0"
                  onClick={item.onClick}
                >
                  <View className="flex items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                      <Icon size={20} color="#6B7280" />
                    </View>
                    <View>
                      <Text className="block text-base font-medium">{item.title}</Text>
                      <Text className="block text-xs text-gray-400">{item.subtitle}</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#9CA3AF" />
                </View>
              );
            })}
          </CardContent>
        </Card>

        {/* 版本信息 */}
        <View className="text-center mt-8 mb-4">
          <Text className="block text-xs text-gray-400">校园互助平台 v1.0.0</Text>
        </View>
      </View>
    </View>
  );
};

export default ProfilePage;
