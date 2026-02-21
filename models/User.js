

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
	{
		fullName: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		password: { type: String, required: true },
		role: { type: String, enum: ["user", "admin"], default: "user" },
		randomCode: { type: String, required: true, unique: true },
		referredBy: { type: String },
		team: [String],
		whatsappNumber: { type: String },
		profilepicture: { type: String },

		// Password reset
		resetOtp: { type: String },
		resetOtpExpire: { type: Date },

		// Balance and investments
		userbalance: { type: Number, default: 0 },
		UserInvestment: { type: Number, default: 0 },
		userTotalDeposits: { type: Number, default: 0 },
		userTotalWithdrawals: { type: Number, default: 0 },
		totalEarnings: { type: Number, default: 0 },

		// Commission tracking
		totalCommissionEarned: { type: Number, default: 0 },
		directCommission: { type: Number, default: 0 },
		indirectCommission: { type: Number, default: 0 },
		extendedCommission: { type: Number, default: 0 },
		planExpireCommission: { type: Number, default: 0 },

		// Wallet for additional funds if needed
		wallet: { type: Number, default: 0 },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);