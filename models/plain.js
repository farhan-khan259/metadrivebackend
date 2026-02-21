// // // UPDATED
// // const mongoose = require("mongoose");

// // const PlanSchema = new mongoose.Schema(
// // 	{
// // 		user_id: {
// // 			type: mongoose.Schema.Types.ObjectId,
// // 			ref: "User",
// // 			required: true
// // 		},
// // 		PlanName: {
// // 			type: String,
// // 			required: true
// // 		},
// // 		Investment: {
// // 			type: Number,
// // 			required: true
// // 		},
// // 		dailyEarning: {
// // 			type: Number,
// // 			required: true
// // 		},
// // 		totalEarning: {
// // 			type: Number,
// // 			default: 0
// // 		},
// // 		totalAmount: {
// // 			type: Number,
// // 			default: 0
// // 		},
// // 		planExpireText: {
// // 			type: String
// // 		},
// // 		expiryDate: {
// // 			type: Date
// // 		},
// // 		planExpired: {
// // 			type: Boolean,
// // 			default: false
// // 		},

// // 		// NEW FIELDS - Make endingDate optional temporarily
// // 		returnProfit: {
// // 			type: Number,
// // 			default: 0
// // 		},
// // 		profitPercentage: {
// // 			type: String,
// // 			default: "5.6%"
// // 		},
// // 		startingDate: {
// // 			type: Date,
// // 			default: Date.now
// // 		},
// // 		endingDate: {
// // 			type: Date,
// // 			default: function () {
// // 				// Default to 30 days from now
// // 				const date = new Date();
// // 				date.setDate(date.getDate() + (this.days || 30));
// // 				return date;
// // 			}
// // 		},
// // 		days: {
// // 			type: Number,
// // 			default: 30
// // 		},
// // 		status: {
// // 			type: String,
// // 			enum: ['running', 'claimed', 'cancelled'],
// // 			default: 'running'
// // 		},
// // 		claimedAt: {
// // 			type: Date
// // 		}
// // 	},
// // 	{ timestamps: true }
// // );

// // module.exports = mongoose.model("Plan", PlanSchema);



// const mongoose = require("mongoose");

// const PlanSchema = new mongoose.Schema(
// 	{
// 		user_id: {
// 			type: mongoose.Schema.Types.ObjectId,
// 			ref: "User",
// 			required: true
// 		},
// 		PlanName: {
// 			type: String,
// 			required: true
// 		},
// 		Investment: {
// 			type: Number,
// 			required: true
// 		},
// 		dailyEarning: {
// 			type: Number,
// 			required: true
// 		},
// 		totalEarning: {
// 			type: Number,
// 			default: 0
// 		},
// 		totalAmount: {
// 			type: Number,
// 			default: 0
// 		},
// 		planExpireText: {
// 			type: String
// 		},
// 		expiryDate: {
// 			type: Date
// 		},
// 		planExpired: {
// 			type: Boolean,
// 			default: false
// 		},

// 		// Commission Related Fields
// 		returnProfit: {
// 			type: Number,
// 			default: 0
// 		},
// 		profitPercentage: {
// 			type: String, // Store as string like "3.6%", "4.5%", etc.
// 			required: true
// 		},
// 		startingDate: {
// 			type: Date,
// 			default: Date.now
// 		},
// 		endingDate: {
// 			type: Date,
// 			default: function () {
// 				const date = new Date();
// 				date.setDate(date.getDate() + (this.days || 30));
// 				return date;
// 			}
// 		},
// 		days: {
// 			type: Number,
// 			required: true
// 		},
// 		status: {
// 			type: String,
// 			enum: ['running', 'claimed', 'cancelled', 'expired'],
// 			default: 'running'
// 		},
// 		claimedAt: {
// 			type: Date
// 		},

// 		// NEW FIELDS FOR COMMISSION SYSTEM
// 		commissionsDistributed: {
// 			type: Boolean,
// 			default: false
// 		},
// 		commissionDistributionDate: {
// 			type: Date
// 		},
// 		commissionAmount: {
// 			type: Number,
// 			default: 0
// 		},
// 		uplineCommissions: [{
// 			level: {
// 				type: Number,
// 				required: true
// 			},
// 			uplinerId: {
// 				type: mongoose.Schema.Types.ObjectId,
// 				ref: "User",
// 				required: true
// 			},
// 			commissionAmount: {
// 				type: Number,
// 				required: true
// 			},
// 			commissionRate: {
// 				type: Number,
// 				required: true
// 			},
// 			distributedAt: {
// 				type: Date,
// 				default: Date.now
// 			}
// 		}]
// 	},
// 	{ timestamps: true }
// );

