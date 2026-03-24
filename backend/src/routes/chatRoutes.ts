import { Router } from 'express';

const router = Router();

router.post('/sessions', (req, res) => {
  res.json({ success: true, data: { session_id: "sess_" + Date.now(), title: req.body.title || "새 대화", session_type: "mixed" } });
});

router.post('/messages', (req, res) => {
  res.json({ success: true, data: { message_id: "msg_" + Date.now(), session_id: req.body.session_id, role: "user", created_at: new Date().toISOString() } });
});

export default router;
