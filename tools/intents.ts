/**
 * Twenty four things customers of an online shop ask, each with the ways they
 * ask it. `bound` means the answer depends on a number in the request (an order
 * number): two requests with the same words and different numbers are different
 * questions. `tokens` is what one answer costs to generate, in and out.
 *
 * Written by hand and kept short on purpose, with real confusable pairs in it:
 * cancel an order and cancel a subscription, a refund's status and the refund
 * policy, an address on an order and an address in an account.
 */
export type Intent = { id: string; bound: boolean; tokens: [number, number]; ask: string[] }

export const INTENTS: Intent[] = [
  { id: 'order_status', bound: true, tokens: [140, 220], ask: ['where is my order {n}', 'order {n} status please', 'has order #{n} shipped yet', 'can you check on order number {n}', 'i placed order {n} last week, when does it arrive', 'tracking for {n}?'] },
  { id: 'cancel_order', bound: true, tokens: [150, 260], ask: ['cancel order {n}', 'please cancel my order #{n}', 'i want to cancel order number {n}', 'how do i cancel order {n}', 'stop order {n}, i changed my mind'] },
  { id: 'cancel_subscription', bound: false, tokens: [120, 310], ask: ['cancel my subscription', 'how do i cancel my monthly plan', 'i want to stop my subscription', 'end my membership please', 'unsubscribe me from the plan'] },
  { id: 'refund_status', bound: true, tokens: [150, 240], ask: ['where is my refund for order {n}', 'refund for order #{n} has not arrived', 'when will i get the money back for order {n}', 'status of the refund on {n}'] },
  { id: 'refund_policy', bound: false, tokens: [110, 420], ask: ['what is your refund policy', 'can i return an item and get my money back', 'how do refunds work', 'what are the return conditions', 'do you accept returns'] },
  { id: 'change_address_order', bound: true, tokens: [150, 230], ask: ['change the delivery address for order {n}', 'i need to update the shipping address on order #{n}', 'wrong address on order {n}, can you fix it'] },
  { id: 'change_address_account', bound: false, tokens: [110, 280], ask: ['how do i update my address in my account', 'change my saved address', 'edit the billing address in my profile'] },
  { id: 'reset_password', bound: false, tokens: [100, 260], ask: ['i forgot my password', 'reset my password', 'cannot log in, need a new password', 'how do i change my password'] },
  { id: 'delete_account', bound: false, tokens: [110, 340], ask: ['delete my account', 'how do i close my account permanently', 'remove all my data from your site', 'i want my account deleted'] },
  { id: 'shipping_cost', bound: false, tokens: [100, 300], ask: ['how much is shipping', 'what are the delivery fees', 'do you charge for delivery', 'shipping costs to greece'] },
  { id: 'shipping_time', bound: false, tokens: [100, 260], ask: ['how long does delivery take', 'when will my package arrive usually', 'what is the delivery time', 'how many days for shipping'] },
  { id: 'payment_methods', bound: false, tokens: [100, 290], ask: ['which payment methods do you accept', 'can i pay with paypal', 'do you take credit cards', 'can i pay cash on delivery'] },
  { id: 'invoice', bound: true, tokens: [140, 250], ask: ['i need an invoice for order {n}', 'send me the invoice for order #{n}', 'can i get a tax invoice for {n}', 'where do i download the receipt for order {n}'] },
  { id: 'discount_code', bound: false, tokens: [110, 330], ask: ['how do i use a discount code', 'where do i enter a promo code', 'my coupon does not work', 'apply a voucher at checkout'] },
  { id: 'stock', bound: false, tokens: [100, 240], ask: ['is this item in stock', 'when will it be back in stock', 'do you have this product available', 'restock date for sold out items'] },
  { id: 'warranty', bound: false, tokens: [110, 380], ask: ['how long is the warranty', 'what does the warranty cover', 'my device broke, is it under warranty', 'warranty terms'] },
  { id: 'contact_human', bound: false, tokens: [90, 150], ask: ['i want to talk to a human', 'connect me to an agent', 'can i speak to someone', 'phone number for support'] },
  { id: 'opening_hours', bound: false, tokens: [90, 140], ask: ['what are your opening hours', 'when are you open', 'is the store open on sunday', 'support hours'] },
  { id: 'gift_wrap', bound: false, tokens: [100, 210], ask: ['can you gift wrap my order', 'do you offer gift wrapping', 'add a gift message', 'wrap it as a present'] },
  { id: 'international', bound: false, tokens: [100, 320], ask: ['do you ship abroad', 'can you deliver to germany', 'international shipping available', 'ship to cyprus?'] },
  { id: 'damaged_item', bound: true, tokens: [160, 340], ask: ['the item from order {n} arrived damaged', 'order #{n} came broken', 'the package {n} was damaged when it arrived', 'received a broken product in order {n}'] },
  { id: 'missing_item', bound: true, tokens: [160, 330], ask: ['order {n} is missing an item', 'part of order #{n} did not arrive', 'my order {n} was incomplete', 'one product missing from order {n}'] },
  { id: 'price_match', bound: false, tokens: [110, 300], ask: ['do you match prices', 'i found it cheaper elsewhere', 'price match guarantee', 'will you beat a competitor price'] },
  { id: 'newsletter', bound: false, tokens: [100, 200], ask: ['how do i unsubscribe from emails', 'stop sending me newsletters', 'i keep getting promotional emails', 'opt out of marketing messages'] },
]

/**
 * Questions whose answer depends on a name rather than a number: which product,
 * which country. Kept out of the main streams on purpose and replayed on their
 * own, to measure what a guard that only knows digits does with them. `{p}` is a
 * product, `{c}` a country, and the pairs are chosen to be one word apart.
 */
export const PRODUCTS = ['blue kettle', 'red kettle', 'oak desk', 'pine desk', 'wool scarf', 'silk scarf', 'steel bottle', 'glass bottle']
export const COUNTRIES = ['germany', 'cyprus', 'italy', 'spain', 'austria', 'portugal']

export const WORD_INTENTS: Intent[] = [
  { id: 'stock_product', bound: true, tokens: [120, 200], ask: ['is the {p} in stock', 'do you have the {p} available', 'when will the {p} be back in stock', 'is the {p} sold out'] },
  { id: 'price_product', bound: true, tokens: [110, 180], ask: ['how much is the {p}', 'what does the {p} cost', 'price of the {p}?'] },
  { id: 'ship_country', bound: true, tokens: [120, 240], ask: ['do you ship to {c}', 'how long does delivery to {c} take', 'what does shipping to {c} cost', 'can you deliver to {c}'] },
]

/** The names a shop already has, which the second guard is given. */
export const CATALOG = [...PRODUCTS, ...COUNTRIES]