// // Pre-save middleware to calculate return profit based on actual percentage
// PlanSchema.pre('save', function (next) {
// 	// Parse percentage from string (remove % and convert to number)
// 	const parsePercentage = (percentageStr) => {
// 		if (!percentageStr) return 0;
// 		// Remove any non-digit characters except decimal point and percentage
// 		const cleanStr = percentageStr.toString().replace(/[^\d.]/g, '');
// 		return parseFloat(cleanStr) || 0;
// 	};

// 	// Calculate return profit based on investment and actual profit percentage
// 	if (this.isModified('Investment') || this.isModified('profitPercentage') || this.isModified('days')) {
// 		const percentage = parsePercentage(this.profitPercentage);

// 		// Calculate daily earning (Investment * percentage / 100)
// 		if (this.isNew || this.isModified('Investment') || this.isModified('profitPercentage')) {
// 			this.dailyEarning = Math.round(this.Investment * (percentage / 100));
// 		}

// 		// Calculate total return profit (dailyEarning * days)
// 		this.returnProfit = this.dailyEarning * (this.days || 0);

// 		// Update totalAmount (Investment + returnProfit)
// 		this.totalAmount = this.Investment + this.returnProfit;
// 	}

// 	// Set endingDate based on days if not provided
// 	if (!this.endingDate && this.days) {
// 		const date = new Date(this.startingDate || Date.now());
// 		date.setDate(date.getDate() + this.days);
// 		this.endingDate = date;
// 	}

// 	// Set expiryDate to match endingDate if not provided
// 	if (!this.expiryDate && this.endingDate) {
// 		this.expiryDate = this.endingDate;
// 	}

// 	// Auto-update status based on dates
// 	if (this.endingDate && new Date() > this.endingDate && this.status === 'running') {
// 		this.status = 'expired';
// 		this.planExpired = true;
// 	}

// 	next();
// });

// // Static method to find expired plans that need commission distribution
// PlanSchema.statics.findPlansForCommissionDistribution = function () {
// 	return this.find({
// 		status: { $in: ['claimed', 'expired'] },
// 		commissionsDistributed: false,
// 		endingDate: { $lte: new Date() },
// 		returnProfit: { $gt: 0 }
// 	}).populate('user_id');
// };

// // Instance method to mark commissions as distributed
// PlanSchema.methods.markCommissionsDistributed = function () {
// 	this.commissionsDistributed = true;
// 	this.commissionDistributionDate = new Date();
// 	return this.save();
// };

// // Instance method to add upline commission record
// PlanSchema.methods.addUplineCommission = function (level, uplinerId, commissionAmount, commissionRate) {
// 	this.uplineCommissions.push({
// 		level,
// 		uplinerId,
// 		commissionAmount,
// 		commissionRate,
// 		distributedAt: new Date()
// 	});
// 	return this.save();
// };

// // Virtual for checking if plan is eligible for commission distribution
// PlanSchema.virtual('isEligibleForCommission').get(function () {
// 	return (this.status === 'claimed' || this.status === 'expired') &&
// 		!this.commissionsDistributed &&
// 		this.endingDate <= new Date() &&
// 		this.returnProfit > 0;
// });

// // Virtual to get numeric profit percentage
// PlanSchema.virtual('numericProfitPercentage').get(function () {
// 	const parsePercentage = (percentageStr) => {
// 		if (!percentageStr) return 0;
// 		const cleanStr = percentageStr.toString().replace(/[^\d.]/g, '');
// 		return parseFloat(cleanStr) || 0;
// 	};
// 	return parsePercentage(this.profitPercentage);
// });

// // Index for better performance on commission queries
// PlanSchema.index({ status: 1, commissionsDistributed: 1, endingDate: 1 });
// PlanSchema.index({ user_id: 1, status: 1 });
// PlanSchema.index({ endingDate: 1 });

// module.exports = mongoose.model("Plan", PlanSchema);





