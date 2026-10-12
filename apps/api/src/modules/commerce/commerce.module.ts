import { Module } from "@nestjs/common";
import { LOGISTICS_PROVIDER, PAYMENT_PROVIDER } from "../../common/tokens.js";
import { env } from "../../config/env.js";
import { AddressesService } from "./addresses.service.js";
import { CartService } from "./cart.service.js";
import { AddressesController, AdminOrdersController, CartController, DevController, LogisticsController, OrdersController, PaymentsController } from "./commerce.controllers.js";
import { DevLogisticsService } from "./dev-logistics.service.js";
import { OrdersService } from "./orders.service.js";
import { PaymentsService } from "./payments/payments.service.js";
import { RazorpayPaymentProvider } from "./payments/razorpay.provider.js";
import { SandboxPaymentProvider } from "./payments/sandbox.provider.js";
import { PaymentSweeper } from "./payments/sweeper.js";
import { QuoteService } from "./quote.service.js";
import { ShippingService } from "./shipping/shipping.service.js";
import { ShiprocketLogisticsProvider } from "./shipping/shiprocket.provider.js";
import { SimulatedLogisticsProvider } from "./shipping/simulated.provider.js";
import { ShipmentTracker } from "./shipping/tracker.js";
import { AdminReturnsController, CustomerReturnsController, DevReturnsController } from "./returns/returns.controllers.js";
import { ReturnsService } from "./returns/returns.service.js";
import { FulfilmentService } from "./fulfilment.service.js";
import { OrderWorkflow } from "./workflow.service.js";

@Module({
  controllers: [AddressesController, CartController, OrdersController, PaymentsController, AdminOrdersController, LogisticsController, DevController, CustomerReturnsController, AdminReturnsController, DevReturnsController],
  providers: [
    AddressesService,
    CartService,
    QuoteService,
    OrderWorkflow,
    PaymentsService,
    OrdersService,
    FulfilmentService,
    DevLogisticsService,
    ReturnsService,
    PaymentSweeper,
    ShippingService,
    ShipmentTracker,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: () => {
        const e = env();
        return e.PAYMENTS_PROVIDER === "razorpay"
          ? new RazorpayPaymentProvider({ keyId: e.RAZORPAY_KEY_ID!, keySecret: e.RAZORPAY_KEY_SECRET!, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET!, webOrigin: e.WEB_ORIGIN })
          : new SandboxPaymentProvider();
      },
    },
    {
      provide: LOGISTICS_PROVIDER,
      useFactory: () => {
        const e = env();
        if (e.LOGISTICS_PROVIDER !== "shiprocket") return new SimulatedLogisticsProvider();
        const [l, b, h] = e.SHIPPING_BOX_CM.split("x").map(Number) as [number, number, number];
        return new ShiprocketLogisticsProvider({
          email: e.SHIPROCKET_EMAIL!,
          password: e.SHIPROCKET_PASSWORD!,
          pickupLocation: e.SHIPROCKET_PICKUP_LOCATION!,
          webhookToken: e.SHIPROCKET_WEBHOOK_TOKEN,
          box: [l, b, h],
        });
      },
    },
  ],
  exports: [ShippingService, ReturnsService, OrdersService, PaymentsService, FulfilmentService, OrderWorkflow, CartService, AddressesService],
})
export class CommerceModule {}
