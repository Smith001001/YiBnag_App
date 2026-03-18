import { Injectable } from '@nestjs/common';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface OrderRecommendation {
  orderId: string;
  title: string;
  type: string;
  price: number;
  pickupAddress: string;
  deliveryAddress: string;
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

    // 构建订单列表文本 - 只包含真实存在的订单
    const ordersText = orders.map((order, index) => {
      return `${index + 1}. 订单ID: ${order.id}
         类型: ${this.translateOrderType(order.type)}
         标题: ${order.title}
         描述: ${order.description}
         取货地点: ${order.pickup_location?.address || '未指定'}
         送达地点: ${order.delivery_location?.address || '未指定'}
         价格: ¥${order.price}
         截止时间: ${order.deadline || '无'}`;
    }).join('\n\n');

    // 可用的订单ID列表，用于验证AI返回的结果
    const validOrderIds = orders.map(o => o.id);

    // 构建系统提示词
    const systemPrompt = `你是一个校园互助平台的智能推荐助手。根据用户的需求描述，从给定的订单列表中推荐最合适的订单。

【极其重要的规则 - 必须严格遵守】：

1. **只能从给定的订单列表中选择**：
   - 你只能推荐列表中存在的订单
   - 绝对禁止编造、猜测或创建任何不存在的订单ID
   - 如果列表中没有合适的订单，返回空数组

2. **订单ID必须精确匹配**：
   - 订单ID必须从给定的列表中精确复制，不能修改任何字符
   - 不要创建新的订单ID格式

3. **推荐理由必须基于真实信息**：
   - 推荐理由只能基于订单列表中显示的真实信息
   - 不要编造订单的任何属性（如价格、地点等）

推荐标准：
1. 匹配用户的需求类型（代拿快递、代取外卖、跑腿等）
2. 考虑地理位置便利性
3. 考虑价格合理性

订单类型翻译：
- delivery_pickup: 代拿快递
- delivery_food: 代取外卖
- errand: 跑腿代办
- other: 其他

请以 JSON 格式返回推荐结果：
{
  "orderIds": ["从列表中精确复制的订单ID"],
  "reasons": ["基于真实订单信息的推荐理由"],
  "scores": [匹配分数0-100]
}

如果找不到合适的订单，返回：
{
  "orderIds": [],
  "reasons": [],
  "scores": []
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
        temperature: 0.3, // 降低温度以获得更确定的输出
      });

      // 解析 LLM 返回的 JSON
      const result = this.parseAIResponse(response.content);

      // 构建推荐结果 - 验证订单ID是否真实存在
      const recommendations: OrderRecommendation[] = [];
      
      // 创建订单ID到订单信息的映射
      const orderMap = new Map(orders.map(o => [o.id, o]));
      
      if (result.orderIds && Array.isArray(result.orderIds)) {
        for (let i = 0; i < result.orderIds.length; i++) {
          const orderId = result.orderIds[i];
          
          // 验证订单ID是否真实存在
          if (validOrderIds.includes(orderId)) {
            const order = orderMap.get(orderId);
            if (order) {
              recommendations.push({
                orderId: orderId,
                title: order.title,
                type: this.translateOrderType(order.type),
                price: order.price,
                pickupAddress: order.pickup_location?.address || '未指定',
                deliveryAddress: order.delivery_location?.address || '未指定',
                matchReason: result.reasons?.[i] || `${order.title}，报酬¥${order.price}`,
                matchScore: Math.min(100, Math.max(0, result.scores?.[i] || 70)),
              });
            }
          } else {
            console.warn(`AI返回了无效的订单ID: ${orderId}，已忽略`);
          }
        }
      }

      return recommendations;
    } catch (error) {
      console.error('AI 推荐失败:', error);
      // 如果 AI 失败，返回前3个订单作为默认推荐
      return orders.slice(0, 3).map(order => ({
        orderId: order.id,
        title: order.title,
        type: this.translateOrderType(order.type),
        price: order.price,
        pickupAddress: order.pickup_location?.address || '未指定',
        deliveryAddress: order.delivery_location?.address || '未指定',
        matchReason: `${order.title}，${order.pickup_location?.address || '待定'} → ${order.delivery_location?.address || '待定'}，报酬¥${order.price}`,
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
    intent: 'publish_order' | 'recommend_order' | 'chat' | 'confirm' | 'provide_info' | 'cancel' | 'modify' | 'accept_order';
    confidence: number;
    extractedInfo: {
      type?: string;
      title?: string;
      description?: string;
      price?: number;
      pickupAddress?: string;
      deliveryAddress?: string;
      orderIndex?: number;
    };
    response: string;
  }> {
    const contextStr = context.length > 0 
      ? `\n\n对话历史：\n${context.map(c => `${c.role === 'user' ? '用户' : '助手'}: ${c.content}`).join('\n')}`
      : '';

    const systemPrompt = `你是一个校园互助平台的智能助手。你需要理解用户的意图并给出合适的回复。

用户可能的意图：
1. publish_order - 用户想发布一个订单（如："我想发布订单"、"帮我找人拿快递"、"有人能帮我带份外卖吗"、"帮我拿个快递"）
2. recommend_order - 用户想找订单接单（如："推荐订单"、"有什么单子"、"帮我找合适的订单"、"给我推荐订单"）
3. accept_order - 用户想接单（如："接第1单"、"我要接第2个订单"、"我想接第三个"、"接单"）
4. confirm - 用户确认操作（如："确认"、"好的"、"发布"、"是的"、"确认发布"、"确认接单"）
5. cancel - 用户取消操作（如："取消"、"不要了"）
6. modify - 用户想修改信息（如："修改"、"改一下"）
7. provide_info - 用户在补充订单信息（如提供地址、价格等）
8. chat - 普通对话或问候

请以 JSON 格式返回：
{
  "intent": "意图类型",
  "confidence": 0.95,
  "extractedInfo": {
    "type": "订单类型（delivery_pickup/delivery_food/errand/other，如果用户提到快递则为delivery_pickup，提到外卖则为delivery_food）",
    "title": "订单标题（用户提到的简短描述）",
    "description": "详细描述（提炼用户的核心需求）",
    "price": 价格数字（必须是用户明确提到的数字，如果用户没说价格则不要填写！）,
    "pickupAddress": "取货地点（只提取用户明确提到的地点名称）",
    "deliveryAddress": "送达地点（只提取用户明确提到的地点名称）",
    "orderIndex": 订单序号（用户说"接第X单"时提取数字，如"接第1单"则orderIndex为1）
  },
  "response": "给用户的回复"
}

【极其重要的规则 - 必须严格遵守】：

1. **严禁捏造任何信息**：
   - 只提取用户消息中明确提到的信息
   - 如果用户没说价格，price 必须为 null，不能自己填写任何数字
   - 如果用户没说取货地点，pickupAddress 必须为 null
   - 如果用户没说送达地点，deliveryAddress 必须为 null
   - 绝对禁止自己编造、猜测或默认任何用户未提及的信息！
   
2. **接单意图识别**：
   - "接第1单"、"接第2个"、"我要接第三个" → intent: "accept_order", orderIndex: 对应数字
   - "接单"、"我要接单" → intent: "accept_order", orderIndex: null（需要用户指定）
   
3. **地点提取规则**：

3. **地点提取规则**：
   - "在图书馆取货，送到A教" → pickupAddress: "图书馆", deliveryAddress: "A教"
   - "帮我去食堂拿外卖送到宿舍" → pickupAddress: "食堂", deliveryAddress: "宿舍"
   - 如果只说"帮我拿快递"而没有提地点 → pickupAddress: null, deliveryAddress: null

4. **价格提取规则**：
   - "11块钱"、"5元"、"报酬10块" → price: 数字
   - 用户没提到价格 → price: null（不要填写默认值！）

5. **意图识别规则**：
   - "确认"/"发布"/"是的"/"确认接单" → intent: "confirm"
   - "取消" → intent: "cancel"
   - "修改" → intent: "modify"
   - "接第1单"/"接第2个"/"我要接第三个" → intent: "accept_order", orderIndex: 对应数字

6. **回复风格**：简洁友好，当信息不完整时引导用户补充`;

    const userMessage = `用户消息：${message}${contextStr}

请严格按规则分析用户意图，只提取用户明确提到的信息，返回JSON格式结果。`;

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
