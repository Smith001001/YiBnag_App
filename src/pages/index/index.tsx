import { View, Text } from '@tarojs/components';
import Taro, { getEnv, ENV_TYPE } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, ShoppingBag, Sparkles, Package, Utensils } from 'lucide-react-taro';
import './index.css';

type Order = {
  id: string;
  title: string;
  description: string;
  type: string;
  price: number;
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
  status: string;
  distance?: number;
};

type UserInfo = {
  id: string;
  openid: string;
  nickname: string;
  avatar: string;
};

const ORDER_TYPES = [
  { value: 'all', label: '全部', icon: ShoppingBag },
  { value: 'delivery_pickup', label: '代拿快递', icon: Package },
  { value: 'delivery_food', label: '代取外卖', icon: Utensils },
];

const IndexPage = () => {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedType, setSelectedType] = useState('all');
  const [locationStatus, setLocationStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  // 订单表单
  const [orderForm, setOrderForm] = useState({
    title: '',
    description: '',
    price: '',
    pickupLocation: '',
    deliveryLocation: '',
    type: 'delivery_pickup',
  });

  // AI 助手
  const [aiMessage, setAiMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const isWeapp = getEnv() === ENV_TYPE.WEAPP;

  useEffect(() => {
    initUser();
    loadOrders();
    requestLocation();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedType]);

  const filterOrders = () => {
    if (selectedType === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.type === selectedType));
    }
  };

  const initUser = async () => {
    try {
      // 先从本地存储获取用户信息
      const storedUser = Taro.getStorageSync('userInfo');
      if (storedUser) {
        setUserInfo(JSON.parse(storedUser));
        return;
      }

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
    } catch (error) {
      console.error('初始化用户失败:', error);
    }
  };

  const requestLocation = async () => {
    if (isWeapp) {
      // 微信小程序：先检查权限
      try {
        const setting = await Taro.getSetting();
        if (setting.authSetting['scope.userLocation'] === false) {
          // 用户已拒绝，引导去设置页
          const { confirm } = await Taro.showModal({
            title: '需要位置权限',
            content: '请在设置中开启位置权限，以便获取附近订单',
          });
          if (confirm) {
            await Taro.openSetting();
            getLocation();
          } else {
            setLocationStatus('failed');
            loadOrders();
          }
        } else {
          // 未授权或已授权，直接获取位置
          await getLocation();
        }
      } catch (error) {
        console.error('检查位置权限失败:', error);
        setLocationStatus('failed');
        loadOrders();
      }
    } else {
      // H5 或其他平台
      await getLocation();
    }
  };

  const getLocation = async () => {
    try {
      setLocationStatus('pending');
      const location = await Taro.getLocation({ type: 'gcj02' });
      setUserLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setLocationStatus('success');
      // 获取位置后重新加载订单（按距离排序）
      loadOrders();
    } catch (error) {
      console.error('获取位置失败:', error);
      setLocationStatus('failed');
      Taro.showToast({ title: '获取位置失败', icon: 'none' });
      loadOrders();
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      let url = '/api/orders';
      if (userLocation) {
        url = `/api/orders/nearby?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&limit=20`;
      }

      const res = await Network.request({ url });
      console.log('订单列表响应:', res);

      if (res.data && res.data.code === 200) {
        setOrders(res.data.data || []);
      }
    } catch (error) {
      console.error('加载订单失败:', error);
      Taro.showToast({ title: '加载订单失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const handlePublishOrder = async () => {
    if (!userInfo) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (!orderForm.title || !orderForm.description || !orderForm.price) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    try {
      const res = await Network.request({
        url: '/api/orders',
        method: 'POST',
        data: {
          publisherId: userInfo.id,
          type: orderForm.type,
          title: orderForm.title,
          description: orderForm.description,
          price: parseFloat(orderForm.price),
          pickupLocation: userLocation || { latitude: 0, longitude: 0, address: orderForm.pickupLocation },
          deliveryLocation: { latitude: 0, longitude: 0, address: orderForm.deliveryLocation },
          images: [],
        },
      });

      if (res.data && res.data.code === 200) {
        Taro.showToast({ title: '发布成功', icon: 'success' });
        setOrderForm({ 
          title: '', 
          description: '', 
          price: '', 
          pickupLocation: '', 
          deliveryLocation: '',
          type: 'delivery_pickup',
        });
        setActiveTab('orders');
        loadOrders();
      } else {
        Taro.showToast({ title: '发布失败', icon: 'none' });
      }
    } catch (error) {
      console.error('发布订单失败:', error);
      Taro.showToast({ title: '发布失败', icon: 'none' });
    }
  };

  const handleAiRecommend = async () => {
    if (!aiMessage) {
      Taro.showToast({ title: '请输入你的需求', icon: 'none' });
      return;
    }

    setAiLoading(true);
    setAiResponse('');

    try {
      const res = await Network.request({
        url: '/api/ai/recommend',
        method: 'POST',
        data: {
          userDescription: aiMessage,
          userLatitude: userLocation?.latitude,
          userLongitude: userLocation?.longitude,
        },
      });

      if (res.data && res.data.code === 200) {
        const recommendations = res.data.data;
        if (recommendations && recommendations.length > 0) {
          let responseText = '为您推荐以下订单：\n\n';
          recommendations.forEach((rec: any, index: number) => {
            responseText += `${index + 1}. ${rec.matchReason}（匹配度：${rec.matchScore}%）\n`;
          });
          setAiResponse(responseText);
        } else {
          setAiResponse('暂时没有找到合适的订单，您可以尝试修改需求描述。');
        }
      }
    } catch (error) {
      console.error('AI 推荐失败:', error);
      setAiResponse('AI 推荐失败，请稍后重试。');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiPublish = async () => {
    if (!userInfo) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (!aiMessage) {
      Taro.showToast({ title: '请输入订单描述', icon: 'none' });
      return;
    }

    setAiLoading(true);

    try {
      const res = await Network.request({
        url: '/api/ai/parse-order',
        method: 'POST',
        data: {
          text: aiMessage,
          publisherId: userInfo.id,
          pickupLocation: userLocation || { latitude: 0, longitude: 0, address: '当前位置' },
          deliveryLocation: { latitude: 0, longitude: 0, address: '目标地点' },
        },
      });

      if (res.data && res.data.code === 200) {
        const orderData = res.data.data;
        const createRes = await Network.request({
          url: '/api/orders',
          method: 'POST',
          data: orderData,
        });

        if (createRes.data && createRes.data.code === 200) {
          setAiResponse('订单已自动发布成功！\n\n' +
            `标题：${orderData.title}\n` +
            `描述：${orderData.description}\n` +
            `价格：¥${orderData.price}`);
          setAiMessage('');
          setActiveTab('orders');
          loadOrders();
        } else {
          setAiResponse('订单创建失败，请重试。');
        }
      }
    } catch (error) {
      console.error('AI 自动发布失败:', error);
      setAiResponse('AI 自动发布失败，请稍后重试。');
    } finally {
      setAiLoading(false);
    }
  };

  const acceptOrder = async (orderId: string) => {
    if (!userInfo) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    try {
      const res = await Network.request({
        url: `/api/orders/${orderId}/accept`,
        method: 'POST',
        data: { accepterId: userInfo.id },
      });

      if (res.data && res.data.code === 200) {
        Taro.showToast({ title: '接单成功', icon: 'success' });
        loadOrders();
      } else {
        Taro.showToast({ title: '接单失败', icon: 'none' });
      }
    } catch (error) {
      console.error('接单失败:', error);
      Taro.showToast({ title: '接单失败', icon: 'none' });
    }
  };

  const getOrderTypeLabel = (type: string) => {
    const typeObj = ORDER_TYPES.find(t => t.value === type);
    return typeObj ? typeObj.label : '其他';
  };

  return (
    <View className="w-full min-h-screen bg-gray-50">
      <View className="bg-gradient-to-b from-blue-500 to-blue-600 p-6 text-white">
        <Text className="block text-2xl font-bold mb-2">校园互助平台</Text>
        <Text className="block text-sm opacity-90">
          {userInfo ? `欢迎，${userInfo.nickname}` : '登录中...'}
        </Text>
      </View>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="orders" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            订单大厅
          </TabsTrigger>
          <TabsTrigger value="publish" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            发布订单
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            AI 助手
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          {/* 定位和筛选 */}
          <View className="flex items-center justify-between mb-4">
            <View className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={requestLocation}
                className={`text-white ${locationStatus === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}
              >
                <MapPin size={16} color="white" />
                <Text className="ml-2">
                  {locationStatus === 'success' ? '已定位' : locationStatus === 'failed' ? '重新定位' : '获取位置'}
                </Text>
              </Button>
            </View>
            <Text className="text-xs text-gray-500">
              {userLocation ? '按距离排序' : '未定位'}
            </Text>
          </View>

          {/* 订单类型筛选 */}
          <View className="flex gap-2 mb-4 overflow-x-auto">
            {ORDER_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <Button
                  key={type.value}
                  size="sm"
                  className={`flex-shrink-0 ${selectedType === type.value ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                  onClick={() => setSelectedType(type.value)}
                >
                  <Icon size={14} color={selectedType === type.value ? 'white' : '#374151'} />
                  <Text className="ml-1">{type.label}</Text>
                </Button>
              );
            })}
          </View>

          {loading ? (
            <View className="text-center py-8">
              <Text className="text-gray-500">加载中...</Text>
            </View>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShoppingBag size={48} className="mx-auto text-gray-400 mb-4" />
                <Text className="block text-gray-500">
                  {selectedType === 'all' ? '暂无订单' : `暂无${getOrderTypeLabel(selectedType)}订单`}
                </Text>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card key={order.id} className="mb-3">
                <CardContent className="p-4">
                  <View className="flex justify-between items-start mb-2">
                    <View className="flex items-center gap-2">
                      {order.type === 'delivery_pickup' ? (
                        <Package size={16} color="#3B82F6" />
                      ) : order.type === 'delivery_food' ? (
                        <Utensils size={16} color="#F59E0B" />
                      ) : (
                        <ShoppingBag size={16} color="#6B7280" />
                      )}
                      <Text className="block font-semibold text-base">{order.title}</Text>
                    </View>
                    <Text className="block text-red-500 font-bold">¥{order.price}</Text>
                  </View>
                  <Text className="block text-sm text-gray-600 mb-3">{order.description}</Text>
                  <View className="flex items-center gap-1 mb-2">
                    <MapPin size={14} color="#6B7280" />
                    <Text className="text-xs text-gray-500">
                      {order.pickup_location?.address} → {order.delivery_location?.address}
                    </Text>
                  </View>
                  {order.distance !== undefined && (
                    <Text className="text-xs text-gray-500 mb-3">
                      距离: {order.distance.toFixed(2)} km
                    </Text>
                  )}
                  <Button
                    size="sm"
                    className="w-full bg-blue-500 text-white"
                    onClick={() => acceptOrder(order.id)}
                  >
                    接单
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="publish" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {/* 订单类型选择 */}
              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">订单类型</Text>
                <View className="flex gap-2">
                  <Button
                    size="sm"
                    className={`flex-1 ${orderForm.type === 'delivery_pickup' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    onClick={() => setOrderForm({ ...orderForm, type: 'delivery_pickup' })}
                  >
                    <Package size={16} color={orderForm.type === 'delivery_pickup' ? 'white' : '#374151'} />
                    <Text className="ml-2">代拿快递</Text>
                  </Button>
                  <Button
                    size="sm"
                    className={`flex-1 ${orderForm.type === 'delivery_food' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    onClick={() => setOrderForm({ ...orderForm, type: 'delivery_food' })}
                  >
                    <Utensils size={16} color={orderForm.type === 'delivery_food' ? 'white' : '#374151'} />
                    <Text className="ml-2">代取外卖</Text>
                  </Button>
                </View>
              </View>

              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">订单标题</Text>
                <Input
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="请输入订单标题"
                  value={orderForm.title}
                  onInput={(e) => setOrderForm({ ...orderForm, title: e.detail.value })}
                />
              </View>

              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">详细描述</Text>
                <Textarea
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full"
                  style={{ minHeight: '80px' }}
                  placeholder="请详细描述订单内容"
                  value={orderForm.description}
                  onInput={(e) => setOrderForm({ ...orderForm, description: e.detail.value })}
                />
              </View>

              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">取货地点</Text>
                <Input
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="请输入取货地点"
                  value={orderForm.pickupLocation}
                  onInput={(e) => setOrderForm({ ...orderForm, pickupLocation: e.detail.value })}
                />
              </View>

              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">送达地点</Text>
                <Input
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="请输入送达地点"
                  value={orderForm.deliveryLocation}
                  onInput={(e) => setOrderForm({ ...orderForm, deliveryLocation: e.detail.value })}
                />
              </View>

              <View className="mb-4">
                <Text className="block text-sm font-medium mb-2">报酬（元）</Text>
                <Input
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  type="number"
                  placeholder="请输入报酬金额"
                  value={orderForm.price}
                  onInput={(e) => setOrderForm({ ...orderForm, price: e.detail.value })}
                />
              </View>

              <Button
                className="w-full bg-blue-500 text-white"
                onClick={handlePublishOrder}
              >
                发布订单
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <View className="flex items-center gap-2 mb-4">
                <Sparkles size={20} color="#3B82F6" />
                <Text className="block font-semibold">AI 智能助手</Text>
              </View>

              <Textarea
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full mb-4"
                style={{ minHeight: '80px' }}
                placeholder="输入你的需求，让 AI 帮你找到合适的订单，或者用自然语言发布订单..."
                value={aiMessage}
                onInput={(e) => setAiMessage(e.detail.value)}
              />

              <View className="flex gap-2 mb-4">
                <Button
                  size="sm"
                  className="flex-1 bg-purple-500 text-white"
                  onClick={handleAiRecommend}
                  disabled={aiLoading}
                >
                  <Sparkles size={16} color="white" />
                  <Text className="ml-2">{aiLoading ? '分析中...' : '智能推荐'}</Text>
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-orange-500 text-white"
                  onClick={handleAiPublish}
                  disabled={aiLoading}
                >
                  <Text>{aiLoading ? '发布中...' : '自动发布'}</Text>
                </Button>
              </View>

              {aiResponse && (
                <View className="bg-blue-50 rounded-lg p-4">
                  <Text className="block text-sm text-gray-700 whitespace-pre-wrap">{aiResponse}</Text>
                </View>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </View>
  );
};

export default IndexPage;
