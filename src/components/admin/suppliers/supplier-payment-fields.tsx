"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MAX_BANK_ACCOUNTS,
  PERU_BANKS,
  type Supplier,
} from "@/domain/entities/supplier";

export type BankAccountLine = {
  key: string;
  bank: string;
  accountNumber: string;
  cci: string;
};

// The "Medios de pago" answers, as the form holds them (text inputs).
export type PaymentValue = {
  acceptsYapePlin: boolean;
  yapePlinPhone: string;
  givesCredit: boolean;
  creditDays: string;
  hasBankAccounts: boolean;
  bankAccounts: BankAccountLine[];
};

const newAccount = (): BankAccountLine => ({
  key: crypto.randomUUID(),
  bank: "",
  accountNumber: "",
  cci: "",
});

export function paymentFrom(supplier?: Supplier): PaymentValue {
  const accounts = supplier?.bankAccounts ?? [];
  return {
    acceptsYapePlin: supplier?.acceptsYapePlin ?? false,
    yapePlinPhone: supplier?.yapePlinPhone ?? "",
    givesCredit: supplier?.givesCredit ?? false,
    creditDays: supplier?.creditDays ? String(supplier.creditDays) : "",
    hasBankAccounts: accounts.length > 0,
    // Keys are only for React: the draft fingerprint ignores them.
    bankAccounts: accounts.map((account, i) => ({
      key: `saved-${i}`,
      bank: account.bank,
      accountNumber: account.accountNumber,
      cci: account.cci ?? "",
    })),
  };
}

// What the server action receives.
export function paymentInput(value: PaymentValue) {
  return {
    acceptsYapePlin: value.acceptsYapePlin,
    yapePlinPhone: value.yapePlinPhone,
    givesCredit: value.givesCredit,
    creditDays: value.creditDays,
    hasBankAccounts: value.hasBankAccounts,
    bankAccounts: value.bankAccounts.map(({ bank, accountNumber, cci }) => ({
      bank,
      accountNumber,
      cci,
    })),
  };
}

const PRESSED =
  "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

function YesNo({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Label id={id}>{label}</Label>
      <ToggleGroup
        aria-labelledby={id}
        value={[value ? "yes" : "no"]}
        onValueChange={(next) => {
          const [choice] = next as string[];
          if (choice) onChange(choice === "yes");
        }}
        variant="outline"
        spacing={1}
        className="grid w-32 grid-cols-2"
      >
        <ToggleGroupItem value="yes" className={PRESSED}>
          Sí
        </ToggleGroupItem>
        <ToggleGroupItem value="no" className={PRESSED}>
          No
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export function SupplierPaymentFields({
  value,
  onChange,
  vendorPhone,
}: {
  value: PaymentValue;
  onChange: (value: PaymentValue) => void;
  // Prefills the Yape/Plin number: it is usually the salesperson's phone.
  vendorPhone: string;
}) {
  const set = (patch: Partial<PaymentValue>) => onChange({ ...value, ...patch });

  function updateAccount(key: string, patch: Partial<BankAccountLine>) {
    set({
      bankAccounts: value.bankAccounts.map((account) =>
        account.key === key ? { ...account, ...patch } : account,
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <YesNo
          id="supplier-yape-label"
          label="¿Acepta Yape/Plin?"
          value={value.acceptsYapePlin}
          onChange={(accepts) =>
            set({
              acceptsYapePlin: accepts,
              yapePlinPhone:
                accepts && !value.yapePlinPhone.trim()
                  ? vendorPhone.trim()
                  : value.yapePlinPhone,
            })
          }
        />
        {value.acceptsYapePlin && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier-yape-phone" required>
              Número de Yape/Plin
            </Label>
            <Input
              id="supplier-yape-phone"
              type="tel"
              inputMode="tel"
              placeholder="987 654 321"
              maxLength={15}
              value={value.yapePlinPhone}
              onChange={(e) => set({ yapePlinPhone: e.target.value })}
              required
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <YesNo
          id="supplier-accounts-label"
          label="¿Tiene cuentas bancarias?"
          value={value.hasBankAccounts}
          onChange={(has) =>
            set({
              hasBankAccounts: has,
              bankAccounts:
                has && value.bankAccounts.length === 0
                  ? [newAccount()]
                  : value.bankAccounts,
            })
          }
        />
        {value.hasBankAccounts && (
          <div className="flex flex-col gap-2">
            <datalist id="supplier-banks">
              {PERU_BANKS.map((bank) => (
                <option key={bank} value={bank} />
              ))}
            </datalist>
            {value.bankAccounts.map((account, index) => (
              <div
                key={account.key}
                className="grid gap-2 rounded-lg border bg-muted/30 p-2 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end"
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`bank-${account.key}`} required className="text-xs">
                    Banco
                  </Label>
                  <Input
                    id={`bank-${account.key}`}
                    list="supplier-banks"
                    placeholder="Ej. BCP"
                    maxLength={40}
                    value={account.bank}
                    onChange={(e) => updateAccount(account.key, { bank: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor={`account-${account.key}`}
                    required
                    className="text-xs"
                  >
                    N.° de cuenta
                  </Label>
                  <Input
                    id={`account-${account.key}`}
                    inputMode="numeric"
                    placeholder="191-1234567-0-12"
                    maxLength={30}
                    value={account.accountNumber}
                    onChange={(e) =>
                      updateAccount(account.key, { accountNumber: e.target.value })
                    }
                    className="font-mono"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`cci-${account.key}`} optional className="text-xs">
                    CCI
                  </Label>
                  <Input
                    id={`cci-${account.key}`}
                    inputMode="numeric"
                    placeholder="20 dígitos"
                    maxLength={30}
                    value={account.cci}
                    onChange={(e) => updateAccount(account.key, { cci: e.target.value })}
                    className="font-mono"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar cuenta ${index + 1}`}
                  title="Quitar cuenta"
                  onClick={() => {
                    const rest = value.bankAccounts.filter((a) => a.key !== account.key);
                    // Removing the last one means "no tiene cuentas".
                    set({ bankAccounts: rest, hasBankAccounts: rest.length > 0 });
                  }}
                  className="justify-self-end"
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            {value.bankAccounts.length < MAX_BANK_ACCOUNTS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => set({ bankAccounts: [...value.bankAccounts, newAccount()] })}
              >
                <PlusIcon />
                Agregar cuenta
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <YesNo
          id="supplier-credit-label"
          label="¿Da crédito?"
          value={value.givesCredit}
          onChange={(gives) => set({ givesCredit: gives })}
        />
        {value.givesCredit && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier-credit-days" required>
              Días de crédito
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="supplier-credit-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={180}
                step={1}
                placeholder="Ej. 15"
                value={value.creditDays}
                onChange={(e) => set({ creditDays: e.target.value })}
                className="w-24"
                required
              />
              <span className="text-sm text-muted-foreground">días para pagar</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
