"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../prisma"));
const router = express_1.default.Router();
const JWT_SECRET = 'supersecret_medassist_2026';
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { license, password, name, specialty } = req.body;
    try {
        let user = yield prisma_1.default.user.findUnique({ where: { license } });
        if (!user) {
            // Auto register for demo
            const hashed = yield bcryptjs_1.default.hash(password || '1234', 10);
            user = yield prisma_1.default.user.create({
                data: {
                    license,
                    password: hashed,
                    name: name || '김의사',
                    specialty: specialty || '내과'
                }
            });
        }
        else {
            const valid = yield bcryptjs_1.default.compare(password, user.password);
            if (!valid) {
                res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
                return;
            }
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: {
                id: user.id,
                name: user.name,
                specialty: user.specialty,
                license: user.license
            } });
    }
    catch (error) {
        res.status(500).json({ error: '서버 오류입니다.' });
    }
}));
exports.default = router;
