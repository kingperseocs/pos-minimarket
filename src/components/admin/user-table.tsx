"use client";

import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { setUserActive } from "@/actions/users";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { USER_ROLE_LABELS, type UserRole } from "@/domain/entities/user";
import { initials } from "@/lib/initials";
import { DataTable, ID_COLUMN, IdCell } from "./data-table";
import { DataTablePagination } from "./data-table-pagination";
import { RowActions } from "./row-actions";
import { StatusBadge } from "./status-badge";

type User = {
  id: number;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
};

const COLUMNS = [
  ID_COLUMN,
  { label: "Usuario" },
  { label: "Rol" },
  { label: "Estado" },
  { label: "Acciones", className: "text-right" },
];

export function UserTable({ users }: { users: User[] }) {
  const [isPending, startTransition] = useTransition();
  const pagination = usePagination(users);

  function handleToggle(user: User) {
    startTransition(async () => {
      try {
        await setUserActive(user.id, !user.isActive);
        toast.success(user.isActive ? "Usuario desactivado" : "Usuario activado");
      } catch {
        toast.error("No se pudo actualizar el usuario");
      }
    });
  }

  return (
    <DataTable
      columns={COLUMNS}
      isEmpty={users.length === 0}
      emptyMessage="Aún no hay usuarios registrados."
      footer={
        <DataTablePagination
          {...pagination}
          onPageChange={pagination.setPage}
          itemLabel="usuarios"
        />
      }
    >
      {pagination.rows.map((user) => (
        <TableRow key={user.id}>
          <IdCell id={user.id} />
          <TableCell>
            <div className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  @{user.username}
                </div>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant={user.role === "admin" ? "secondary" : "outline"}>
              {USER_ROLE_LABELS[user.role as UserRole] ?? user.role}
            </Badge>
          </TableCell>
          <TableCell>
            <StatusBadge active={user.isActive} />
          </TableCell>
          <TableCell>
            <RowActions label={user.name} disabled={isPending}>
              {user.isActive ? (
                <DropdownMenuItem variant="destructive" onClick={() => handleToggle(user)}>
                  <Trash2Icon />
                  Desactivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleToggle(user)}>
                  <RotateCcwIcon />
                  Activar
                </DropdownMenuItem>
              )}
            </RowActions>
          </TableCell>
        </TableRow>
      ))}
    </DataTable>
  );
}
