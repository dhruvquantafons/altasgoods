import { Module } from "@nestjs/common";
import { PAYMENT_PROVIDER } from "../../common/tokens.js";
import { AddressesService } from "./addresses.service.js";
import { CartService } from "./cart.service.js";
import { AddressesController, AdminOrdersController, CartController, DevController, OrdersController, PaymentsController } from "./commerce.controllers.js";
import { DevLogisticsService } from "./dev-logistics.service.js";
import { OrdersService } from "./orders.service.js";
import { PaymentsService } from "./payments/payments.service.js";
import { SandboxPaymentProvider } from "./payments/sandbox.provider.js";
import { PaymentSweeper } from "./payments/sweeper.js";
import { QuoteService } from "./quote.service.js";
import { AdminReturnsController, CustomerReturnsController, DevReturnsController } from "./returns/returns.controllers.js";
import { ReturnsService } from "./returns/returns.service.js";
import { FulfilmentService } from "./fulfilment.service.js";
import { OrderWorkflow } from "./workflow.service.js";

@Module({
  controllers: [AddressesController, CartController, OrdersController, PaymentsController, AdminOrdersController, DevController, CustomerReturnsController, AdminReturnsController, DevReturnsController],
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
    { provide: PAYMENT_PROVIDER, useClass: SandboxPaymentProvider },
  ],
  exports: [ReturnsService, OrdersService, PaymentsService, FulfilmentService, OrderWorkflow, CartService, AddressesService],
})
export class CommerceModule {}
