import { Router } from 'express';

const router = Router();

router.post('/login', (req, res) => {
  res.json({ success: true, data: { access_token: "mock-jwt-token", user: { id: "usr_01", name: "홍길동", role: "doctor", verification_status: "verified" } } });
});

export default router;
