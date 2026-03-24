import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chatRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 용량 큰 X-Ray 이미지를 Base64 스트링으로 넘기므로 limit를 늘려줍니다
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 프론트엔드가 /api/ask 로 요청하므로 /api 에 chatRoutes를 마운트
app.use('/api', chatRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', info: 'MediAI Backend API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});