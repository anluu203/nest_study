/**
 * Trạng thái đơn hàng - Order State Machine
 */
export enum StateOrder {
  Canceled = 0,
  Pending = 1,
  Confirmed = 2,
  Processing = 3,
  Shipped = 4,
  Delivered = 5,
  Returned = 6,
  Refunded = 7,
  RequestCancel = 8,
  RejectCancel = 9,
}

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
