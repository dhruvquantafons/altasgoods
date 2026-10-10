/**
 * AltasGoods sells everything itself. Offers, order lines and returns still
 * reference a seller row (the schema came from a marketplace), so they all
 * point at this one built-in record, created by migration 0004.
 */
export const HOUSE_SELLER_ID = "s-altasgoods";
