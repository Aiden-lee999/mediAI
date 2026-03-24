"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.post('/login', (req, res) => {
    res.json({ success: true, data: { access_token: "mock-jwt-token", user: { id: "usr_01", name: "홍길동", role: "doctor", verification_status: "verified" } } });
});
exports.default = router;
