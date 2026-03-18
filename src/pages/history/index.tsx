import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Package, Utensils, ShoppingBag, CircleCheck, CircleX, ArrowLeft, Send, Inbox } from 'lucide-react-taro';

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

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  completed: { label: '已完成', color: 'text-green-500', icon: CircleCheck },
  cancelled: { label: '已取消', color: 'text-gray-400', icon: CircleX },
};

const HistoryPage = () => {
  const [activeTab, setActiveTab] = useState('published');
  const [publishedOrders, setPublishedOrders] = useState<Order[]>([]);
  const [acceptedOrders, setAcceptedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useDidShow(() => {
    loadUserInfo();
  });

  const loadUserInfo = async () => {
    const storedUser = Taro.getStorageSync('userInfo');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      await loadOrders(user);
    }
  };

  const loadOrders = async (user: { id: string }) => {
    setLoading(true);
    try {
      // 加载我发布的订单（已完成和已取消）
      const publishedRes = await Network.request({
        url: `/api/orders?publisherId=${user.id}&limit=100`,
      });

      // 加载我接的订单（已完成和已取消）
      const acceptedRes = await Network.request({
        url: `/api/orders?accepterId=${user.id}&limit=100`,
      });

      // 只取已完成和已取消的订单
      const historyStatuses = ['completed', 'cancelled'];

      let published: Order[] = [];
      let accepted: Order[] = [];

      if (publishedRes.data?.code === 200) {
        published = (publishedRes.data.data || []).filter((o: Order) => historyStatuses.includes(o.status));
      }

      if (acceptedRes.data?.code === 200) {
        accepted = (acceptedRes.data.data || []).filter((o: Order) => historyStatuses.includes(o.status));
      }

      setPublishedOrders(published);
      setAcceptedOrders(accepted);
    } catch (error) {
      console.error('加载订单失败:', error);
    } finally {
      setLoading(false);
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

  const getStatusColor = (color: string) => {
    switch (color) {
      case 'text-green-500': return '#22C55E';
      default: return '#9CA3AF';
    }
  };

  const renderOrderCard = (order: Order) => {
    const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.cancelled;
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

          <View className="flex justify-between items-center">
            <View className="flex items-center gap-1">
              <StatusIcon size={14} color={getStatusColor(statusInfo.color)} />
              <Text className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Text>
            </View>
            <Text className="text-xs text-gray-400">
              {new Date(order.created_at).toLocaleDateString()}
            </Text>
          </View>
        </CardContent>
      </Card>
    );
  };

  return (
    <View className="w-full min-h-screen bg-gray-50">
      {/* 头部 */}
      <View className="bg-gradient-to-b from-blue-500 to-blue-600 p-6 text-white">
        <View className="flex items-center gap-3">
          <View onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
            <ArrowLeft size={24} color="white" />
          </View>
          <Text className="block text-2xl font-bold">历史记录</Text>
        </View>
        <Text className="block text-sm opacity-90 mt-2">
          查看已完成和已取消的订单
        </Text>
      </View>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="published">
            <Inbox size={14} className="mr-1" />
            我发布的 ({publishedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="accepted">
            <Send size={14} className="mr-1" />
            我接的单 ({acceptedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            <CircleX size={14} className="mr-1" />
            已取消 ({[...publishedOrders, ...acceptedOrders].filter(o => o.status === 'cancelled').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="published" className="mt-4">
          {loading ? (
            <View className="text-center py-8">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : publishedOrders.filter(o => o.status === 'completed').length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Inbox size={48} className="mx-auto text-gray-400 mb-4" color="#3B82F6" />
                <Text className="block text-gray-500 mb-2">暂无发布记录</Text>
                <Text className="block text-xs text-gray-400">您发布的订单完成后将在这里显示</Text>
              </CardContent>
            </Card>
          ) : (
            publishedOrders.filter(o => o.status === 'completed').map((order) => renderOrderCard(order))
          )}
        </TabsContent>

        <TabsContent value="accepted" className="mt-4">
          {loading ? (
            <View className="text-center py-8">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : acceptedOrders.filter(o => o.status === 'completed').length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Send size={48} className="mx-auto text-gray-400 mb-4" color="#22C55E" />
                <Text className="block text-gray-500 mb-2">暂无接单记录</Text>
                <Text className="block text-xs text-gray-400">您完成的订单将在这里显示</Text>
              </CardContent>
            </Card>
          ) : (
            acceptedOrders.filter(o => o.status === 'completed').map((order) => renderOrderCard(order))
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4">
          {loading ? (
            <View className="text-center py-8">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : [...publishedOrders, ...acceptedOrders].filter(o => o.status === 'cancelled').length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CircleX size={48} className="mx-auto text-gray-400 mb-4" color="#9CA3AF" />
                <Text className="block text-gray-500 mb-2">暂无已取消订单</Text>
                <Text className="block text-xs text-gray-400">取消的订单将在这里显示</Text>
              </CardContent>
            </Card>
          ) : (
            [...publishedOrders, ...acceptedOrders]
              .filter(o => o.status === 'cancelled')
              .map((order) => renderOrderCard(order))
          )}
        </TabsContent>
      </Tabs>
    </View>
  );
};

export default HistoryPage;
