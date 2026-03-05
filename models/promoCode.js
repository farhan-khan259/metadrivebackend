const mongoose = require("mongoose");

const PromoCodeSchema = new mongoose.Schema(
	{
		code: { type: String, required: true, unique: true, index: true },
		amount: { type: Number, required: true, min: 1 },
		limit: { type: Number, required: true, min: 1 },
		claimAmountsCents: {
			type: [Number],
			default: [],
		},
		claimed: { type: Number, default: 0 },
		claimedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("PromoCode", PromoCodeSchema);
