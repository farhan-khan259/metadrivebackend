

const express = require("express");
const {
	createPlan,
	getPlans,
	getPlanById,
	updatePlan,
	deletePlan,
	claimPlan,
} = require("../controllers/planController");
const Plan = require("../models/plain");
const User = require("../models/User");

const router = express.Router();

// ✅ Create a new plan
router.post("/", createPlan);

// ✅ Get all plans
router.get("/", getPlans);

// ✅ Count subscribers for each plan
router.get("/countSubscribePlanName", async (req, res) => {
	console.log("📊 Counting subscribers...");
	try {
		const planNames = await Plan.distinct("PlanName");
		const results = await Promise.all(
			planNames.map(async (name) => {
				const count = await Plan.countDocuments({ PlanName: name });
				return { planName: name, subscribers: count };
			})
		);
		res.json({ success: true, plans: results });
	} catch (err) {
		console.error("❌ Error counting subscribers:", err);
		res.status(500).json({ success: false, message: "Server error" });
	}
});

// ✅ Claim plan endpoint
router.post('/claim', claimPlan);

// ✅ Get active plans for a user
router.get("/user/active/:user_id", async (req, res) => {
	try {
		const { user_id } = req.params;
		const activePlans = await Plan.find({
			user_id: user_id,
			status: 'running'
		}).sort({ createdAt: -1 });
		res.json({ success: true, plans: activePlans });
	} catch (error) {
		console.error('❌ Error fetching active plans:', error);
		res.status(500).json({ success: false, message: 'Server error while fetching active plans' });
	}
});

// ✅ Get in-progress plans (running + completed but not claimed)
router.get("/user/inprogress/:user_id", async (req, res) => {
	try {
		const { user_id } = req.params;
		const inProgressPlans = await Plan.find({
			user_id: user_id,
			status: { $in: ['running', 'completed'] } // Running and completed but not claimed
		}).sort({ createdAt: -1 });
		res.json({ success: true, plans: inProgressPlans });
	} catch (error) {
		console.error('❌ Error fetching in-progress plans:', error);
		res.status(500).json({ success: false, message: 'Server error while fetching plans' });
	}
});

// ✅ Get daily earning history for a user
router.get("/user/daily-earning-history/:user_id", async (req, res) => {
	try {
		const { user_id } = req.params;
		const plans = await Plan.find({ user_id: user_id }).sort({ createdAt: -1 });

		const history = plans.flatMap((plan) =>
			(plan.dailyEarningHistory || []).map((entry) => ({
				planId: plan._id,
				planName: plan.PlanName,
				amount: entry.amount,
				dayNumber: entry.dayNumber,
				date: entry.creditedAt,
			}))
		);

		history.sort((a, b) => new Date(b.date) - new Date(a.date));

		res.json({ success: true, history });
	} catch (error) {
		console.error('❌ Error fetching daily earning history:', error);
		res.status(500).json({ success: false, message: 'Server error while fetching daily earning history' });
	}
});

// ✅ Get claimed plans for a user
router.get("/user/claimed/:user_id", async (req, res) => {
	try {
		const { user_id } = req.params;
		const claimedPlans = await Plan.find({
			user_id: user_id,
			status: 'claimed'
		}).sort({ claimedAt: -1 });
		res.json({ success: true, plans: claimedPlans });
	} catch (error) {
		console.error('❌ Error fetching claimed plans:', error);
		res.status(500).json({ success: false, message: 'Server error while fetching claimed plans' });
	}
});

// ✅ Get a single plan by ID
router.get("/:id", getPlanById);

// ✅ Update a plan
router.put("/:id", updatePlan);

// ✅ Delete a plan
router.delete("/:id", deletePlan);

module.exports = router;