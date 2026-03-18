import { View, Text } from '@tarojs/components';
import Taro, { getEnv, ENV_TYPE } from '@tarojs/taro';
import { useState, useEffect, useCallback } from 'react';
import { Network } from '@/network';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, ShoppingBag, Sparkles, Package, Utensils, Send } from 'lucide-react-taro';
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
  is_mock?: boolean;
};

type UserInfo = {
  id: string;
  openid: string;
  nickname: string;
  avatar: string;
};

type AIConversation = {
  role: 'user' | 'assistant';
  content: string;
};

const ORDER_TYPES = [
  { value: 'all', label: '全部', icon: ShoppingBag },
  { value: 'delivery_pickup', label: '代拿快递', icon: Package },
  { value: 'delivery_food', label: '代取外卖', icon: Utensils },
];

// 模拟订单数据
const MOCK_ORDERS: Order[] = [
  {
    id: 'mock-1',
    title: '代拿快递 - 京东包裹',
    description: '帮忙从校门口取快递，送到3号宿舍楼',
    type: 'delivery_pickup',
    price: 5,
    pickup_location: { latitude: 39.9042, longitude: 116.4074, address: '校门口快递点' },
    delivery_location: { latitude: 39.9052, longitude: 116.4084, address: '3号宿舍楼' },
    status: 'pending',
    distance: 0.5,
    is_mock: true,
  },
  {
    id: 'mock-2',
    title: '代取外卖 - 麦当劳',
    description: '帮忙从麦当劳取外卖，送到图书馆',
    type: 'delivery_food',
    price: 6,
    pickup_location: { latitude: 39.9062, longitude: 116.4094, address: '麦当劳' },
    delivery_location: { latitude: 39.9072, longitude: 116.4104, address: '图书馆' },
    status: 'pending',
    distance: 0.8,
    is_mock: true,
  },
  {
    id: 'mock-3',
    title: '代拿快递 - 顺丰包裹',
    description: '帮忙从顺丰网点取快递，送到食堂',
    type: 'delivery_pickup',
    price: 4,
    pickup_location: { latitude: 39.9082, longitude: 116.4114, address: '顺丰网点' },
    delivery_location: { latitude: 39.9092, longitude: 116.4124, address: '学生食堂' },
    status: 'pending',
    distance: 1.2,
    is_mock: true,
  },
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

  // AI 助手 - 多轮对话
  const [aiConversations, setAiConversations] = useState<AIConversation[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOrderData, setAiOrderData] = useState<any>(null);

  const isWeapp = getEnv() === ENV_TYPE.WEAPP;

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (userInfo) {
      loadOrders();
      requestLocation();
    }
  }, [userInfo]);

  useEffect(() => {
    filterOrders();
  }, [orders, selectedType]);

  // 初始化AI助手对话
  useEffect(() => {
    if (activeTab === 'ai' && aiConversations.length === 0) {
      setAiConversations([
        { role: 'assistant', content: '你好！我是校园互助助手。你可以告诉我需要什么帮助，比如：\n\n1. "我想发布一个代拿快递的订单"\n2. "帮我推荐合适的订单"\n\n请问你需要什么帮助？' }
      ]);
    }
  }, [activeTab, aiConversations.length]);

  const filterOrders = () => {
    let filtered = orders.filter(order => order.status === 'pending');
    if (selectedType !== 'all') {
      filtered = filtered.filter(order => order.type === selectedType);
    }
    setFilteredOrders(filtered);
  };

  const initUser = async () => {
    try {
      // 先从本地存储获取用户信息
      const storedUser = Taro.getStorageSync('userInfo');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserInfo(user);
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
      try {
        const setting = await Taro.getSetting();
        if (setting.authSetting['scope.userLocation'] === false) {
          const { confirm } = await Taro.showModal({
            title: '需要位置权限',
            content: '请在设置中开启位置权限，以便获取附近订单',
          });
          if (confirm) {
            await Taro.openSetting();
            getLocation();
          } else {
            setLocationStatus('failed');
          }
        } else {
          await getLocation();
        }
      } catch (error) {
        console.error('检查位置权限失败:', error);
        setLocationStatus('failed');
      }
    } else {
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
    } catch (error) {
      console.error('获取位置失败:', error);
      setLocationStatus('failed');
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      // 从后端加载真实订单
      const res = await Network.request({ url: '/api/orders' });
      let realOrders: Order[] = [];
      
      if (res.data && res.data.code === 200) {
        realOrders = (res.data.data || []).map((order: any) => ({
          ...order,
          is_mock: false,
        }));
      }

      // 保留3个模拟订单（如果真实订单少于3个）
      const mockOrdersNeeded = Math.max(0, 3 - realOrders.filter(o => o.status === 'pending').length);
      const mockOrders = MOCK_ORDERS.slice(0, mockOrdersNeeded);
      
      // 合并订单：真实订单 + 模拟订单
      setOrders([...realOrders, ...mockOrders]);
    } catch (error) {
      console.error('加载订单失败:', error);
      // 如果加载失败，使用模拟订单
      setOrders(MOCK_ORDERS);
    } finally {
      setLoading(false);
    }
  };

  // 生成新的模拟订单
  const generateNewMockOrder = useCallback(() => {
    const types = ['delivery_pickup', 'delivery_food'];
    const titles = [
      ['代拿快递 - 菜鸟驿站', '代拿快递 - 邮政局', '代拿快递 - 天猫超市'],
      ['代取外卖 - 肯德基', '代取外卖 - 瑞幸咖啡', '代取外卖 - 喜茶'],
    ];
    const locations = ['校门口', '食堂', '图书馆', '宿舍楼', '教学楼'];
    
    const typeIndex = Math.random() > 0.5 ? 0 : 1;
    const type = types[typeIndex];
    const titleList = titles[typeIndex];
    const title = titleList[Math.floor(Math.random() * titleList.length)];
    const pickup = locations[Math.floor(Math.random() * locations.length)];
    const delivery = locations[Math.floor(Math.random() * locations.length)];
    
    return {
      id: 'mock-' + Date.now(),
      title,
      description: `帮忙从${pickup}取件，送到${delivery}`,
      type,
      price: Math.floor(Math.random() * 6) + 3, // 3-8元
      pickup_location: { latitude: 39.9042, longitude: 116.4074, address: pickup },
      delivery_location: { latitude: 39.9052, longitude: 116.4084, address: delivery },
      status: 'pending',
      distance: Math.random() * 2 + 0.1,
      is_mock: true,
    };
  }, []);

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

  const acceptOrder = async (orderId: string, isMock: boolean) => {
    if (!userInfo) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    try {
      if (isMock) {
        // 模拟接单：直接从列表移除，并生成新订单
        setOrders(prev => {
          const newOrders = prev.filter(o => o.id !== orderId);
          const newMockOrder = generateNewMockOrder();
          return [...newOrders, newMockOrder];
        });
        Taro.showToast({ title: '接单成功', icon: 'success' });
      } else {
        // 真实订单：调用后端接口
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
      }
    } catch (error) {
      console.error('接单失败:', error);
      Taro.showToast({ title: '接单失败', icon: 'none' });
    }
  };

  // AI助手处理
  const handleAiSend = async () => {
    if (!aiInput.trim()) {
      return;
    }

    const userMessage = aiInput.trim();
    setAiInput('');
    setAiConversations(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiLoading(true);

    try {
      // 判断用户意图
      const isPublishIntent = userMessage.includes('发布') || userMessage.includes('发布订单') || userMessage.includes('帮我下单');
      const isRecommendIntent = userMessage.includes('推荐') || userMessage.includes('找订单') || userMessage.includes('有什么订单');

      if (isPublishIntent) {
        // 发布订单意图
        await handleAiPublishFlow(userMessage);
      } else if (isRecommendIntent) {
        // 推荐订单意图
        await handleAiRecommendFlow(userMessage);
      } else {
        // 普通对话
        await handleAiChat(userMessage);
      }
    } catch (error) {
      console.error('AI处理失败:', error);
      setAiConversations(prev => [...prev, { 
        role: 'assistant', 
        content: '抱歉，我遇到了一些问题，请稍后再试。' 
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiPublishFlow = async (userMessage: string) => {
    // 解析订单信息
    const res = await Network.request({
      url: '/api/ai/parse-order',
      method: 'POST',
      data: {
        text: userMessage,
        publisherId: userInfo?.id,
        pickupLocation: userLocation || { latitude: 0, longitude: 0, address: '当前位置' },
        deliveryLocation: { latitude: 0, longitude: 0, address: '目标地点' },
      },
    });

    if (res.data?.code === 200) {
      const orderData = res.data.data;
      setAiOrderData(orderData);

      // 检查是否有缺失信息
      const missingInfo: string[] = [];
      if (!orderData.title || orderData.title === '未命名订单') {
        missingInfo.push('订单标题');
      }
      if (!orderData.pickup_location?.address) {
        missingInfo.push('取货地点');
      }
      if (!orderData.delivery_location?.address) {
        missingInfo.push('送达地点');
      }

      if (missingInfo.length > 0) {
        // 引导用户补充信息
        setAiConversations(prev => [...prev, {
          role: 'assistant',
          content: `我已经理解了您的需求：\n\n📋 订单类型：${orderData.type === 'delivery_pickup' ? '代拿快递' : '代取外卖'}\n💰 价格：¥${orderData.price}\n📝 描述：${orderData.description}\n\n还需要您提供以下信息：\n${missingInfo.map((info, i) => `${i + 1}. ${info}`).join('\n')}\n\n请告诉我这些信息，或者直接输入"确认发布"来创建订单。`
        }]);
      } else {
        // 信息完整，直接发布
        const createRes = await Network.request({
          url: '/api/orders',
          method: 'POST',
          data: orderData,
        });

        if (createRes.data?.code === 200) {
          setAiConversations(prev => [...prev, {
            role: 'assistant',
            content: `✅ 订单发布成功！\n\n📋 ${orderData.title}\n💰 报酬：¥${orderData.price}\n📍 取货：${orderData.pickup_location?.address}\n📍 送达：${orderData.delivery_location?.address}\n\n您可以在"我的订单"中查看详情。`
          }]);
          setAiOrderData(null);
          loadOrders();
        } else {
          setAiConversations(prev => [...prev, {
            role: 'assistant',
            content: '订单创建失败，请重试。'
          }]);
        }
      }
    } else {
      setAiConversations(prev => [...prev, {
        role: 'assistant',
        content: '我理解了您想发布订单，请告诉我更多详情，比如：取货地点、送达地点、报酬等。'
      }]);
    }
  };

  const handleAiRecommendFlow = async (userMessage: string) => {
    const res = await Network.request({
      url: '/api/ai/recommend',
      method: 'POST',
      data: {
        userDescription: userMessage,
        userLatitude: userLocation?.latitude,
        userLongitude: userLocation?.longitude,
      },
    });

    if (res.data?.code === 200) {
      const recommendations = res.data.data;
      if (recommendations && recommendations.length > 0) {
        let responseText = '为您推荐以下订单：\n\n';
        recommendations.forEach((rec: any, index: number) => {
          responseText += `${index + 1}. ${rec.matchReason}\n   匹配度：${rec.matchScore}%\n\n`;
        });
        responseText += '您可以在"订单大厅"中查看并接单。';
        setAiConversations(prev => [...prev, { role: 'assistant', content: responseText }]);
      } else {
        setAiConversations(prev => [...prev, { 
          role: 'assistant', 
          content: '暂时没有找到合适的订单，您可以稍后再试或去"订单大厅"查看所有订单。' 
        }]);
      }
    } else {
      setAiConversations(prev => [...prev, { 
        role: 'assistant', 
        content: '推荐失败，请稍后再试。' 
      }]);
    }
  };

  const handleAiChat = async (userMessage: string) => {
    // 检查是否是补充信息
    if (aiOrderData) {
      // 解析用户补充的信息
      if (userMessage.includes('取货') || userMessage.includes('从')) {
        aiOrderData.pickup_location = { ...aiOrderData.pickup_location, address: userMessage.replace('取货地点：', '').replace('从', '') };
      }
      if (userMessage.includes('送达') || userMessage.includes('到')) {
        aiOrderData.delivery_location = { ...aiOrderData.delivery_location, address: userMessage.replace('送达地点：', '').replace('到', '') };
      }
      if (userMessage === '确认发布') {
        const createRes = await Network.request({
          url: '/api/orders',
          method: 'POST',
          data: aiOrderData,
        });

        if (createRes.data?.code === 200) {
          setAiConversations(prev => [...prev, {
            role: 'assistant',
            content: `✅ 订单发布成功！\n\n📋 ${aiOrderData.title}\n💰 报酬：¥${aiOrderData.price}\n\n您可以在"我的订单"中查看详情。`
          }]);
          setAiOrderData(null);
          loadOrders();
        }
        return;
      }
    }

    // 默认回复
    setAiConversations(prev => [...prev, {
      role: 'assistant',
      content: '我可以帮您：\n\n1. 发布订单 - 告诉我"我想发布一个代拿快递的订单"\n2. 推荐订单 - 告诉我"帮我推荐合适的订单"\n\n请问您需要什么帮助？'
    }]);
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
                <Text className="block text-gray-500">暂无订单</Text>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card key={order.id} className="mb-3">
                <CardContent className="p-4">
                  <View className="flex justify-between items-start mb-2">
                    <View className="flex items-center gap-2 flex-1">
                      {getOrderTypeIcon(order.type)}
                      <Text className="block font-semibold text-base flex-1">{order.title}</Text>
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
                    onClick={() => acceptOrder(order.id, order.is_mock || false)}
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
                <View className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <Input
                    className="w-full px-3 py-2 bg-transparent"
                    style={{ minHeight: '80px' }}
                    placeholder="请详细描述订单内容"
                    value={orderForm.description}
                    onInput={(e) => setOrderForm({ ...orderForm, description: e.detail.value })}
                  />
                </View>
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
          <Card className="h-96">
            <CardContent className="p-4 h-full flex flex-col">
              <View className="flex items-center gap-2 mb-4">
                <Sparkles size={20} color="#3B82F6" />
                <Text className="block font-semibold">AI 智能助手</Text>
              </View>

              {/* 对话历史 */}
              <View className="flex-1 overflow-y-auto mb-4" style={{ maxHeight: '300px' }}>
                {aiConversations.map((msg, index) => (
                  <View 
                    key={index} 
                    className={`mb-3 p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white ml-8' : 'bg-gray-100 text-gray-700 mr-8'}`}
                  >
                    <Text className="block text-sm whitespace-pre-wrap">{msg.content}</Text>
                  </View>
                ))}
                {aiLoading && (
                  <View className="bg-gray-100 rounded-lg p-3 mr-8">
                    <Text className="text-sm text-gray-500">思考中...</Text>
                  </View>
                )}
              </View>

              {/* 输入区域 */}
              <View className="flex gap-2 items-center">
                <View className="flex-1 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <Input
                    className="w-full px-3 py-2 bg-transparent"
                    placeholder="输入您的需求..."
                    value={aiInput}
                    onInput={(e) => setAiInput(e.detail.value)}
                    onConfirm={handleAiSend}
                  />
                </View>
                <Button
                  size="sm"
                  className="bg-blue-500 text-white flex-shrink-0"
                  onClick={handleAiSend}
                  disabled={aiLoading}
                >
                  <Send size={16} color="white" />
                </Button>
              </View>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </View>
  );
};

export default IndexPage;
