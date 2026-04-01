"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.fetchDrugInfo = fetchDrugInfo;
const axios_1 = __importDefault(require("axios"));
const https = __importStar(require("https"));
function fetchDrugInfo(drugName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const agent = new https.Agent({ rejectUnauthorized: false });
            // 단순화된 검색어 추출
            const query = drugName.replace(/약가|가격|이미지|얼마야|알려줘|부작용|효과/gi, '').trim().split(' ')[0];
            const searchUrl = `https://nedrug.mfds.go.kr/searchDrug?searchYn=true&searchOption=ST1&itemName=${encodeURIComponent(query)}`;
            const res = yield axios_1.default.get(searchUrl, {
                httpsAgent: agent,
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
            });
            const parsedData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            const list = parsedData.list || [];
            if (list.length === 0)
                return null;
            const target = list.find((x) => x.ITEM_NAME.includes(query)) || list[0];
            let imageUrl = "https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/1OKRXo9l4D5"; // 타이레놀 기본 이미지 fallback
            if (target.BIG_ITEM_IMAGE_DOCID || target.SMALL_ITEM_IMAGE_DOCID) {
                const docId = target.BIG_ITEM_IMAGE_DOCID || target.SMALL_ITEM_IMAGE_DOCID;
                imageUrl = `https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/${docId}`;
            }
            else {
                // 이미지 docId가 없는 경우 타 약물 랜덤 매칭을 방지하기 위해 기본 placeholder 사용
                imageUrl = "https://via.placeholder.com/400x200.png?text=No+Image+Available";
            }
            const detailUrl = `https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=${target.ITEM_SEQ}`;
            const detailRes = yield axios_1.default.get(detailUrl, {
                httpsAgent: agent,
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            const item = ((_a = detailRes.data) === null || _a === void 0 ? void 0 : _a.item) || {};
            let priceInfo = "정보없음 (일반비급여)";
            if (item.maxAmt) {
                priceInfo = `${item.maxAmt}원/단위 (급여상한)`;
            }
            return {
                name: target.ITEM_NAME,
                imageUrl,
                priceInfo,
                mfdsData: `식약처 허가정보: [${target.ITEM_NAME}] ${target.ENTP_NAME}, ${target.ETC_OTC_CODE_NAME}, 주성분: ${target.MAIN_INGRS}`,
                hiraData: `심평원 고시 약가: ${priceInfo}`
            };
        }
        catch (error) {
            console.error("fetchDrugInfo Error:", error);
            return null;
        }
    });
}
