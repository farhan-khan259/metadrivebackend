// routes/commission.js or in your existing plan routes
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Plan = require('../models/plain');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// Rebate commission rates
const REBATE_COMMISSION_RATES = {
    1: 0.04, // 4%
    2: 0.022, // 2.2%
    3: 0.015, // 1.5%
    4: 0.012, // 1.2%
    5: 0.01 // 1%
};

// Function to distribute rebate commissions
const distributeRebateCommission = async (planId) => {
    try {
        const plan = await Plan.findById(planId).populate('userId');
        if (!plan) throw new Error('Plan not found');

        const user = plan.userId;
        const returnProfitAmount = plan.returnProfit || plan.depositAmount; // Use return profit or deposit amount

        // Get upline chain (up to 5 levels)
        const uplineChain = await getUplineChain(user._id, 5);

        const commissionTransactions = [];

        // Distribute commissions to each level
        for (let level = 1; level <= 5; level++) {
            const upliner = uplineChain[level - 1];
            if (upliner) {
                const commissionRate = REBATE_COMMISSION_RATES[level];
                const commissionAmount = returnProfitAmount * commissionRate;

                if (commissionAmount > 0) {
                    // Add commission to upliner's wallet
                    upliner.wallet += commissionAmount;
                    await upliner.save();

                    // Create commission transaction
                    const commissionTransaction = new Transaction({
                        userId: upliner._id,
                        amount: commissionAmount,
                        type: 'rebate_commission',
                        description: `Level ${level} rebate commission from ${user.fullName}`,
                        status: 'completed',
                        metadata: {
                            fromUserId: user._id,
                            fromUserName: user.fullName,
                            level: level,
                            planId: plan._id,
                            returnProfitAmount: returnProfitAmount,
                            commissionRate: commissionRate
                        }
                    });

                    await commissionTransaction.save();
                    commissionTransactions.push(commissionTransaction);
                }
            }
        }

        return commissionTransactions;
    } catch (error) {
        console.error('Error distributing rebate commission:', error);
        throw error;
    }
};

// Function to get upline chain
const getUplineChain = async (userId, maxLevels = 3) => {
    const uplineChain = [];
    let currentUserId = userId;

    for (let level = 1; level <= maxLevels; level++) {
        const currentUser = await User.findById(currentUserId);
        if (!currentUser || !currentUser.referredBy) break;

        const upliner = await User.findById(currentUser.referredBy);
        if (upliner) {
            uplineChain.push(upliner);
            currentUserId = upliner._id;
        } else {
            break;
        }
    }

    return uplineChain;
};

// API endpoint to trigger plan expiration (call this when plan expires)
router.post('/rebate/:planId', async (req, res) => {
    try {
        const { planId } = req.params;

        const commissions = await distributeRebateCommission(planId);

        res.json({
            success: true,
            message: 'Rebate commissions distributed successfully',
            commissions: commissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get rebate commission summary for user
const getRebateSummary = async (req, res) => {
    try {
        const { userId } = req.params;

        const rebateCommissions = await Transaction.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(userId),
                    type: { $in: ['rebate_commission', 'daily_plan_commission', 'plan_expire_commission'] },
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

router.post('/plan-expire/:planId', async (req, res) => {
    try {
        const { planId } = req.params;

        const commissions = await distributeRebateCommission(planId);

        res.json({
            success: true,
            message: 'Rebate commissions distributed successfully',
            commissions: commissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/rebate-summary/:userId', getRebateSummary);
router.get('/plan-expire-summary/:userId', getRebateSummary);

module.exports = router;