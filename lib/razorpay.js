import Razorpay from "razorpay";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Price for Math Rush, in paise (Razorpay amounts are always the smallest
// currency unit — so ₹149.00 is 14900).
export const MATH_PRICE_PAISE = 14900;
