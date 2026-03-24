import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const router = express.Router();
const JWT_SECRET = 'supersecret_medassist_2026';

router.post('/login', async (req, res) => {
  const { license, password, name, specialty } = req.body;
  try {
    let user = await prisma.user.findUnique({ where: { license } });
    if (!user) {
      // Auto register for demo
      const hashed = await bcrypt.hash(password || '1234', 10);
      user = await prisma.user.create({
        data: {
          license,
          password: hashed,
          name: name || '김의사',
          specialty: specialty || '내과'
        }
      });
    } else {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
        return;
      }
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: {
      id: user.id,
      name: user.name,
      specialty: user.specialty,
      license: user.license
    } });
  } catch (error) {
    res.status(500).json({ error: '서버 오류입니다.' });
  }
});

export default router;
