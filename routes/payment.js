
const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// File upload (for deposit screenshots)
const multer = require("multer");
const path = require("path");

// ✅ Configure Multer storage
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "uploads/"); // save in uploads/ folder
	},
	filename: function (req, file, cb) {
		cb(
			null,
			Date.now() +
			"-" +
			Math.round(Math.random() * 1e9) +
			path.extname(file.originalname)
		);
	},
});

// ✅ File filter to accept images
const fileFilter = (req, file, cb) => {
	const allowedTypes = /jpeg|jpg|png|gif|webp/;
	const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
	const mimeType = allowedTypes.test(file.mimetype);

	if (extName && mimeType) {
		cb(null, true);
	} else {
		cb(new Error('Only image files are allowed!'), false);
	}
};

const upload = multer({ 
	storage,
	fileFilter,
	limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ✅ Routes
router.post(
	"/deposit",
	(req, res, next) => {
		upload.single("screenshot")(req, res, (err) => {
			if (err instanceof multer.MulterError) {
				console.error('Multer error:', err);
				if (err.code === 'LIMIT_FILE_SIZE') {
					return res.status(400).json({
						success: false,
						message: 'File too large. Maximum size is 10MB'
					});
				}
				return res.status(400).json({
					success: false,
					message: err.message
				});
			} else if (err) {
				console.error('Upload error:', err);
				return res.status(400).json({
					success: false,
					message: err.message
				});
			}
			next();
		});
	},
	paymentController.createDeposit
);
router.post("/withdrawal", paymentController.createWithdrawal);

router.get("/payments", paymentController.getPayments);
router.post("/status", paymentController.updatePaymentStatus);
router.get("/:id", paymentController.getPaymentById);
router.delete("/:id", paymentController.deletePayment);

module.exports = router;