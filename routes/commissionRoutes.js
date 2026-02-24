const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// Get DAILY plan commission summary for user (legacy path kept)
router.get('/plan-expire-summary/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        const planExpireCommissions = await Transaction.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(userId),
                    type: 'daily_plan_commission',
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
            commissions: planExpireCommissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;