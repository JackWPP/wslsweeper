# wslsweeper

WSL2 存储空间清理可视化工具，对标 SpaceSniffer。

## 特性

- 🌳 **TreeMap 可视化** - 矩形树图直观展示目录占用大小
- 🔍 **按需扫描** - 点击目录才加载子层，无需等待全盘扫描
- 🗑️ **安全删除** - 受保护路径（/usr、/etc 等）无法删除，两步确认防误删
- 🐳 **Docker 清理** - (后续迭代)
- 📦 **缓存清理** - (后续迭代)

## 安装

```bash
pip install wslsweeper
```

或从源码安装：

```bash
git clone https://github.com/JackWPP/wslsweeper.git
cd wslsweeper
pip install -e .
```

## 使用

```bash
wslsweeper
```

启动后自动打开浏览器访问 http://localhost:8765

## 开发

### 前端

```bash
cd frontend
npm install
npm run dev   # 开发模式，代理 API 到 localhost:8765
npm run build  # 构建并复制到 src/wslsweeper/static/
```

### 后端测试

```bash
pytest tests/
```

## 技术栈

- **后端**: FastAPI + uvicorn
- **前端**: React 18 + TypeScript + Vite + D3.js
- **扫描引擎**: os.scandir (异步)

## 截图

[待添加]

## License

MIT