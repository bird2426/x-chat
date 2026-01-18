# TypeScript 代码详解 - 给 Python 开发者

本文档帮助熟悉 Python 的开发者快速理解项目中的 TypeScript 代码。

## 基础语法对比

### 1. 变量声明

```typescript
// TypeScript
const name: string = "Alice";    // 不可变常量 (类似 Python 的常量)
let age: number = 25;             // 可变变量
var old = true;                   // 旧式变量（不推荐）

// Python 对比
name: str = "Alice"
age: int = 25
```

### 2. 类型注解

```typescript
// TypeScript - 类型在变量名后面，用冒号分隔
function greet(name: string): string {
  return `Hello, ${name}`;
}

// Python - 类型在变量名后面，也用冒号
def greet(name: str) -> str:
    return f"Hello, {name}"
```

### 3. 接口 (Interface)

```typescript
// TypeScript - interface 定义数据结构
interface User {
  name: string;        // 必填字段
  age: number;         // 必填字段
  email?: string;      // 可选字段 (? 表示可选)
}

// 使用接口
const user: User = {
  name: "Alice",
  age: 25,
  // email 可以省略
};

// Python 对比 - 使用 TypedDict 或 dataclass
from typing import TypedDict, Optional

class User(TypedDict):
    name: str
    age: int
    email: Optional[str]  # 可选字段
```

### 4. 数组和泛型

```typescript
// TypeScript
const numbers: number[] = [1, 2, 3];         // 数字数组
const names: Array<string> = ["a", "b"];     // 字符串数组（泛型写法）
const mixed: (string | number)[] = [1, "a"]; // 混合类型数组

// Python
numbers: list[int] = [1, 2, 3]
names: list[str] = ["a", "b"]
from typing import Union
mixed: list[Union[str, int]] = [1, "a"]
```

### 5. 对象解构

```typescript
// TypeScript - 从对象中提取字段
const user = { name: "Alice", age: 25 };
const { name, age } = user;  // 提取 name 和 age
console.log(name);  // "Alice"

// Python 对比 - 没有直接的解构，需要手动访问
user = {"name": "Alice", "age": 25}
name = user["name"]
age = user["age"]
```

## React Hooks 核心概念

### 1. useState - 状态管理

```typescript
// TypeScript + React
const [count, setCount] = useState<number>(0);
//     ^状态值  ^更新函数              ^初始值

// 等价于 Python 伪代码:
class Component:
    def __init__(self):
        self._count = 0
    
    @property
    def count(self):
        return self._count
    
    def set_count(self, new_value):
        self._count = new_value
        # 触发界面重新渲染
```

**使用示例**：
```typescript
// 读取状态
console.log(count);  // 0

// 更新状态
setCount(5);         // count 变成 5
setCount(count + 1); // count 变成 6
```

### 2. useEffect - 副作用处理

```typescript
// 类似 Python 的 __init__ 或生命周期方法
useEffect(() => {
  // 组件加载时执行（只执行一次）
  console.log("组件已加载");
  
  // 返回清理函数（组件卸载时执行）
  return () => {
    console.log("组件即将卸载");
  };
}, []);  // 空数组 = 只在加载时执行一次

// 监听特定变量变化
useEffect(() => {
  console.log(`count 变成了 ${count}`);
}, [count]);  // count 变化时执行
```

### 3. useRef - 引用对象

```typescript
// 获取 DOM 元素的引用
const inputRef = useRef<HTMLInputElement>(null);

// 使用
<input ref={inputRef} />
inputRef.current?.focus();  // 让输入框获得焦点
```

## 项目核心代码详解

### 1. Message 接口定义 (app/page.tsx)

```typescript
// 定义消息的数据结构
interface Message {
  role: 'user' | 'bot';        // 角色：只能是 'user' 或 'bot'
  content: string;             // 消息内容
  media?: {                    // 媒体文件（可选）
    data: string;              // base64 编码
    mimeType: string;          // 文件类型
    preview: string;           // 预览 URL
    type: 'image' | 'video';   // 媒体类型
  };
  toolCalls?: ToolCall[];      // 工具调用记录（可选）
}
```

**Python 等价代码**：
```python
from typing import Literal, Optional
from dataclasses import dataclass

@dataclass
class Media:
    data: str
    mime_type: str
    preview: str
    type: Literal['image', 'video']

@dataclass
class Message:
    role: Literal['user', 'bot']
    content: str
    media: Optional[Media] = None
    tool_calls: Optional[list[ToolCall]] = None
```

### 2. handleSubmit 函数 (发送消息)

