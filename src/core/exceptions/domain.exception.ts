export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainException';
  }
}

export class InvalidEmailException extends DomainException {
  constructor(email: string) {
    super(`Invalid email: ${email}`);
    this.name = 'InvalidEmailException';
  }
}

export class InvalidPasswordException extends DomainException {
  constructor(reason: string) {
    super(`Invalid password: ${reason}`);
    this.name = 'InvalidPasswordException';
  }
}

export class UserNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
    this.name = 'UserNotFoundException';
  }
}

export class UserAlreadyExistsException extends DomainException {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
    this.name = 'UserAlreadyExistsException';
  }
}

export class ProductNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Product not found: ${identifier}`);
    this.name = 'ProductNotFoundException';
  }
}

export class InsufficientStockException extends DomainException {
  constructor(variantId: string, available: number, requested: number) {
    super(
      `Insufficient stock for variant ${variantId}: available=${available}, requested=${requested}`,
    );
    this.name = 'InsufficientStockException';
  }
}

export class BrandNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Brand not found: ${identifier}`);
    this.name = 'BrandNotFoundException';
  }
}

export class CategoryNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Category not found: ${identifier}`);
    this.name = 'CategoryNotFoundException';
  }
}

export class SupplierNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Supplier not found: ${identifier}`);
    this.name = 'SupplierNotFoundException';
  }
}

export class CustomerNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Customer not found: ${identifier}`);
    this.name = 'CustomerNotFoundException';
  }
}

export class CartNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Cart not found: ${identifier}`);
    this.name = 'CartNotFoundException';
  }
}

export class CartEmptyException extends DomainException {
  constructor() {
    super('Cart is empty');
    this.name = 'CartEmptyException';
  }
}

export class OrderNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Order not found: ${identifier}`);
    this.name = 'OrderNotFoundException';
  }
}

export class InvalidOrderStateTransitionException extends DomainException {
  constructor(currentState: string, targetState: string) {
    super(
      `Invalid order state transition from ${currentState} to ${targetState}`,
    );
    this.name = 'InvalidOrderStateTransitionException';
  }
}

export class VoucherNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Voucher not found: ${identifier}`);
    this.name = 'VoucherNotFoundException';
  }
}

export class VoucherExpiredException extends DomainException {
  constructor(code: string) {
    super(`Voucher ${code} has expired`);
    this.name = 'VoucherExpiredException';
  }
}

export class VoucherUsageLimitExceededException extends DomainException {
  constructor(code: string) {
    super(`Voucher ${code} usage limit exceeded`);
    this.name = 'VoucherUsageLimitExceededException';
  }
}

export class VoucherMinOrderValueException extends DomainException {
  constructor(code: string, minValue: number) {
    super(
      `Order value does not meet minimum requirement of ${minValue} for voucher ${code}`,
    );
    this.name = 'VoucherMinOrderValueException';
  }
}

export class ShippingAddressNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Shipping address not found: ${identifier}`);
    this.name = 'ShippingAddressNotFoundException';
  }
}
