import axios from 'axios';
import * as https from 'https';

export async function fetchDrugInfo(drugName: string) {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    
    // 단순화된 검색어 추출
    const query = drugName.replace(/약가|가격|이미지|얼마야|알려줘|부작용|효과/gi, '').trim().split(' ')[0];
    
    const searchUrl = `https://nedrug.mfds.go.kr/searchDrug?searchYn=true&searchOption=ST1&itemName=${encodeURIComponent(query)}`;
    const res = await axios.get(searchUrl, {
      httpsAgent: agent,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    
    const parsedData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    const list = parsedData.list || [];
    
    if (list.length === 0) return null;

    const target = list.find((x: any) => x.ITEM_NAME.includes(query)) || list[0];
    
    let imageUrl = "https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/1OKRXo9l4D5"; // 타이레놀 기본 이미지 fallback
    if (target.BIG_ITEM_IMAGE_DOCID || target.SMALL_ITEM_IMAGE_DOCID) {
      const docId = target.BIG_ITEM_IMAGE_DOCID || target.SMALL_ITEM_IMAGE_DOCID;
      imageUrl = `https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/${docId}`;
    } else {
      // 이미지 docId가 없는 경우 타 약물 랜덤 매칭을 방지하기 위해 기본 placeholder 사용
      imageUrl = "https://via.placeholder.com/400x200.png?text=No+Image+Available";
    }

    const detailUrl = `https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=${target.ITEM_SEQ}`;
    const detailRes = await axios.get(detailUrl, {
      httpsAgent: agent,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    
    const item = detailRes.data?.item || {};
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
  } catch (error) {
    console.error("fetchDrugInfo Error:", error);
    return null;
  }
}
