// const mongoose = require("mongoose");

// const PaymentSchema = new mongoose.Schema(
// 	{
// 		user_id: {
// 			type: mongoose.Schema.Types.ObjectId,
// 			ref: "User",
// 			required: true,
// 		},
// 		depositsAmount: {
// 			type: Number,
// 		},
// 		accountNumber: {
// 			type: Number,
// 		},
// 		accountHolderName: {
// 			type: String,
// 		},
// 		withdrawalsAmount: {
// 			type: Number,
// 		},
// 		payment_method: {
// 			type: String,
// 		},
// 		depositStatus: {
// 			type: String,
// 		},
// 		withdrawalStatus: {
// 			type: String,
// 		},
// 		screenshot: {
// 			type: String,
// 		},
// 		transaction_id: {
// 			type: String,
// 			unique: true,
// 			sparse: true, // Allows multiple null values but ensures uniqueness for non-null values
// 		},
// 		description: {
// 			type: String,
// 		},
// 	},
// 	{
// 		timestamps: true,
// 		versionKey: false,
// 	}
// );

// // Use this pattern to prevent OverwriteModelError
// module.exports =
// 	mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);



const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
	{
		user_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		depositsAmount: {
			type: Number,
		},
		accountNumber: {
			type: String, // Changed from Number to String (account numbers can have leading zeros)
		},
		accountHolderName: {
			type: String,
		},
		withdrawalsAmount: {
			type: Number, // Original requested amount (500)
		},
		netWithdrawal: {
			type: Number, // Amount after fee (485)
		},
		withdrawalFee: {
			type: Number, // Fee amount (15)
		},
		bankName: {
			type: String, // Added bank name field
		},
		payment_method: {
			type: String,
		},
		depositStatus: {
			type: String,
			enum: ["pending", "approved", "rejected"],
			default: "pending"
		},
		withdrawalStatus: {
			type: String,
			enum: ["pending", "approved", "rejected"],
			default: "pending"
		},
		screenshot: {
			type: String,
		},
		transaction_id: {
			type: String,
			unique: true,
			sparse: true,
		},
		description: {
			type: String,
		},
	},
	{
		timestamps: true,
		versionKey: false,
	}
);

// Use this pattern to prevent OverwriteModelError
module.exports =
	mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);