const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema(
	{
		user_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		PlanName: {
			type: String,
			required: true,
		},
		Investment: {
			type: Number,
			required: true,
		},
		dailyEarning: {
			type: Number,
			required: true,
		},
		totalEarning: {
			type: Number,
			default: 0,
		},
		totalAmount: {
			type: Number,
			default: 0,
		},
		planExpireText: {
			type: String,
		},
		expiryDate: {
			type: Date,
		},
		planExpired: {
			type: Boolean,
			default: false,
		},

		// Commission Related Fields
		returnProfit: {
			type: Number,
			default: 0,
		},
		profitPercentage: {
			type: String, // Store as string like "3.6%", "4.5%", etc.
			required: true,
		},
		startingDate: {
			type: Date,
			default: Date.now,
		},
		endingDate: {
			type: Date,
			default: function () {
				const date = new Date();
				date.setDate(date.getDate() + (this.days || 30));
				return date;
			},
		},
		days: {
			type: Number,
			required: true,
		},
		status: {
			type: String,
			enum: ["running", "claimed", "cancelled", "expired", "completed"],
			default: "running",
		},
		claimedAt: {
			type: Date,
		},
		completedAt: {
			type: Date,
		},

		// NEW FIELDS FOR COMMISSION SYSTEM
		commissionsDistributed: {
			type: Boolean,
			default: false,
		},
		commissionDistributionDate: {
			type: Date,
		},
		commissionAmount: {
			type: Number,
			default: 0,
		},
		uplineCommissions: [
			{
				level: {
					type: Number,
					required: true,
				},
				uplinerId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
					required: true,
				},
				commissionAmount: {
					type: Number,
					required: true,
				},
				commissionRate: {
					type: Number,
					required: true,
				},
				distributedAt: {
					type: Date,
					default: Date.now,
				},
			},
		],
	},
	{ timestamps: true }
);

// ✅ Pre-save middleware - UPDATED: Remove auto-expiration
PlanSchema.pre("save", function (next) {
	// Parse percentage from string
	const parsePercentage = (percentageStr) => {
		if (!percentageStr) return 0;
		const cleanStr = percentageStr.toString().replace(/[^\d.]/g, "");
		return parseFloat(cleanStr) || 0;
	};

	// Calculate return profit based on investment and profit percentage
	if (
		this.isModified("Investment") ||
		this.isModified("profitPercentage") ||
		this.isModified("days")
	) {
		const percentage = parsePercentage(this.profitPercentage);

		// Calculate daily earning (Investment * percentage / 100)
		if (
			this.isNew ||
			this.isModified("Investment") ||
			this.isModified("profitPercentage")
		) {
			this.dailyEarning = Math.round(this.Investment * (percentage / 100));
		}

		// Calculate total return profit (dailyEarning * days)
		this.returnProfit = this.dailyEarning * (this.days || 0);

		// Update totalAmount (Investment + returnProfit)
		this.totalAmount = this.Investment + this.returnProfit;
	}

	// Set endingDate based on days if not provided
	if (!this.endingDate && this.days) {
		const date = new Date(this.startingDate || Date.now());
		date.setDate(date.getDate() + this.days);
		this.endingDate = date;
	}

	// Set expiryDate to match endingDate if not provided
	if (!this.expiryDate && this.endingDate) {
		this.expiryDate = this.endingDate;
	}

	// ✅ Auto mark plan as completed if progress/time is done
	// But don't auto-expire - keep as completed until claimed
	const now = new Date();
	if (
		this.status === "running" &&
		this.endingDate &&
		now >= this.endingDate
	) {
		this.status = "completed";
		this.completedAt = now;
		this.planExpired = true; // Mark as expired but status stays completed
	}

	next();
});

// Static method to find expired plans that need commission distribution
PlanSchema.statics.findPlansForCommissionDistribution = function () {
	return this.find({
		status: { $in: ["claimed", "expired", "completed"] },
		commissionsDistributed: false,
		endingDate: { $lte: new Date() },
		returnProfit: { $gt: 0 },
	}).populate("user_id");
};

// Instance method to mark commissions as distributed
PlanSchema.methods.markCommissionsDistributed = function () {
	this.commissionsDistributed = true;
	this.commissionDistributionDate = new Date();
	return this.save();
};

// Instance method to add upline commission record
PlanSchema.methods.addUplineCommission = function (
	level,
	uplinerId,
	commissionAmount,
	commissionRate
) {
	this.uplineCommissions.push({
		level,
		uplinerId,
		commissionAmount,
		commissionRate,
		distributedAt: new Date(),
	});
	return this.save();
};

// Virtual for checking if plan is eligible for commission distribution
PlanSchema.virtual("isEligibleForCommission").get(function () {
	return (
		(this.status === "claimed" ||
			this.status === "expired" ||
			this.status === "completed") &&
		!this.commissionsDistributed &&
		this.endingDate <= new Date() &&
		this.returnProfit > 0
	);
});

// Virtual to get numeric profit percentage
PlanSchema.virtual("numericProfitPercentage").get(function () {
	const parsePercentage = (percentageStr) => {
		if (!percentageStr) return 0;
		const cleanStr = percentageStr.toString().replace(/[^\d.]/g, "");
		return parseFloat(cleanStr) || 0;
	};
	return parsePercentage(this.profitPercentage);
});

// Index for better performance on commission queries
PlanSchema.index({ status: 1, commissionsDistributed: 1, endingDate: 1 });
PlanSchema.index({ user_id: 1, status: 1 });
PlanSchema.index({ endingDate: 1 });

module.exports = mongoose.model("Plan", PlanSchema);