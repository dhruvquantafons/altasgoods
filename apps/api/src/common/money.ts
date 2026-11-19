/** Paise as people read rupees: ₹1,299 or ₹12.50. */
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
