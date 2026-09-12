/**
 * Phương thức thanh toán
 */
export enum PaymentMethod {
  CashOnDelivery = 0,
  CreditCard = 1,
  EWallet = 2,
}

/**
 * Trạng thái thanh toán
 */
export enum PaymentStatus {
  Pending = 0,
  Completed = 1,
  Failed = 2,
  Refunded = 3,
}

/**
 * Loại giảm giá
 */
export enum DiscountType {
  Percentage = 0,
  FixedAmount = 1,
}
