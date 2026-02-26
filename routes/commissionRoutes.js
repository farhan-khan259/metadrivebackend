const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

const REBATE_TYPES = ['rebate_commission', 'daily_plan_commission', 'plan_expire_commission'];

const getRebateSummary = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        const rebateCommissions = await Transaction.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(userId),
                    type: { $in: REBATE_TYPES },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: '$metadata.level',
                    totalCommission: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            commissions: rebateCommissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

router.get('/rebate-summary/:userId', getRebateSummary);
router.get('/plan-expire-summary/:userId', getRebateSummary);

module.exports = router;