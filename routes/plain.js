// // const express = require("express");
// // const {
// // 	createPlan,
// // 	getPlans,
// // 	getPlanById,
// // 	updatePlan,
// // 	deletePlan,
// // } = require("../controllers/planController");
// // const Plan = require("../models/plain");

// // const router = express.Router();

// // /* ----------------------------
// //    ORDER MATTERS! Always put
// //    static routes BEFORE dynamic
// // -----------------------------*/

// // // ✅ Create a new plan
// // router.post("/", createPlan);

// // // ✅ Get all plans
// // router.get("/", getPlans);

// // // ✅ Count subscribers for each plan
// // router.get("/countSubscribePlanName", async (req, res) => {
// // 	console.log("📊 Counting subscribers...");
// // 	try {
// // 		// Step 1: Get all unique plan names
// // 		const planNames = await Plan.distinct("PlanName");

// // 		// Step 2: Count subscribers for each plan
// // 		const results = await Promise.all(
// // 			planNames.map(async (name) => {
// // 				const count = await Plan.countDocuments({ PlanName: name });
// // 				return { planName: name, subscribers: count };
// // 			})
// // 		);

// // 		res.json({ success: true, plans: results });
// // 	} catch (err) {
// // 		console.error("❌ Error counting subscribers:", err);
// // 		res.status(500).json({ success: false, message: "Server error" });
// // 	}
// // });


// // // In your backend routes
// // app.post('/api/plans/claim', async (req, res) => {
// // 	try {
// // 		const { planId, userId } = req.body;

// // 		// Find the plan
// // 		const plan = await Plan.findById(planId);
// // 		if (!plan) {
// // 			return res.status(404).json({ success: false, message: 'Plan not found' });
// // 		}

// // 		// Calculate total amount to add to balance
// // 		const totalAmount = plan.Investment + (plan.returnProfit || plan.dailyEarning * 3);

// // 		// Update user balance
// // 		await User.findByIdAndUpdate(userId, {
// // 			$inc: { balance: totalAmount }
// // 		});

// // 		// Update plan status
// // 		plan.status = 'claimed';
// // 		await plan.save();

// // 		res.json({ success: true, message: 'Plan claimed successfully', amount: totalAmount });
// // 	} catch (error) {
// // 		console.error('Error claiming plan:', error);
// // 		res.status(500).json({ success: false, message: 'Server error' });
// // 	}
// // });

// // // ✅ Get a single plan by ID (MUST come after static routes)
// // router.get("/:id", getPlanById);

// // // ✅ Update a plan
// // router.put("/:id", updatePlan);

// // // ✅ Delete a plan
// // router.delete("/:id", deletePlan);

// // module.exports = router;


// // // UPDATED
// // const express = require("express");
// // const {
// // 	createPlan,
// // 	getPlans,
// // 	getPlanById,
// // 	updatePlan,
// // 	deletePlan,
// // } = require("../controllers/planController");
// // const Plan = require("../models/plain");
// // const User = require("../models/User");

// // const router = express.Router();

// // // ✅ Create a new plan
// // router.post("/", createPlan);

// // // ✅ Get all plans
// // router.get("/", getPlans);

// // // ✅ Count subscribers for each plan
// // router.get("/countSubscribePlanName", async (req, res) => {
// // 	console.log("📊 Counting subscribers...");
// // 	try {
// // 		const planNames = await Plan.distinct("PlanName");
// // 		const results = await Promise.all(
// // 			planNames.map(async (name) => {
// // 				const count = await Plan.countDocuments({ PlanName: name });
// // 				return { planName: name, subscribers: count };
// // 			})
// // 		);
// // 		res.json({ success: true, plans: results });
// // 	} catch (err) {
// // 		console.error("❌ Error counting subscribers:", err);
// // 		res.status(500).json({ success: false, message: "Server error" });
// // 	}
// // });

// // // ✅ Claim plan endpoint - FIXED
// // router.post('/claim', async (req, res) => {
// // 	console.log("🪙 Claiming plan...");
// // 	try {
// // 		const { planId, user_id } = req.body;

// // 		// ✅ ADDED: Validation and plan fetch
// // 		if (!planId || !user_id) {
// // 			return res.status(400).json({
// // 				success: false,
// // 				message: 'Plan ID and User ID are required'
// // 			});
// // 		}

// // 		const plan = await Plan.findById(planId);
// // 		if (!plan) {
// // 			return res.status(404).json({
// // 				success: false,
// // 				message: 'Plan not found'
// // 			});
// // 		}

// // 		if (plan.status === 'claimed') {
// // 			return res.status(400).json({
// // 				success: false,
// // 				message: 'Plan already claimed'
// // 			});
// // 		}

// // 		const endDate = new Date(plan.endingDate);
// // 		const today = new Date();
// // 		if (today < endDate) {
// // 			return res.status(400).json({
// // 				success: false,
// // 				message: 'Plan is not yet completed'
// // 			});
// // 		}

// // 		// ✅ Use actual plan days instead of hardcoded 3
// // 		const returnProfit = plan.returnProfit || (plan.dailyEarning * plan.days);
// // 		const totalAmount = plan.Investment + returnProfit;

