
import { callPublicDrugApi, extractItems } from "./src/lib/publicDrugApiClient";
async function doTest() {
    try {
        const payload = await callPublicDrugApi({
          baseUrl: "https://apis.data.go.kr/B551182/dgamtrCtrInfoService1.2", operation: "/getDgamtList", serviceName: "price",
          query: { numOfRows: 5, pageNo: 1, mdcinCd: "672300240" },
        });
        const items = extractItems(payload);
        console.log("Price Items:", items);
    } catch(e) { console.error("Price API Error", e.message); }

    try {
        const payload = await callPublicDrugApi({
          baseUrl: "https://apis.data.go.kr/B551182/msupUserInfoService1.2", operation: "/getCmpnAreaList1.2", serviceName: "usage",
          query: { numOfRows: 5, pageNo: 1, mdcareYm: "202310", mdcinCmpnGnrlNm: "아세트아미노펜" },
        });
        const items = extractItems(payload);
        console.log("Usage Items:", items);
    } catch(e) { console.error("Usage API Error", e.message); }
}
doTest();