```typescript
const handleSubmit = async (e?: React.FormEvent) => {
  e?.preventDefault();  // 阻止表单默认提交行为
  
  if ((!input.trim() && !media) || isLoading) return;  // 验证输入
  
  const userMessage = input.trim();  // 获取用户输入
  
  // ... 验证媒体支持 ...
  
  // 发送 HTTP 请求到后端
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({  // 将对象转为 JSON
      message: userMessage,
      provider: selectedProvider,
      model: selectedModel,
      enableTools,  // 是否启用工具
    }),
  });
  
  const data = await res.json();  // 解析响应
  
  // 更新消息列表
  setMessages(prev => [...prev, { 
    role: 'bot', 
    content: data.text,
    toolCalls: data.toolCalls 
  }]);
};
```

**Python 等价代码 (FastAPI)**：
```python
import requests

async def handle_submit(user_message: str, enable_tools: bool):
    # 发送请求
    response = requests.post('/api/chat', json={
        'message': user_message,
        'provider': selected_provider,
        'model': selected_model,
        'enableTools': enable_tools,
    })
    
    data = response.json()
    
    # 更新消息列表
    messages.append({
        'role': 'bot',
        'content': data['text'],
        'tool_calls': data.get('toolCalls')
    })
```

### 3. 工具执行器 (lib/tool-executor.ts)

```typescript
export class ToolExecutor {
  private tools: Record<string, (args: Record<string, any>) => Promise<string>>;
  
  constructor() {
    this.tools = {
      get_weather: this.getWeather.bind(this),  // .bind(this) 绑定上下文
      calculate: this.calculate.bind(this),
    };
  }
  
  async execute(toolName: string, args: Record<string, any>): Promise<string> {
    if (!(toolName in this.tools)) {
      return `错误: 未知工具 '${toolName}'`;
    }
    
    try {
      return await this.tools[toolName](args);
    } catch (error) {
      return `工具执行错误: ${error.message}`;
    }
  }
  
  private async getWeather(args: Record<string, any>): Promise<string> {
    const city = args.city || "";
    // 模拟天气查询
    return `${city}当前天气：晴，温度15°C`;
  }
}
```

**Python 等价代码**：
```python
class ToolExecutor:
    def __init__(self):
        self.tools = {
            'get_weather': self.get_weather,
            'calculate': self.calculate,
        }
    
    async def execute(self, tool_name: str, args: dict) -> str:
        if tool_name not in self.tools:
            return f"错误: 未知工具 '{tool_name}'"
        
        try:
            return await self.tools[tool_name](args)
        except Exception as e:
            return f"工具执行错误: {str(e)}"
    
    async def get_weather(self, args: dict) -> str:
        city = args.get('city', '')
        return f"{city}当前天气：晴，温度15°C"
```

## 常用语法速查

| TypeScript | Python | 说明 |
|-----------|--------|------|
| `const x = 1` | `x = 1` | 常量 |
| `let x = 1` | `x = 1` | 变量 |
| `x: string` | `x: str` | 类型注解 |
| `x?: number` | `x: Optional[int]` | 可选参数 |
| `x => x + 1` | `lambda x: x + 1` | 匿名函数 |
| `[1, 2, 3].map(x => x * 2)` | `[x * 2 for x in [1,2,3]]` | 数组映射 |
| `{ name: "a" }` | `{"name": "a"}` | 对象/字典 |
| `obj?.field` | `getattr(obj, 'field', None)` | 安全访问 |
| `a ?? b` | `a if a is not None else b` | 空值合并 |

## 调试技巧

1. **查看变量值**：
```typescript
console.log(变量名);       // 打印到浏览器控制台
console.log({变量1, 变量2}); // 打印多个变量
```

2. **类型错误**：
- 看红色波浪线
- 鼠标悬停查看错误信息
- IDE 会告诉你期望什么类型

3. **运行时错误**：
- 打开浏览器开发者工具 (F12)
- 查看 Console 标签页
- 错误会显示文件名和行号

## 下一步学习

1. **TypeScript 官方文档**: https://www.typescriptlang.org/docs/
2. **React 官方教程**: https://react.dev/learn
3. **实践建议**: 先运行项目，修改代码看效果，遇到不懂的查文档

记住：TypeScript 和 Python 很相似，主要区别在于：
- TypeScript 用 `{}` 和 `;`，Python 用缩进
- TypeScript 的类型在后面，Python 的类型也在后面
- 两者都支持类型注解，都是为了代码更安全

祝学习愉快！🎉
