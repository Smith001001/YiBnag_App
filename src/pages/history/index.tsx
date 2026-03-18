import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { Network } from '@/network';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Package, Utensils, ShoppingBag, CircleCheck, CircleX, ArrowLeft } from 'lucide-react-taro';

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
  const [activeTab, setActiveTab] = useState('completed');
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useDidShow(() => {
    loadOrders();
  });

  const loadOrders = async () => {
    const storedUser = Taro.getStorageSync('userInfo');
    if (!storedUser) return;
    
    const user = JSON.parse(storedUser);

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

      const allOrders: Order[] = [];

      if (publishedRes.data?.code === 200) {
        allOrders.push(...(publishedRes.data.data || []));
      }

      if (acceptedRes.data?.code === 200) {
        allOrders.push(...(acceptedRes.data.data || []));
      }

      // 去重（根据订单ID）
      const uniqueOrders = Array.from(
        new Map(allOrders.map(order => [order.id, order])).values()
      );

      // 分类
      const completed = uniqueOrders.filter(o => o.status === 'completed');
      const cancelled = uniqueOrders.filter(o => o.status === 'cancelled');

      setCompletedOrders(completed);
      setCancelledOrders(cancelled);
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
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="completed" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            已完成 ({completedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            已取消 ({cancelledOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="completed" className="mt-4">
          {loading ? (
            <View className="text-center py-8">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : completedOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CircleCheck size={48} className="mx-auto text-gray-400 mb-4" color="#22C55E" />
                <Text className="block text-gray-500 mb-2">暂无已完成订单</Text>
                <Text className="block text-xs text-gray-400">完成订单后将在这里显示</Text>
              </CardContent>
            </Card>
          ) : (
            completedOrders.map((order) => renderOrderCard(order))
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4">
          {loading ? (
            <View className="text-center py-8">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : cancelledOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CircleX size={48} className="mx-auto text-gray-400 mb-4" color="#9CA3AF" />
                <Text className="block text-gray-500 mb-2">暂无已取消订单</Text>
                <Text className="block text-xs text-gray-400">取消的订单将在这里显示</Text>
              </CardContent>
            </Card>
          ) : (
            cancelledOrders.map((order) => renderOrderCard(order))
          )}
        </TabsContent>
      </Tabs>
    </View>
  );
};

export default HistoryPage;
