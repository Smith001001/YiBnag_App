import { Injectable } from '@nestjs/common';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface OrderRecommendation {
  orderId: string;
  matchReason: string;
  matchScore: number;
}

@Injectable()
export class AiService {
  private client = getSupabaseClient();
  private llmClient: LLMClient;

  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
  }

  async recommendOrders(userDescription: string, userLatitude?: number, userLongitude?: number): Promise<OrderRecommendation[]> {
    // 获取所有待处理的订单
    const { data: orders, error } = await this.client
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !orders || orders.length === 0) {
      return [];
    }

    // 构建订单列表文本
    const ordersText = orders.map((order, index) => {
      return `${index + 1}. 订单ID: ${order.id}
         类型: ${this.translateOrderType(order.type)}
         标题: ${order.title}
         描述: ${order.description}
         取货地点: ${order.pickup_location?.address}
         送达地点: ${order.delivery_location?.address}
         价格: ¥${order.price}
         截止时间: ${order.deadline || '无'}`;
    }).join('\n\n');

    // 构建系统提示词
    const systemPrompt = `你是一个校园互助平台的智能推荐助手。根据用户的需求描述，从可用的订单列表中推荐最合适的订单。

推荐标准：
1. 匹配用户的需求类型（代拿快递、代取外卖、跑腿等）
2. 考虑地理位置（如果用户提供了位置信息）
3. 考虑价格合理性
4. 考虑截止时间紧迫性

订单类型翻译：
- delivery_pickup: 代拿快递
- delivery_food: 代取外卖
- errand: 跑腿代办
- other: 其他

请以 JSON 格式返回推荐结果，包含以下字段：
- orderIds: 推荐的订单ID数组（最多5个）
- recommendations: 推荐理由，每个订单的推荐理由
- scores: 匹配分数（0-100）

示例返回格式：
{
  "orderIds": ["订单ID1", "订单ID2"],
  "recommendations": ["推荐理由1", "推荐理由2"],
  "scores": [90, 85]
}`;

    // 构建用户消息
    const userMessage = `用户需求描述：${userDescription}

当前可用的订单列表：
${ordersText}

请根据用户需求，推荐最合适的订单。`;

    try {
      // 调用 LLM
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.7,
      });

      // 解析 LLM 返回的 JSON
      const result = this.parseAIResponse(response.content);

      // 构建推荐结果
      const recommendations: OrderRecommendation[] = [];
      if (result.orderIds && Array.isArray(result.orderIds)) {
        for (let i = 0; i < result.orderIds.length; i++) {
          recommendations.push({
            orderId: result.orderIds[i],
            matchReason: result.recommendations?.[i] || '匹配度较高',
            matchScore: result.scores?.[i] || 80,
          });
        }
      }

      return recommendations;
    } catch (error) {
      console.error('AI 推荐失败:', error);
      // 如果 AI 失败，返回所有订单作为默认推荐
      return orders.map(order => ({
        orderId: order.id,
        matchReason: '系统默认推荐',
        matchScore: 60,
      }));
    }
  }

  async parseOrderFromText(text: string, publisherId: string, pickupLocation: any, deliveryLocation: any): Promise<any> {
    const systemPrompt = `你是一个校园互助平台的智能订单解析助手。根据用户的自然语言描述，解析出订单信息。

订单类型：
- delivery_pickup: 代拿快递
- delivery_food: 代取外卖
- errand: 跑腿代办
- other: 其他

请以 JSON 格式返回解析结果，包含以下字段：
- type: 订单类型
- title: 订单标题（简短描述）
- description: 详细描述
- price: 预估价格（数字）
- pickup_address: 取货地点（如果能从描述中提取）
- delivery_address: 送达地点（如果能从描述中提取）

示例：
输入："帮忙拿一个快递到图书馆，愿意出5块钱"
输出：
{
  "type": "delivery_pickup",
  "title": "代拿快递",
  "description": "帮忙拿一个快递到图书馆",
  "price": 5,
  "pickup_address": null,
  "delivery_address": "图书馆"
}`;

    const userMessage = `用户描述：${text}

请解析出订单信息。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.5,
      });

      const parsed = this.parseAIResponse(response.content);

      // 使用解析出的地址，如果没有则使用默认值
      const finalPickupLocation = parsed.pickup_address 
        ? { ...pickupLocation, address: parsed.pickup_address }
        : pickupLocation;
      const finalDeliveryLocation = parsed.delivery_address 
        ? { ...deliveryLocation, address: parsed.delivery_address }
        : deliveryLocation;

      return {
        publisher_id: publisherId,
        type: parsed.type || 'other',
        title: parsed.title || '未命名订单',
        description: parsed.description || text,
        pickup_location: finalPickupLocation,
        delivery_location: finalDeliveryLocation,
        price: parsed.price || 5,
        images: [],
      };
    } catch (error) {
      console.error('AI 解析失败:', error);
      // 如果 AI 失败，返回默认订单信息
      return {
        publisher_id: publisherId,
        type: 'other',
        title: '未命名订单',
        description: text,
        pickup_location: pickupLocation,
        delivery_location: deliveryLocation,
        price: 5,
        images: [],
      };
    }
  }

  /**
   * 理解用户意图
   * @param message 用户消息
   * @param context 对话上下文
   * @returns 意图识别结果
   */
  async understandIntent(message: string, context: Array<{ role: string; content: string }> = []): Promise<{
    intent: 'publish_order' | 'recommend_order' | 'chat' | 'confirm' | 'provide_info';
    confidence: number;
    extractedInfo: {
      type?: string;
      title?: string;
      description?: string;
      price?: number;
      pickupAddress?: string;
      deliveryAddress?: string;
    };
    response: string;
  }> {
    const contextStr = context.length > 0 
      ? `\n\n对话历史：\n${context.map(c => `${c.role === 'user' ? '用户' : '助手'}: ${c.content}`).join('\n')}`
      : '';

    const systemPrompt = `你是一个校园互助平台的智能助手。你需要理解用户的意图并给出合适的回复。

用户可能的意图：
1. publish_order - 用户想发布一个订单（如："我想发布订单"、"帮我找人拿快递"、"有人能帮我带份外卖吗"）
2. recommend_order - 用户想找订单接单（如："推荐订单"、"有什么单子"、"帮我找合适的订单"）
3. confirm - 用户确认信息（如："确认"、"好的"、"发布"、"是的"）
4. provide_info - 用户在补充订单信息（如提供地址、价格等）
5. chat - 普通对话或问候

请以 JSON 格式返回：
{
  "intent": "意图类型",
  "confidence": 0.95,
  "extractedInfo": {
    "type": "订单类型（delivery_pickup/delivery_food/errand/other）",
    "title": "订单标题",
    "description": "详细描述",
    "price": 价格数字,
    "pickupAddress": "取货地点",
    "deliveryAddress": "送达地点"
  },
  "response": "给用户的回复，要友好自然"
}

重要提示：
- 即使表达方式不同，也要正确识别意图。比如"有人能帮我拿快递吗"是发布订单意图
- 如果用户在描述订单需求，提取相关信息
- 回复要简洁友好，如果是发布订单意图且信息不完整，引导用户补充
- 如果是推荐订单意图，告诉用户正在为他推荐`;

    const userMessage = `用户消息：${message}${contextStr}

请分析用户意图并回复。`;

    try {
      const response = await this.llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.3,
      });

      const parsed = this.parseAIResponse(response.content);
      
      return {
        intent: parsed.intent || 'chat',
        confidence: parsed.confidence || 0.8,
        extractedInfo: parsed.extractedInfo || {},
        response: parsed.response || '抱歉，我没太理解您的意思，您可以说"帮我发布订单"或"推荐订单"。',
      };
    } catch (error) {
      console.error('AI 意图识别失败:', error);
      return {
        intent: 'chat',
        confidence: 0.5,
        extractedInfo: {},
        response: '抱歉，我遇到了一些问题，请稍后再试。',
      };
    }
  }

  private translateOrderType(type: string): string {
    const typeMap: Record<string, string> = {
      'delivery_pickup': '代拿快递',
      'delivery_food': '代取外卖',
      'errand': '跑腿代办',
      'other': '其他',
    };
    return typeMap[type] || type;
  }

  private parseAIResponse(content: string): any {
    try {
      // 尝试直接解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      console.error('解析 AI 响应失败:', error);
      return {};
    }
  }
}
