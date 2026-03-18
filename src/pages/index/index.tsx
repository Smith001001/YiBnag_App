import { View, Text, Textarea } from '@tarojs/components';
import Taro, { getEnv, ENV_TYPE, useDidShow } from '@tarojs/taro';
import { useState, useEffect } from 'react';
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

  // 页面显示时重新加载订单数据
  useDidShow(() => {
    if (userInfo) {
      loadOrders();
    }
  });

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
      // 从后端加载所有订单
      const res = await Network.request({ url: '/api/orders' });
      
      if (res.data && res.data.code === 200) {
        const allOrders = (res.data.data || []).map((order: any) => ({
          ...order,
        }));
        setOrders(allOrders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('加载订单失败:', error);
      setOrders([]);
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

  const acceptOrder = async (orderId: string) => {
    if (!userInfo) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    try {
      // 直接调用后端接单接口
      const res = await Network.request({
        url: `/api/orders/${orderId}/accept`,
        method: 'POST',
        data: { accepterId: userInfo.id },
      });

      console.log('接单响应:', res.data);

      if (res.data && res.data.code === 200) {
        Taro.showToast({ title: '接单成功', icon: 'success' });
        loadOrders();
      } else {
        Taro.showToast({ title: res.data?.msg || '接单失败', icon: 'none' });
      }
    } catch (error) {
      console.error('接单失败:', error);
      Taro.showToast({ title: '接单失败', icon: 'none' });
    }
  };

  // AI助手处理 - 使用AI理解用户意图
  const handleAiSend = async () => {
    if (!aiInput.trim()) {
      return;
    }

    const userMessage = aiInput.trim();
    setAiInput('');
    setAiConversations(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiLoading(true);

    try {
      // 调用AI意图识别接口
      const intentRes = await Network.request({
        url: '/api/ai/understand-intent',
        method: 'POST',
        data: {
          message: userMessage,
          context: aiConversations.slice(-6), // 最近6轮对话
        },
      });

      if (intentRes.data?.code === 200) {
        const { intent, extractedInfo, response } = intentRes.data.data;

        switch (intent) {
          case 'publish_order':
            // 发布订单意图
            await handleAiPublishFlow(userMessage, extractedInfo, response);
            break;
          case 'recommend_order':
            // 推荐订单意图
            setAiConversations(prev => [...prev, { role: 'assistant', content: response }]);
            await handleAiRecommendFlow(userMessage);
            break;
          case 'confirm':
            // 确认发布订单
            if (aiOrderData) {
              setAiConversations(prev => [...prev, { role: 'assistant', content: '好的，正在为您发布订单...' }]);
              await confirmPublishOrder();
            } else {
              setAiConversations(prev => [...prev, { role: 'assistant', content: '请先告诉我您想发布什么订单，比如"帮我找人拿快递"。' }]);
            }
            break;
          case 'cancel':
            // 取消发布
            if (aiOrderData) {
              setAiOrderData(null);
              setAiConversations(prev => [...prev, { role: 'assistant', content: '好的，已取消发布订单。有其他需要帮助的吗？' }]);
            } else {
              setAiConversations(prev => [...prev, { role: 'assistant', content: response }]);
            }
            break;
          case 'modify':
            // 修改信息
            if (aiOrderData) {
              setAiConversations(prev => [...prev, { role: 'assistant', content: '好的，请告诉我您想修改哪些信息？比如"取货地点改为食堂"' }]);
            } else {
              setAiConversations(prev => [...prev, { role: 'assistant', content: '请先告诉我您想发布什么订单。' }]);
            }
            break;
          case 'provide_info':
            // 补充信息
            if (aiOrderData) {
              await handleProvideInfo(userMessage, extractedInfo);
            } else {
              // 如果没有待发布的订单，可能是用户在描述新订单
              await handleAiPublishFlow(userMessage, extractedInfo, response);
            }
            break;
          default:
            // 普通对话
            setAiConversations(prev => [...prev, { role: 'assistant', content: response }]);
        }
      } else {
        // 意图识别失败，使用备用逻辑
        await handleAiFallback(userMessage);
      }
    } catch (error) {
      console.error('AI处理失败:', error);
      await handleAiFallback(userMessage);
    } finally {
      setAiLoading(false);
    }
  };

  // 处理发布订单意图
  const handleAiPublishFlow = async (_userMessage: string, extractedInfo: any, _aiResponse: string) => {
    try {
      // 检查是否有任何提取到的信息
      const hasAnyInfo = extractedInfo && (
        extractedInfo.type || 
        extractedInfo.title || 
        extractedInfo.description || 
        extractedInfo.pickupAddress || 
        extractedInfo.deliveryAddress ||
        extractedInfo.price
      );

      if (hasAnyInfo) {
        // 构建订单数据 - 只使用用户提供的信息，不使用默认值
        const orderData = {
          publisher_id: userInfo?.id,
          type: extractedInfo.type || null,
          title: extractedInfo.title || null,
          description: extractedInfo.description || _userMessage,
          pickup_location: extractedInfo.pickupAddress 
            ? { latitude: 0, longitude: 0, address: extractedInfo.pickupAddress }
            : null,
          delivery_location: extractedInfo.deliveryAddress
            ? { latitude: 0, longitude: 0, address: extractedInfo.deliveryAddress }
            : null,
          price: extractedInfo.price || null, // 必须用户自己提供，不能用默认值
          images: [],
        };

        // 检查缺失的必填信息
        const missingInfo: string[] = [];
        if (!orderData.type) {
          missingInfo.push('订单类型（代拿快递/代取外卖）');
        }
        if (!orderData.pickup_location) {
          missingInfo.push('取货地点');
        }
        if (!orderData.delivery_location) {
          missingInfo.push('送达地点');
        }
        if (!orderData.price) {
          missingInfo.push('报酬金额');
        }

        // 保存当前订单数据
        setAiOrderData(orderData);

        if (missingInfo.length > 0) {
          // 信息不完整，引导用户补充
          const currentInfo: string[] = [];
          if (orderData.type) {
            currentInfo.push(`📋 类型：${orderData.type === 'delivery_pickup' ? '代拿快递' : orderData.type === 'delivery_food' ? '代取外卖' : '其他'}`);
          }
          if (orderData.price) {
            currentInfo.push(`💰 报酬：¥${orderData.price}`);
          }
          if (orderData.pickup_location) {
            currentInfo.push(`📍 取货：${orderData.pickup_location.address}`);
          }
          if (orderData.delivery_location) {
            currentInfo.push(`📍 送达：${orderData.delivery_location.address}`);
          }

          const infoText = currentInfo.length > 0 
            ? `当前已记录的信息：\n${currentInfo.join('\n')}\n\n` 
            : '';
          
          setAiConversations(prev => [...prev, {
            role: 'assistant',
            content: `${infoText}还需要您提供以下信息：\n${missingInfo.map((info, i) => `${i + 1}. ${info}`).join('\n')}\n\n请补充完整后才能发布订单。`
          }]);
        } else {
          // 所有必填信息都已提供，可以确认发布
          setAiConversations(prev => [...prev, {
            role: 'assistant',
            content: `好的，订单信息已完整：\n\n📋 类型：${orderData.type === 'delivery_pickup' ? '代拿快递' : orderData.type === 'delivery_food' ? '代取外卖' : '其他'}\n💰 报酬：¥${orderData.price}\n📍 取货：${orderData.pickup_location?.address}\n📍 送达：${orderData.delivery_location?.address}\n\n请回复"确认"发布订单，或"修改"调整信息，或"取消"放弃发布。`
          }]);
        }
      } else {
        // 没有提取到任何信息，引导用户提供
        setAiConversations(prev => [...prev, {
          role: 'assistant',
          content: `好的，我来帮您发布订单！请告诉我以下信息：\n\n1. 订单类型（代拿快递/代取外卖）\n2. 取货地点\n3. 送达地点\n4. 报酬金额\n\n您可以一次性告诉我，比如"帮我拿个快递，在图书馆取货，送到A教，11块钱"。`
        }]);
      }
    } catch (error) {
      console.error('发布订单处理失败:', error);
      setAiConversations(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，处理遇到了问题。请告诉我：订单类型、取货地点、送达地点、报酬金额，我会帮您创建订单。'
      }]);
    }
  };

  // 处理补充信息
  const handleProvideInfo = async (_userMessage: string, extractedInfo: any) => {
    if (!aiOrderData) {
      setAiConversations(prev => [...prev, {
        role: 'assistant',
        content: '请先告诉我您想发布什么订单。'
      }]);
      return;
    }

    // 更新订单数据 - 只更新用户提供的信息
    const updatedOrder = { ...aiOrderData };
    
    if (extractedInfo?.pickupAddress) {
      updatedOrder.pickup_location = { latitude: 0, longitude: 0, address: extractedInfo.pickupAddress };
    }
    if (extractedInfo?.deliveryAddress) {
      updatedOrder.delivery_location = { latitude: 0, longitude: 0, address: extractedInfo.deliveryAddress };
    }
    if (extractedInfo?.price) {
      updatedOrder.price = extractedInfo.price;
    }
    if (extractedInfo?.type) {
      updatedOrder.type = extractedInfo.type;
    }
    if (extractedInfo?.title) {
      updatedOrder.title = extractedInfo.title;
    }

    setAiOrderData(updatedOrder);

    // 检查是否还有缺失的必填信息
    const missingInfo: string[] = [];
    if (!updatedOrder.type) {
      missingInfo.push('订单类型（代拿快递/代取外卖）');
    }
    if (!updatedOrder.pickup_location?.address) {
      missingInfo.push('取货地点');
    }
    if (!updatedOrder.delivery_location?.address) {
      missingInfo.push('送达地点');
    }
    if (!updatedOrder.price) {
      missingInfo.push('报酬金额');
    }

    if (missingInfo.length === 0) {
      // 所有信息已完整
      setAiConversations(prev => [...prev, {
        role: 'assistant',
        content: `好的，信息已更新。订单信息完整：\n\n📋 类型：${updatedOrder.type === 'delivery_pickup' ? '代拿快递' : updatedOrder.type === 'delivery_food' ? '代取外卖' : '其他'}\n💰 报酬：¥${updatedOrder.price}\n📍 取货：${updatedOrder.pickup_location?.address}\n📍 送达：${updatedOrder.delivery_location?.address}\n\n请回复"确认"发布订单，或"修改"调整信息，或"取消"放弃发布。`
      }]);
    } else {
      // 还有缺失信息
      const currentInfo: string[] = [];
      if (updatedOrder.type) {
        currentInfo.push(`📋 类型：${updatedOrder.type === 'delivery_pickup' ? '代拿快递' : updatedOrder.type === 'delivery_food' ? '代取外卖' : '其他'}`);
      }
      if (updatedOrder.price) {
        currentInfo.push(`💰 报酬：¥${updatedOrder.price}`);
      }
      if (updatedOrder.pickup_location?.address) {
        currentInfo.push(`📍 取货：${updatedOrder.pickup_location.address}`);
      }
      if (updatedOrder.delivery_location?.address) {
        currentInfo.push(`📍 送达：${updatedOrder.delivery_location.address}`);
      }

      const infoText = currentInfo.length > 0 
        ? `当前已记录的信息：\n${currentInfo.join('\n')}\n\n` 
        : '';
      
      setAiConversations(prev => [...prev, {
        role: 'assistant',
        content: `${infoText}还需要您提供以下信息：\n${missingInfo.map((info, i) => `${i + 1}. ${info}`).join('\n')}\n\n请补充完整后才能发布订单。`
      }]);
    }
  };

  // 确认发布订单
  const confirmPublishOrder = async () => {
    if (!aiOrderData) {
      setAiConversations(prev => [...prev, {
        role: 'assistant',
        content: '请先告诉我您想发布什么订单。'
      }]);
      return;
    }

    // 再次检查所有必填信息是否完整
    const missingInfo: string[] = [];
    if (!aiOrderData.type) {
      missingInfo.push('订单类型');
    }
    if (!aiOrderData.pickup_location?.address) {
      missingInfo.push('取货地点');
    }
    if (!aiOrderData.delivery_location?.address) {
      missingInfo.push('送达地点');
    }
    if (!aiOrderData.price) {
      missingInfo.push('报酬金额');
    }

    if (missingInfo.length > 0) {
      // 信息不完整，禁止发布
      setAiConversations(prev => [...prev, {
        role: 'assistant',
        content: `订单信息不完整，还需要您提供：\n${missingInfo.map((info, i) => `${i + 1}. ${info}`).join('\n')}\n\n请补充完整后才能发布订单。`
      }]);
      return;
    }

    try {
      // 转换字段名为后端期望的格式
      const orderPayload = {
        publisherId: aiOrderData.publisher_id || userInfo?.id,
        type: aiOrderData.type,
        title: aiOrderData.title || (aiOrderData.type === 'delivery_pickup' ? '代拿快递' : aiOrderData.type === 'delivery_food' ? '代取外卖' : '校园互助订单'),
        description: aiOrderData.description,
        pickupLocation: aiOrderData.pickup_location,
        deliveryLocation: aiOrderData.delivery_location,
        price: aiOrderData.price,
        images: aiOrderData.images || [],
      };

      console.log('发布订单数据:', orderPayload);

      const createRes = await Network.request({
        url: '/api/orders',
        method: 'POST',
        data: orderPayload,
      });

      console.log('发布订单响应:', createRes.data);

      if (createRes.data?.code === 200) {
        setAiConversations(prev => [...prev, {
          role: 'assistant',
          content: `✅ 订单发布成功！\n\n📋 ${aiOrderData.title}\n💰 报酬：¥${aiOrderData.price}\n📍 取货：${aiOrderData.pickup_location?.address}\n📍 送达：${aiOrderData.delivery_location?.address}\n\n您可以在"我的订单"中查看详情。`
        }]);
        setAiOrderData(null);
        loadOrders();
      } else {
        const errorMsg = createRes.data?.msg || '订单创建失败';
        console.error('订单创建失败:', errorMsg);
        setAiConversations(prev => [...prev, {
          role: 'assistant',
          content: `订单创建失败：${errorMsg}\n\n请检查信息后重试，或直接说"取消"放弃发布。`
        }]);
      }
    } catch (error) {
      console.error('确认发布失败:', error);
      setAiConversations(prev => [...prev, {
        role: 'assistant',
        content: '订单创建失败，请稍后重试。'
      }]);
    }
  };

  const handleAiRecommendFlow = async (userMessage: string) => {
    try {
      const res = await Network.request({
        url: '/api/ai/recommend',
        method: 'POST',
        data: {
          userDescription: userMessage,
          userLatitude: userLocation?.latitude,
          userLongitude: userLocation?.longitude,
        },
      });

      console.log('AI推荐响应:', res.data);

      if (res.data?.code === 200) {
        const recommendations = res.data.data;
        if (recommendations && recommendations.length > 0) {
          // 后端已返回完整订单信息，直接使用
          let responseText = '为您找到以下合适的订单：\n\n';
          recommendations.forEach((rec: any, index: number) => {
            responseText += `${index + 1}. ${rec.title}\n`;
            responseText += `   📦 类型：${rec.type}\n`;
            responseText += `   📍 ${rec.pickupAddress} → ${rec.deliveryAddress}\n`;
            responseText += `   💰 报酬：¥${rec.price}\n`;
            responseText += `   📊 匹配度：${rec.matchScore}%\n`;
            responseText += `   💡 ${rec.matchReason}\n\n`;
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
    } catch (error) {
      console.error('推荐订单失败:', error);
      setAiConversations(prev => [...prev, { 
        role: 'assistant', 
        content: '推荐失败，请去"订单大厅"查看所有订单。' 
      }]);
    }
  };

  // 备用处理逻辑
  const handleAiFallback = async (userMessage: string) => {
    // 检查是否是确认发布
    if (aiOrderData && (userMessage === '确认' || userMessage === '发布' || userMessage === '确认发布')) {
      await confirmPublishOrder();
      return;
    }

    // 默认回复
    setAiConversations(prev => [...prev, {
      role: 'assistant',
      content: '我可以帮您：\n\n1. 发布订单 - 告诉我"我想找人帮我拿快递"或"发布一个代取外卖的订单"\n2. 推荐订单 - 告诉我"帮我推荐合适的订单"\n\n请问您需要什么帮助？'
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
          <TabsTrigger value="orders">
            订单大厅
          </TabsTrigger>
          <TabsTrigger value="publish">
            发布订单
          </TabsTrigger>
          <TabsTrigger value="ai">
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
              const isSelected = selectedType === type.value;
              // 代取外卖用橙色，其他用蓝色
              const bgColor = isSelected 
                ? (type.value === 'delivery_food' ? 'bg-orange-500' : 'bg-blue-500')
                : 'bg-gray-200';
              const textColor = isSelected ? 'text-white' : 'text-gray-700';
              const iconColor = isSelected ? 'white' : '#374151';
              
              return (
                <Button
                  key={type.value}
                  size="sm"
                  className={`flex-shrink-0 ${bgColor} ${textColor}`}
                  onClick={() => setSelectedType(type.value)}
                >
                  <Icon size={14} color={iconColor} />
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
                <View className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <Textarea
                    style={{ width: '100%', minHeight: '80px', backgroundColor: 'transparent' }}
                    placeholder="请详细描述订单内容"
                    value={orderForm.description}
                    onInput={(e) => setOrderForm({ ...orderForm, description: e.detail.value })}
                    maxlength={500}
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
