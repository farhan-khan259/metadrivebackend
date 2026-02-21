// const cron = require("node-cron");
// const Plan = require("../models/plain");
// const User = require("../models/User");
// const { distributePlanExpireCommission } = require("../utils/commissionLogic"); // Add this import

// // Run once every 24 hours at midnight - UPDATED: No daily balance additions
// cron.schedule("0 0 * * *", async () => {
// 	console.log("⏳ Running plan progress update...");

// 	try {
// 		const plans = await Plan.find({ status: 'running' });

// 		for (let plan of plans) {
// 			// Only update the plan's internal tracking (for display purposes)
// 			plan.totalEarning += plan.dailyEarning;
// 			plan.totalAmount = (plan.Investment || 0) + (plan.totalEarning || 0);

// 			// ✅ REMOVED: No daily additions to user balance
// 			// User will get everything when they claim

// 			// Check if plan has completed (reached ending date)
// 			if (plan.endingDate && new Date() >= plan.endingDate) {
// 				plan.planExpired = true;
// 				// Plan is now ready to be claimed
// 				// Status remains 'running' until user manually claims
// 			}

// 			await plan.save();
// 		}

// 		console.log(`✅ Plan progress updated for ${plans.length} active plans!`);
// 	} catch (err) {
// 		console.error("❌ Error updating plan progress:", err.message);
// 	}
// });




const cron = require("node-cron");
const Plan = require("../models/plain");
const User = require("../models/User");
const { distributePlanExpireCommission } = require("../utils/commissionLogic");

// Run once every 24 hours at midnight - UPDATED: Mark as completed, not expired
cron.schedule("0 0 * * *", async () => {
	console.log("⏳ Running plan progress update...");

	try {
		const plans = await Plan.find({ status: 'running' });

		for (let plan of plans) {
			// Only update the plan's internal tracking (for display purposes)
			plan.totalEarning += plan.dailyEarning;
			plan.totalAmount = (plan.Investment || 0) + (plan.totalEarning || 0);

			// ✅ Check if plan has completed (reached ending date)
			if (plan.endingDate && new Date() >= plan.endingDate) {
				plan.status = 'completed'; // ✅ Change to completed, not expired
				plan.completedAt = new Date();
				plan.planExpired = true;
			}

			await plan.save();
		}

		console.log(`✅ Plan progress updated for ${plans.length} active plans!`);
	} catch (err) {
		console.error("❌ Error updating plan progress:", err.message);
	}
});