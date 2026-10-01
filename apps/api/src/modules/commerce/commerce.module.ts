import { Module } from "@nestjs/common";
import { PAYMENT_PROVIDER } from "../../common/tokens.js";
import { AddressesService } from "./addresses.service.js";
import { CartService } from "./cart.service.js";
import { AddressesController, CartController, DevController, OrdersController, PaymentsController, SellerOrdersController } from "./commerce.controllers.js";
import { DevLogisticsService } from "./dev-logistics.service.js";
import { OrdersService } from "./orders.service.js";
import { PaymentsService } from "./payments/payments.service.js";
import { SandboxPaymentProvider } from "./payments/sandbox.provider.js";
import { PaymentSweeper } from "./payments/sweeper.js";
import { QuoteService } from "./quote.service.js";
import { SellerOrdersService } from "./seller-orders.service.js";
import { OrderWorkflow } from "./workflow.service.js";

@Module({
  controllers: [AddressesController, CartController, OrdersController, PaymentsController, SellerOrdersController, DevController],
  providers: [
    AddressesService,
    CartService,
    QuoteService,
    OrderWorkflow,
    PaymentsService,
    OrdersService,
    SellerOrdersService,
    DevLogisticsService,
    PaymentSweeper,
    { provide: PAYMENT_PROVIDER, useClass: SandboxPaymentProvider },
  ],
  exports: [OrdersService, PaymentsService, SellerOrdersService, OrderWorkflow, CartService, AddressesService],
})
export class CommerceModule {}
