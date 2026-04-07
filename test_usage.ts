
import { callPublicDrugApi, extractItems } from "./src/lib/publicDrugApiClient";
async function doTest() {
    const payload = await callPublicDrugApi({
      baseUrl: "https://apis.data.go.kr/B551182/msupUserInfoService1.2", operation: "/getCmpnAreaList1.2", serviceName: "usage",
      query: { numOfRows: 5, pageNo: 1, mdcareYm: "202110", gnrlNm: "아세트아미노펜", GNRL_NM: "아세트아미노펜", mdcareYm: "202301" },
    });
    console.log(extractItems(payload));
}
doTest();

