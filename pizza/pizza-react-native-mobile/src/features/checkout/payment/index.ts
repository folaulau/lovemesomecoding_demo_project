/**
 * The only import path the rest of the app uses for payments.
 *
 * <p>Metro resolves `./paymentGateway` to `paymentGateway.web.tsx` on web and `paymentGateway.tsx`
 * everywhere else. TypeScript resolves it to the latter, so the native implementation is the one
 * that has to satisfy the contract — which is the right way round.
 */
export { StripeProvider, usePaymentGateway } from './paymentGateway';
export type {
  PaymentGateway,
  PaymentOutcome,
  CardSetupOutcome,
  PaymentSheetRequest,
} from './types';
