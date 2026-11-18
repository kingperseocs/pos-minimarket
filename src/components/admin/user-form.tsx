"use client";

import { PlusIcon, UserPlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createUser } from "@/actions/users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FORM_DIALOG_CONTENT,
  FormDialogBody,
  FormDialogFooter,
  RequiredLegend,
  FormDialogHeader,
  toastCleared,
} from "./form-dialog";
import { useFormDraft } from "@/hooks/use-form-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  USER_ROLE_DESCRIPTIONS,
  USER_ROLE_LABELS,
  USER_ROLES,
  type UserRole,
} from "@/domain/entities/user";

export function UserForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("cashier");

  // The password is never part of the draft: it must not sit in the browser.
  type FormState = { name: string; username: string; role: UserRole };
  const EMPTY: FormState = { name: "", username: "", role: "cashier" };
  const draft = useFormDraft<FormState>({
    key: "user:new",
    values: { name, username, role },
    baseline: EMPTY,
    enabled: open,
  });

  function applyForm(next: FormState) {
    setName(next.name ?? "");
    setUsername(next.username ?? "");
    setRole(USER_ROLES.includes(next.role) ? next.role : "cashier");
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      applyForm(draft.restore() ?? EMPTY);
      setPassword("");
    }
    setOpen(next);
  }

  function handleClear() {
    const before = { name, username, role };
    applyForm(EMPTY);
    setPassword("");
    draft.clear();
    toastCleared(() => applyForm(before));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      try {
        await createUser({ name, username, password, role });
        toast.success("Usuario creado");
        draft.clear();
        applyForm(EMPTY);
        setPassword("");
        setOpen(false);
      } catch {
        toast.error("No se pudo crear el usuario");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} disablePointerDismissal>
      <DialogTrigger
        render={
          <Button>
            <PlusIcon data-icon="inline-start" />
            Nuevo usuario
          </Button>
        }
      />
      <DialogContent className={cn(FORM_DIALOG_CONTENT, "sm:max-w-md")}>
        <FormDialogHeader
          icon={UserPlusIcon}
          title={"Nuevo usuario"}
          description="Acceso al sistema con usuario y contraseña."
        />
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <RequiredLegend />
            <div className="flex flex-col gap-2">
              <Label htmlFor="name" required>Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="username" required>Usuario</Label>
              <Input
                id="username"
                placeholder="Ej. Ori2026"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password" required>Contraseña</Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role" required>Rol</Label>
              <Select
                value={role}
                onValueChange={(v) => v && setRole(v as UserRole)}
                items={USER_ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }))}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {USER_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {USER_ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          </FormDialogBody>
          <FormDialogFooter
            onClear={handleClear}
            clearDisabled={isPending}
            draftStatus={draft.status}
          >
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={isPending}
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creando..." : "Crear"}
            </Button>
          </FormDialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
