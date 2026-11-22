"use client";

import { SearchIcon, ShoppingBasketIcon, ShoppingCartIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PAYMENT_TYPE_LABELS, type PaymentType } from "@/domain/entities/sale";
import { birthdayGiftAvailable } from "@/domain/services/birthday";
import {
  buildWorkerDiscountRule,
  unitsPerDayOf,
  maxRedeemableSoles,
  pointsForSoles,
  priceSale,
  saleLines,
} from "@/domain/services/sale-pricing";
import {
  CatalogAge,
  ScanFlash,
  ScannerStatus,
  useScanFlash,
} from "@/components/scanner/scanner-status";
import { buildBarcodeIndex } from "@/domain/services/barcode-scan";
import type { CaptureSource } from "@/domain/value-objects/capture-source";
import { useCart } from "@/hooks/use-cart";
import { useCatalogRefresh } from "@/hooks/use-catalog-refresh";
import { useScanner } from "@/hooks/use-scanner";
import { useCashShift } from "@/hooks/use-cash-shift";
import { enqueueSale } from "@/infrastructure/offline/queue";
import { runSync } from "@/infrastructure/offline/sync-engine";
import type { CachedPolicy, PendingSale } from "@/infrastructure/offline/types";
import { refreshWorkerSnapshot } from "@/infrastructure/offline/worker-cache";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { formatSoles } from "@/lib/money";
import { CartPanel, type PromoOption } from "./cart-panel";
import { type SidebarCategory, CategorySidebar } from "./category-sidebar";
import { CheckoutDialog } from "./checkout-dialog";
import { watchSaleDocument } from "./sale-document-toast";
import type { SaleDocumentRequest } from "@/domain/entities/sale-document";
import { type ShelfExpiry, ExpiryReminder } from "./expiry-reminder";
import { OfflineIndicator } from "./offline-indicator";
import { OpenShiftPanel } from "./open-shift-panel";
import { PosHelp } from "./pos-help";
import { ProductGrid } from "./product-grid";
import { RedeemPointsDialog } from "./redeem-points-dialog";
import { SearchBar } from "./search-bar";
import { ShiftMenu } from "./shift-menu";
import { type AppliedWorker, WorkerDiscountDialog } from "./worker-discount-dialog";

type Product = {
  id: number;
  name: string;
  barcode: string | null;
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  priceSale: number;
  imageUrl?: string | null;
};

type BoxCode = { id: number; productId: number; barcode: string | null; name: string };

