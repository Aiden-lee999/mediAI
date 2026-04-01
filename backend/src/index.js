"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// 용량 큰 X-Ray 이미지를 Base64 스트링으로 넘기므로 limit를 늘려줍니다
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// 프론트엔드가 /api/ask 로 요청하므로 /api 에 chatRoutes를 마운트
app.use('/api', chatRoutes_1.default);
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', info: 'MediAI Backend API is running' });
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