// // 		// Update user balance
// // 		await User.findByIdAndUpdate(user_id, {
// // 			$inc: { userbalance: totalAmount }
// // 		});

// // 		// Update plan status
// // 		plan.status = 'claimed';
// // 		plan.claimedAt = new Date();
// // 		await plan.save();

// // 		console.log(`✅ Plan claimed successfully. Amount: ${totalAmount} PKR`);

// // 		res.json({
// // 			success: true,
// // 			message: 'Plan claimed successfully',
// // 			amount: totalAmount,
// // 			plan: {
// // 				investment: plan.Investment,
// // 				profit: returnProfit,
// // 				total: totalAmount
// // 			}
// // 		});
// // 	} catch (error) {
// // 		console.error('❌ Error claiming plan:', error);
// // 		res.status(500).json({
// // 			success: false,
// // 			message: 'Server error while claiming plan'
// // 		});
// // 	}
// // });

// // // ✅ Get active plans for a user
// // router.get("/user/active/:user_id", async (req, res) => {
// // 	try {
// // 		const { user_id } = req.params;

// // 		const activePlans = await Plan.find({
// // 			user_id: user_id,
// // 			status: 'running'
// // 		}).sort({ createdAt: -1 });

// // 		res.json({ success: true, plans: activePlans });
// // 	} catch (error) {
// // 		console.error('❌ Error fetching active plans:', error);
// // 		res.status(500).json({
// // 			success: false,
// // 			message: 'Server error while fetching active plans'
// // 		});
// // 	}
// // });

// // // ✅ ADDED: Get claimed plans for a user
// // router.get("/user/claimed/:user_id", async (req, res) => {
// // 	try {
// // 		const { user_id } = req.params;

// // 		const claimedPlans = await Plan.find({
// // 			user_id: user_id,
// // 			status: 'claimed'
// // 		}).sort({ claimedAt: -1 });

// // 		res.json({ success: true, plans: claimedPlans });
// // 	} catch (error) {
// // 		console.error('❌ Error fetching claimed plans:', error);
// // 		res.status(500).json({
// // 			success: false,
// // 			message: 'Server error while fetching claimed plans'
// // 		});
// // 	}
// // });

// // // ✅ Get a single plan by ID
// // router.get("/:id", getPlanById);

// // // ✅ Update a plan
// // router.put("/:id", updatePlan);

// // // ✅ Delete a plan
// // router.delete("/:id", deletePlan);

// // module.exports = router;



// const express = require("express");
// const {
// 	createPlan,
// 	getPlans,
// 	getPlanById,
// 	updatePlan,
// 	deletePlan,
// 	claimPlan,
// } = require("../controllers/planController");
// const Plan = require("../models/plain");
// const User = require("../models/User");

// const router = express.Router();

// // ✅ Create a new plan
// router.post("/", createPlan);

// // ✅ Get all plans
// router.get("/", getPlans);

// // ✅ Count subscribers for each plan
// router.get("/countSubscribePlanName", async (req, res) => {
// 	console.log("📊 Counting subscribers...");
// 	try {
// 		const planNames = await Plan.distinct("PlanName");
// 		const results = await Promise.all(
// 			planNames.map(async (name) => {
// 				const count = await Plan.countDocuments({ PlanName: name });
// 				return { planName: name, subscribers: count };
// 			})
// 		);
// 		res.json({ success: true, plans: results });
// 	} catch (err) {
// 		console.error("❌ Error counting subscribers:", err);
// 		res.status(500).json({ success: false, message: "Server error" });
// 	}
// });

// // ✅ Claim plan endpoint
// router.post('/claim', claimPlan);

// // ✅ Get active plans for a user
// router.get("/user/active/:user_id", async (req, res) => {
// 	try {
// 		const { user_id } = req.params;
// 		const activePlans = await Plan.find({
// 			user_id: user_id,
// 			status: 'running'
// 		}).sort({ createdAt: -1 });
// 		res.json({ success: true, plans: activePlans });
// 	} catch (error) {
// 		console.error('❌ Error fetching active plans:', error);
// 		res.status(500).json({ success: false, message: 'Server error while fetching active plans' });
// 	}
// });

// // ✅ Get claimed plans for a user
// router.get("/user/claimed/:user_id", async (req, res) => {
// 	try {
// 		const { user_id } = req.params;
// 		const claimedPlans = await Plan.find({
// 			user_id: user_id,
// 			status: 'claimed'
// 		}).sort({ claimedAt: -1 });
// 		res.json({ success: true, plans: claimedPlans });
// 	} catch (error) {
// 		console.error('❌ Error fetching claimed plans:', error);
// 		res.status(500).json({ success: false, message: 'Server error while fetching claimed plans' });
// 	}
// });

// // ✅ Get a single plan by ID
// router.get("/:id", getPlanById);

// // ✅ Update a plan
// router.put("/:id", updatePlan);

// // ✅ Delete a plan
// router.delete("/:id", deletePlan);

// module.exports = router;




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