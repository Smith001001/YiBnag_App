import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Package, Utensils, ShoppingBag, Clock, CircleCheck, CircleX } from 'lucide-react-taro';

type Order = {
  id: string;
  title: string;
  description: string;
  type: string;
  price: number;
  status: string;
  pickup_location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  delivery_location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  publisher_id: string;
  accepter_id: string | null;
  created_at: string;
  deadline: string | null;
  payment_status: string;
};

type UserInfo = {
  id: string;
  openid: string;
  nickname: string;
  avatar: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待接单', color: 'text-orange-500', icon: Clock },
  accepted: { label: '已接单', color: 'text-blue-500', icon: CircleCheck },
  in_progress: { label: '进行中', color: 'text-purple-500', icon: Clock },
  completed: { label: '已完成', color: 'text-green-500', icon: CircleCheck },
  cancelled: { label: '已取消', color: 'text-gray-400', icon: CircleX },
};

const MyOrdersPage = () => {
  const [activeTab, setActiveTab] = useState('accepted');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [publishedOrders, setPublishedOrders] = useState<Order[]>([]);
  const [acceptedOrders, setAcceptedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserInfo();
  }, []);

  useEffect(() => {
    if (userInfo) {
      loadOrders();
    }
  }, [userInfo]);

  const loadUserInfo = async () => {
    try {
      // 从本地存储获取用户信息
      const storedUser = Taro.getStorageSync('userInfo');
      if (storedUser) {
        setUserInfo(JSON.parse(storedUser));
      } else {
        // 创建新用户
        const openid = 'user-' + Date.now();
        const res = await Network.request({
          url: '/api/users/get-or-create',
          method: 'POST',
          data: { openid, nickname: '校园用户' },
        });
        if (res.data.code === 200) {
          const user = res.data.data;
          setUserInfo(user);
          Taro.setStorageSync('userInfo', JSON.stringify(user));
        }
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const loadOrders = async () => {
    if (!userInfo) return;

    setLoading(true);
    try {
      // 加载我发布的订单
      const publishedRes = await Network.request({
        url: `/api/orders?publisherId=${userInfo.id}&limit=50`,
      });
      if (publishedRes.data?.code === 200) {
        setPublishedOrders(publishedRes.data.data || []);
      }

      // 加载我接的订单
      const acceptedRes = await Network.request({
        url: `/api/orders?accepterId=${userInfo.id}&limit=50`,
      });
      if (acceptedRes.data?.code === 200) {
        setAcceptedOrders(acceptedRes.data.data || []);
      }
    } catch (error) {
      console.error('加载订单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await Network.request({
        url: `/api/orders/${orderId}`,
        method: 'PUT',
        data: { status },
      });

      if (res.data?.code === 200) {
        Taro.showToast({ title: '操作成功', icon: 'success' });
        loadOrders();
      } else {
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    } catch (error) {
      console.error('更新订单状态失败:', error);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'delivery_pickup':
        return <Package size={16} color="#3B82F6" />;
      case 'delivery_food':
        return <Utensils size={16} color="#F59E0B" />;
      default:
        return <ShoppingBag size={16} color="#6B7280" />;
    }
  };

  const renderOrderCard = (order: Order, isPublished: boolean) => {
    const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.pending;
    const StatusIcon = statusInfo.icon;

    return (
      <Card key={order.id} className="mb-3">
        <CardContent className="p-4">
          <View className="flex justify-between items-start mb-2">
            <View className="flex items-center gap-2 flex-1">
              {getOrderTypeIcon(order.type)}
              <Text className="block font-semibold text-base flex-1">{order.title}</Text>
            </View>
            <Text className="block text-red-500 font-bold">¥{order.price}</Text>
          </View>

          <Text className="block text-sm text-gray-600 mb-2">{order.description}</Text>

          <View className="flex items-center gap-1 mb-2">
            <MapPin size={14} color="#6B7280" />
            <Text className="text-xs text-gray-500">
              {order.pickup_location?.address} → {order.delivery_location?.address}
            </Text>
          </View>

          <View className="flex justify-between items-center mb-3">
            <View className="flex items-center gap-1">
              <StatusIcon size={14} color={statusInfo.color.includes('orange') ? '#F97316' : statusInfo.color.includes('blue') ? '#3B82F6' : statusInfo.color.includes('green') ? '#22C55E' : '#9CA3AF'} />
              <Text className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Text>
            </View>
            <Text className="text-xs text-gray-400">
              {new Date(order.created_at).toLocaleDateString()}
            </Text>
          </View>

          {/* 操作按钮 */}
          {order.status === 'pending' && isPublished && (
            <Button
              size="sm"
              className="w-full bg-gray-400 text-white"
              onClick={() => updateOrderStatus(order.id, 'cancelled')}
            >
              取消订单
            </Button>
          )}

          {order.status === 'accepted' && isPublished && (
            <Button
              size="sm"
              className="w-full bg-green-500 text-white"
              onClick={() => updateOrderStatus(order.id, 'completed')}
            >
              确认完成
            </Button>
          )}

          {order.status === 'accepted' && !isPublished && (
            <Button
              size="sm"
              className="w-full bg-blue-500 text-white"
              onClick={() => updateOrderStatus(order.id, 'in_progress')}
            >
              开始配送
            </Button>
          )}

          {order.status === 'in_progress' && !isPublished && (
            <Button
              size="sm"
              className="w-full bg-green-500 text-white"
              onClick={() => updateOrderStatus(order.id, 'completed')}
            >
              完成配送
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <View className="w-full min-h-screen bg-gray-50">
      <View className="bg-gradient-to-b from-blue-500 to-blue-600 p-6 text-white">
        <Text className="block text-2xl font-bold mb-2">我的订单</Text>
        <Text className="block text-sm opacity-90">
          管理您的接单和发布记录
        </Text>
      </View>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="accepted" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            我接的单 ({acceptedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="published" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            我发布的 ({publishedOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accepted" className="mt-4">
          {loading ? (
            <View className="text-center py-8">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : acceptedOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShoppingBag size={48} className="mx-auto text-gray-400 mb-4" />
                <Text className="block text-gray-500 mb-2">暂无接单记录</Text>
                <Text className="block text-xs text-gray-400">去订单大厅看看有什么合适的订单吧</Text>
              </CardContent>
            </Card>
          ) : (
            acceptedOrders.map((order) => renderOrderCard(order, false))
          )}
        </TabsContent>

        <TabsContent value="published" className="mt-4">
          {loading ? (
            <View className="text-center py-8">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : publishedOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package size={48} className="mx-auto text-gray-400 mb-4" />
                <Text className="block text-gray-500 mb-2">暂无发布记录</Text>
                <Text className="block text-xs text-gray-400">发布您的第一个订单吧</Text>
              </CardContent>
            </Card>
          ) : (
            publishedOrders.map((order) => renderOrderCard(order, true))
          )}
        </TabsContent>
      </Tabs>
    </View>
  );
};

export default MyOrdersPage;