export function PosScreen({
  products,
  categories,
  cashierId,
  shelfExpiry,
  boxCodes,
  catalogAt,
  promoDiscounts,
}: {
  products: Product[];
  // Every active category, in the admin's order. Shown even when none of
  // its products is on the shop floor yet.
  categories: SidebarCategory[];
  // Percentage discounts the admin offers (active ones).
  promoDiscounts: PromoOption[];
  cashierId: number;
  boxCodes: BoxCode[];
  // When the server built this catalog (old = page served from the cache).
  catalogAt: string;
  // Shop-floor lots to check (expired or inside their warning window).
  shelfExpiry: ShelfExpiry[];
}) {
  const cart = useCart();
  // Selling needs an open till shift ("Abrir caja") on this device.
  const cash = useCashShift(cashierId);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Electronic document of the sale being charged (boleta by default), and
  // the sale whose document the till is waiting for after confirming.
  const [saleDocument, setSaleDocument] = useState<SaleDocumentRequest>({ type: "boleta" });
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false);
  const [worker, setWorker] = useState<{
    applied: AppliedWorker;
    policy: CachedPolicy;
  } | null>(null);
  // Percentage the cashier chose for the identified worker (from Descuentos).
  const [promo, setPromo] = useState<PromoOption | null>(null);
  // The worker confirmed (birth date) spending their points on this sale.
  const [redeem, setRedeem] = useState(false);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  // The sale's uuid is the sync's idempotency key (the numeric id — the
  // order number — comes later, from the server).
  const saleUuidRef = useRef<string | null>(null);
  function currentSaleUuid() {
    saleUuidRef.current ??= crypto.randomUUID();
    return saleUuidRef.current;
  }

  // Download the worker list + discount rule so the discount also works
  // without internet.
  useEffect(() => {
    void refreshWorkerSnapshot({ force: true });
  }, []);

  // Picks up products, categories and discounts the admin changed while
  // this tab was open.
  useCatalogRefresh(catalogAt);

  // Checked when charging too: a till left open past midnight must not
  // keep offering yesterday's birthday gift.
  const giftAvailable =
    worker !== null &&
    birthdayGiftAvailable({
      birthDate: worker.applied.birthDate,
      giftUsedThisYear: worker.applied.usage.giftUsedThisYear,
      giftMaxAmount: worker.policy.birthdayGiftMaxAmount,
      at: new Date(),
    });
  const discount = worker
    ? buildWorkerDiscountRule(
        { ...worker.policy, maxDiscountedUnitsPerDay: unitsPerDayOf(worker.policy) },
        { discountedUnitsToday: worker.applied.usage.discountedUnitsToday ?? 0 },
        giftAvailable,
      )
    : null;
  const rule = discount?.rule ?? null;
  const promoRule = promo && { id: promo.id, percent: promo.percent };
  const basePricing = priceSale(cart.items, rule, promoRule);
  // As many whole soles as the points cover; follows the basket as it
  // changes.
  const redeemableSoles = worker
    ? maxRedeemableSoles(worker.applied.pointsBalance, rule, basePricing.total)
    : 0;
  const pricing =
    redeem && redeemableSoles > 0
      ? priceSale(cart.items, rule, promoRule, redeemableSoles)
      : basePricing;
  const workerPoints = worker
    ? {
        balance: worker.applied.pointsBalance,
        rules: {
          pointsPerSol: worker.policy.pointsPerSol,
          redeemPointsPerSol: worker.policy.redeemPointsPerSol ?? 0,
          minRedeemPoints: worker.policy.minRedeemPoints ?? 0,
        },
        redeemableSoles,
        redeemablePoints: pointsForSoles(redeemableSoles, rule),
      }
    : null;

  let workerNotice: string | null = null;
  if (worker && discount) {
    const perDay = unitsPerDayOf(worker.policy);
    if (discount.limitReached === "daily") {
      workerNotice = "Ya usó su compra con descuento de hoy. Esta compra va a precio normal, pero suma puntos.";
    } else if (pricing.belowMinimum) {
      const missing = pricing.belowMinimum.need - pricing.belowMinimum.have;
      workerNotice = `El descuento aplica desde ${perDay} productos: lleva ${pricing.belowMinimum.have}, le ${missing === 1 ? "falta 1" : `faltan ${missing}`}.`;
    }
  }

  function toggleGift(productId: number) {
    const item = cart.items.find((i) => i.productId === productId);
    cart.setGift(item?.isGift ? null : productId);
  }

  function applyWorker(applied: AppliedWorker, policy: CachedPolicy) {
    setWorker({ applied, policy });
    setPromo(null);
    setRedeem(false);
    toast.success(`${applied.fullName} identificado`, {
      description: "Ahora elige el descuento en la cesta.",
    });
  }

  function selectPromo(next: PromoOption | null) {
    // Only an identified worker gets a discount; the UI shows the list only
    // then, this is the guard.
    if (next && !worker) return;
    setPromo(next);
    if (next) {
      toast.success(`${next.percent}% para ${worker!.applied.fullName}`, {
        description: `En sus primeras ${unitsPerDayOf(worker!.policy)} unidades del día.`,
      });
    }
  }

  function removeWorker() {
    setWorker(null);
    setPromo(null);
    setRedeem(false);
    cart.setGift(null);
  }

  function startCheckout() {
    setCheckoutOpen(true);
    return true;
  }

  // The sidebar lists main categories; a subcategory (Galletas saladas)
  // sells inside its main one (Galletas) and filters it with a chip. A
  // subcategory whose main category is inactive shows as main.
  const mainOf = useMemo(() => {
    const parents = new Map(categories.map((c) => [c.value, c.parentId]));
    return (id: number) => {
      const parentId = parents.get(id) ?? null;
      return parentId !== null && parents.has(parentId) ? parentId : id;
    };
  }, [categories]);
  const mainCategories = useMemo(
    () => categories.filter((c) => mainOf(c.value) === c.value),
    [categories, mainOf],
  );

  // Categories with something sellable on the shop floor (a main category
  // counts its subcategories); the others are still listed (dimmed) so a
  // new category is visible right away.
  const stockedCategoryIds = useMemo(
    () => new Set(products.flatMap((p) => [p.categoryId, mainOf(p.categoryId)])),
    [products, mainOf],
  );

  // Start on the first category that has something to sell.
  const [chosenCategory, setSelectedCategory] = useState<number | null>(
    () =>
      (mainCategories.find((c) => stockedCategoryIds.has(c.value)) ?? mainCategories[0])
        ?.value ?? null,
  );
  // If the chosen category disappears after a catalog refresh (deactivated
  // in the admin panel), fall back to the first one instead of a blank grid.
  const selectedCategory = mainCategories.some((c) => c.value === chosenCategory)
    ? chosenCategory
    : (mainCategories[0]?.value ?? null);
  const subcategories = categories.filter(
    (c) =>
      selectedCategory !== null &&
      c.value !== selectedCategory &&
      mainOf(c.value) === selectedCategory,
  );
  // null = everything in the main category.
  const [chosenSub, setChosenSub] = useState<number | null>(null);
  const selectedSub = subcategories.some((c) => c.value === chosenSub) ? chosenSub : null;

  const query = search.trim().toLowerCase();
  const visibleProducts =
    query.length > 0
      ? products.filter((p) => p.name.toLowerCase().includes(query))
      : products.filter((p) =>
          selectedSub !== null
            ? p.categoryId === selectedSub
            : mainOf(p.categoryId) === selectedCategory,
        );

  async function handleConfirm() {
    const lines = saleLines(cart.items, pricing);
    const sale: PendingSale = {
      id: currentSaleUuid(),
      cashierId,
      shiftUuid: cash.shift?.uuid,
      paymentType,
      items: lines.map((line) => {
        const item = cart.items[line.index];
        return {
          productId: item.productId,
          productName: item.name,
          unitPrice: item.unitPrice,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
          discountUnitAmount: line.discountUnitAmount,
          discountAmount: line.discountAmount,
          isGift: line.isGift,
          captureSource: item.captureSource,
        };
      }),
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      giftTotal: pricing.giftTotal,
      roundingAmount: pricing.rounding,
      total: pricing.total,
      clientCreatedAt: new Date().toISOString(),
      ...(worker && {
        workerId: worker.applied.id,
        workerVerification: "dni_manual",
        policyId: worker.policy.id,
      }),
      ...(pricing.promo && { promoDiscountId: pricing.promo.id }),
      ...(worker && pricing.pointsRedeemed > 0 && { pointsRedeemed: pricing.pointsRedeemed }),
      document: saleDocument,
      status: "pending",
    };
    const workerName = worker?.applied.fullName;
    const points = pricing.pointsEarned;
    const redeemed = pricing.redeemTotal;

    // Always local-first: the checkout never waits on the network.
    await enqueueSale(sale);
    await cash.countSale();
    void runSync();

    cart.clear();
    setCheckoutOpen(false);
    setSaleDocument({ type: "boleta" });
    // The worker belongs to this sale only: the next customer starts clean,
    // with a new sale uuid.
    setWorker(null);
    setPromo(null);
    setRedeem(false);
    saleUuidRef.current = null;
    // Most sales are cash — start the next one from there.
    setPaymentType("cash");
    // One toast (top centre) follows the sale's boleta/factura and prints
    // it when issued; the till stays ready for the next customer.
    watchSaleDocument({
      uuid: sale.id,
      docType: saleDocument.type,
      total: sale.total,
      extra: [
        PAYMENT_TYPE_LABELS[paymentType],
        workerName
          ? `${workerName}${redeemed > 0 ? ` usó sus puntos (−${formatSoles(redeemed)})` : ""}${
              points > 0 ? `${redeemed > 0 ? " y" : ""} ganó ${points} puntos` : ""
            }`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  // Computed on the device: the page may have been cached offline.
  const todayKey = storeDateKey(new Date());

  // The till can't know which lot is in the cashier's hand: when the oldest
  // lot on the shelf is expired, ask to check the package before charging.
  function handleSelect(
    product: Parameters<typeof cart.addItem>[0],
    source: CaptureSource = "manual",
  ) {
    cart.addItem(product, source);
    const expired = shelfExpiry.find(
      (item) => item.productId === product.id && item.expiresAt < todayKey,
    );
    if (expired) {
      toast.warning(`Revisa la fecha de ${product.name}`, {
        id: `expired-${product.id}`,
        description: `Hay unidades que vencieron el ${expired.expiresAt.split("-").reverse().join("/")}. Si el envase está vencido, retíralo y no lo cobres.`,
      });
    }
  }

  const barcodes = useMemo(
    () =>
      buildBarcodeIndex({
        units: products.map((p) => ({ productId: p.id, barcode: p.barcode })),
        presentations: boxCodes,
      }),
    [products, boxCodes],
  );
  const feedback = useScanFlash();

  // The ring reader at the till: a scan adds the unit to the basket. Paused
  // while a dialog (charge, worker) has the cashier's attention.
  const { lastScanAt } = useScanner(
    (code, source) => {
      const target = barcodes.get(code);
      if (target?.kind === "unit") {
        const product = products.find((p) => p.id === target.productId);
        if (product) {
          handleSelect(product, source);
          feedback.ok();
          return;
        }
      }
      feedback.fail();
      if (target?.kind === "presentation") {
        const box = boxCodes.find((b) => b.id === target.presentationId);
        const product = products.find((p) => p.id === target.productId);
        toast.warning(`Ese es el código del ${box?.name ?? "empaque"}`, {
          id: "scan-box",
          description: `En caja se cobra por unidad: escanea ${product ? `la unidad de ${product.name}` : "la unidad"}.`,
        });
        return;
      }
      toast.error("Código no registrado", {
        id: "scan-unknown",
        description: `${code}. Búscalo por nombre y avisa al administrador para que lo registre.`,
      });
    },
    {
      enabled: !checkoutOpen && !workerDialogOpen && !redeemDialogOpen,
    },
  );

  function increaseQty(id: number) {
    cart.setQuantity(
      id,
      (cart.items.find((i) => i.productId === id)?.quantity ?? 0) + 1,
    );
  }

  function decreaseQty(id: number) {
    cart.setQuantity(
      id,
      (cart.items.find((i) => i.productId === id)?.quantity ?? 0) - 1,
    );
  }

  if (cash.loading) return null;
  if (!cash.shift) return <OpenShiftPanel onOpen={cash.open} />;

  return (
    <div className="flex h-[calc(100dvh-57px-var(--app-footer-h))]">
      <ScanFlash flash={feedback.flash} />
      <CategorySidebar
        categories={mainCategories}
        selected={selectedCategory}
        onSelect={(id) => {
          setSelectedCategory(id);
          setChosenSub(null);
        }}
        stockedIds={stockedCategoryIds}
      />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Search on the left; cash actions and status on the right. A plain
            row that wraps on small screens (nothing floats over the search). */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5">
          <SearchBar value={search} onChange={setSearch} />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <ShiftMenu shift={cash.shift} onMove={cash.move} onClose={cash.close} />
            <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />
            <div className="flex items-center gap-1.5">
              <ExpiryReminder items={shelfExpiry} todayKey={todayKey} />
              <CatalogAge generatedAt={catalogAt} />
              <ScannerStatus lastScanAt={lastScanAt} />
              <OfflineIndicator />
              <PosHelp />
            </div>
          </div>
        </div>
        {subcategories.length > 0 && query.length === 0 && (
          <div
            role="group"
            aria-label="Subcategorías"
            className="flex gap-2 overflow-x-auto border-b px-4 py-2"
          >
            {[{ value: null, label: "Todas" }, ...subcategories].map((sub) => (
              <button
                key={sub.value ?? "all"}
                type="button"
                aria-pressed={selectedSub === sub.value}
                onClick={() => setChosenSub(sub.value)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  selectedSub === sub.value
                    ? "border-brand-orange bg-brand-orange text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          {categories.length === 0 ? (
            <EmptyState
              icon={ShoppingBasketIcon}
              title="Aún no hay categorías"
              description="Pide al administrador que cree las categorías y los productos de la tienda."
            />
          ) : products.length === 0 ? (
            <EmptyState
              icon={ShoppingBasketIcon}
              title="Aún no hay productos en la tienda"
              description="Cuando el almacén traslade mercadería a la Tienda, aparecerá aquí lista para vender."
            />
          ) : visibleProducts.length === 0 ? (
            query.length > 0 ? (
              <EmptyState
                icon={SearchIcon}
                title={`Sin resultados para «${search.trim()}»`}
                description="Revisa el nombre o escanea el código del producto."
              />
            ) : (
              <EmptyState
                icon={ShoppingBasketIcon}
                title="Sin productos en tienda en esta categoría"
                description="Cuando el almacén traslade mercadería de esta categoría a la Tienda, aparecerá aquí."
              />
            )
          ) : (
            <ProductGrid
              products={visibleProducts}
              onSelect={handleSelect}
            />
          )}
        </div>
        {cart.items.length > 0 && (
          <Button
            size="lg"
            onClick={() => setMobileCartOpen(true)}
            className="fixed right-4 bottom-4 gap-2 shadow-lg md:hidden"
          >
            <ShoppingCartIcon className="size-4" />
            {cart.items.length} · {formatSoles(pricing.total)}
          </Button>
        )}
      </div>
      <div className="hidden w-80 shrink-0 border-l p-4 md:block">
        <CartPanel
          items={cart.items}
          pricing={pricing}
          worker={worker?.applied ?? null}
          workerNotice={workerNotice}
          onAddWorker={() => {
            setMobileCartOpen(false);
            setWorkerDialogOpen(true);
          }}
          onRemoveWorker={removeWorker}
          paymentType={paymentType}
          onPaymentTypeChange={setPaymentType}
          onIncrease={increaseQty}
          onDecrease={decreaseQty}
          onRemove={cart.removeItem}
          gift={worker && giftAvailable ? { maxAmount: worker.policy.birthdayGiftMaxAmount } : null}
          onToggleGift={toggleGift}
          promoOptions={promoDiscounts}
          promo={promo}
          onSelectPromo={selectPromo}
          discountUnits={worker?.policy.maxDiscountedUnitsPerSale ?? 0}
          discountBlocked={discount?.limitReached === "daily"}
          points={workerPoints}
          onRedeem={() => {
            setMobileCartOpen(false);
            setRedeemDialogOpen(true);
          }}
          onCancelRedeem={() => setRedeem(false)}
          onCheckout={startCheckout}
        />
      </div>
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBasketIcon className="size-5 text-brand-blue" aria-hidden />
              Cesta
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden px-4 pb-4">
            <CartPanel
              items={cart.items}
              pricing={pricing}
              worker={worker?.applied ?? null}
              workerNotice={workerNotice}
              onAddWorker={() => {
                setMobileCartOpen(false);
                setWorkerDialogOpen(true);
              }}
              onRemoveWorker={removeWorker}
              paymentType={paymentType}
              onPaymentTypeChange={setPaymentType}
              showTitle={false}
              onIncrease={increaseQty}
              onDecrease={decreaseQty}
              onRemove={cart.removeItem}
              gift={worker && giftAvailable ? { maxAmount: worker.policy.birthdayGiftMaxAmount } : null}
              onToggleGift={toggleGift}
              promoOptions={promoDiscounts}
              promo={promo}
              onSelectPromo={selectPromo}
              discountUnits={worker?.policy.maxDiscountedUnitsPerSale ?? 0}
              discountBlocked={discount?.limitReached === "daily"}
              points={workerPoints}
              onRedeem={() => {
                setMobileCartOpen(false);
                setRedeemDialogOpen(true);
              }}
              onCancelRedeem={() => setRedeem(false)}
              onCheckout={() => {
                setMobileCartOpen(false);
                startCheckout();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
      <CheckoutDialog
        open={checkoutOpen}
        pricing={pricing}
        items={cart.items}
        workerName={worker?.applied.fullName ?? null}
        promoName={pricing.promo ? (promo?.name ?? null) : null}
        paymentType={paymentType}
        document={saleDocument}
        onDocumentChange={setSaleDocument}
        onOpenChange={setCheckoutOpen}
        onConfirm={handleConfirm}
      />
      {worker && (
        // Keyed by worker: wrong attempts don't carry over to another one.
        <RedeemPointsDialog
          key={worker.applied.id}
          open={redeemDialogOpen}
          onOpenChange={setRedeemDialogOpen}
          workerName={worker.applied.fullName}
          birthDate={worker.applied.birthDate}
          points={workerPoints?.redeemablePoints ?? 0}
          soles={redeemableSoles}
          onConfirm={() => setRedeem(true)}
        />
      )}
      <WorkerDiscountDialog
        open={workerDialogOpen}
        onOpenChange={setWorkerDialogOpen}
        onApplied={applyWorker}
      />
    </div>
  );
}
