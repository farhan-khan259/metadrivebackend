const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// Get REAL plan expire commission summary for user
router.get('/plan-expire-summary/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('🔍 Fetching REAL plan expire commissions for user:', userId);

        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Get REAL plan expire commissions for the user
        const transactions = await Transaction.find({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'plan_expire_commission',
            status: 'completed'
        }).sort({ createdAt: -1 });

        console.log(`📊 Found ${transactions.length} REAL plan expire commissions`);

        // Calculate level-wise totals
        const levelTotals = {
            level1: 0,
            level2: 0,
            level3: 0,
            level4: 0,
            level5: 0,
        };

        // Process real transactions
        const enhancedTransactions = transactions.map(transaction => ({
            _id: transaction._id,
            amount: transaction.amount,
            type: transaction.type,
            description: transaction.description,
            status: transaction.status,
            createdAt: transaction.createdAt,
            metadata: transaction.metadata || {
                level: 1,
                fromUserName: 'Team Member',
                planName: 'Investment Plan',
                investment: 0,
                returnProfit: 0,
                commissionRate: 0.04
            }
        }));

        // Calculate level totals from real data
        enhancedTransactions.forEach(transaction => {
            const level = transaction.metadata?.level;
            if (level === 1) levelTotals.level1 += transaction.amount;
            else if (level === 2) levelTotals.level2 += transaction.amount;
            else if (level === 3) levelTotals.level3 += transaction.amount;
            else if (level === 4) levelTotals.level4 += transaction.amount;
            else if (level === 5) levelTotals.level5 += transaction.amount;
        });

        // If no transactions found, return empty but successful response
        if (transactions.length === 0) {
            return res.json({
                success: true,
                message: 'No plan expire commissions found',
                data: {
                    summary: {
                        totalCommission: 0,
                        levelTotals: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 },
                        totalTransactions: 0
                    },
                    transactions: []
                }
            });
        }

        res.json({
            success: true,
            message: 'Plan expire commission data retrieved successfully',
            data: {
                summary: {
                    totalCommission: transactions.reduce((sum, t) => sum + t.amount, 0),
                    levelTotals,
                    totalTransactions: transactions.length
                },
                transactions: enhancedTransactions
            }
        });

    } catch (error) {
        console.error('❌ Error fetching plan expire commission summary:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;