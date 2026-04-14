"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// /api/v1/drugs/search
router.post('/search', (req, res) => {
    res.json({
        success: true,
        data: {
            total: 2,
            items: [
                {
                    drug_id: "drug_1001",
                    product_name: "타이레놀정 500mg",
                    ingredient_name: "Acetaminophen",
                    manufacturer: "J&J",
                    insurance_price: 190,
                    reimbursement_status: "covered",
                    drug_type: "otc"
                },
                {
                    drug_id: "drug_1002",
                    product_name: "아세트아미노펜정",
                    ingredient_name: "Acetaminophen",
                    manufacturer: "OO제약",
                    insurance_price: 140,
                    reimbursement_status: "covered",
                    drug_type: "prescription"
                }
            ]
        }
    });
});
exports.default = router;
