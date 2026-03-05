const mongoose = require("mongoose");

const PromoCodeClaimSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		promoCodeId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "PromoCode",
			required: true,
		},
		code: { type: String, required: true },
		creditedAmount: { type: Number, required: true, min: 0 },
		totalAmount: { type: Number, required: true, min: 0 },
		limit: { type: Number, required: true, min: 1 },
		claimIndex: { type: Number, required: true, min: 1 },
	},
	{ timestamps: true }
);

PromoCodeClaimSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model("PromoCodeClaim", PromoCodeClaimSchema);
