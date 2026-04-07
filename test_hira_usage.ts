
import { callPublicDrugApi, extractItems } from "./src/lib/publicDrugApiClient";
async function doTest() {
    // API 1: Pricing
    const p1 = await callPublicDrugApi({
        baseUrl: "https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2", operation: "/getDgamtList", serviceName: "price",
        query: { numOfRows: 5, pageNo: 1, mdcinCd: "672300240" },
    });
    console.log("Price 672300240:", extractItems(p1));
    const p2 = await callPublicDrugApi({
        baseUrl: "https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2", operation: "/getDgamtList", serviceName: "price",
        query: { numOfRows: 5, pageNo: 1, mdcinCd: "8806469005509" },
    });
    console.log("Price 8806469005509:", extractItems(p2));

    // API 2: Usage
    const u1 = await callPublicDrugApi({
        baseUrl: "https://apis.data.go.kr/B551182/msupUserInfoService1.2", operation: "/getAtcStp4AreaList1.2", serviceName: "usage",
        query: { numOfRows: 5, pageNo: 1, mdcareYm: "202301" },
    });
    console.log("Usage getAtcStp4AreaList1.2:", extractItems(u1)[0]);
}
doTest();

