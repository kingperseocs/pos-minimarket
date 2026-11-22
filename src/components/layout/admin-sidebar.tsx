"use client";

import {
  CalendarClockIcon,
  IdCardIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PercentIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  StoreIcon,
  TagsIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
  FileCheck2Icon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { initials } from "@/lib/initials";
import { AREAS } from "./area-links";
import { LogoutButton } from "./logout-button";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/sales", label: "Ventas", icon: ReceiptTextIcon },
  { href: "/admin/comprobantes", label: "Comprobantes", icon: FileCheck2Icon },
  { href: "/admin/caja", label: "Cierres de caja", icon: WalletIcon },
  { href: "/admin/categories", label: "Categorías", icon: TagsIcon },
  { href: "/admin/products", label: "Productos", icon: PackageIcon },
  { href: "/admin/descuentos", label: "Descuentos", icon: PercentIcon },
  { href: "/admin/inventory", label: "Inventario", icon: WarehouseIcon },
  { href: "/admin/suppliers", label: "Proveedores", icon: TruckIcon },
  { href: "/admin/users", label: "Usuarios", icon: UsersIcon },
  {
    href: "/admin/workers",
    label: "Aeropuerto",
    icon: IdCardIcon,
  },
  { href: "/admin/asistencia", label: "Asistencia", icon: CalendarClockIcon },
  { href: "/admin/audit", label: "Auditoría", icon: ShieldCheckIcon },
];

export function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  // "/admin" must match exactly, otherwise it would stay highlighted on
  // every nested admin route.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon">
      {/* Same height as the page header (h-14), so their bottom lines meet. */}
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border py-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/admin" />}
              tooltip="Naveguz · Administración"
              className="h-11"
            >
              {/* The store's logo (the one on its receipts); collapsed, an icon. */}
              <Image
                src="/naveguz.png"
                alt="Naveguz"
                width={1157}
                height={314}
                priority
                className="h-8 w-auto group-data-[collapsible=icon]:hidden"
              />
              <div className="hidden aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:flex">
                <StoreIcon className="size-4" />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                      className="relative h-9 transition-[width,height,padding,background-color,color] duration-150 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary before:opacity-0 before:transition-opacity data-active:text-sidebar-primary data-active:before:opacity-100 group-data-[collapsible=icon]:before:hidden [&>svg]:transition-transform hover:[&>svg]:translate-x-0.5"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Ir a</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {AREAS.filter((area) => area.permission !== "manage").map(
                (area) => (
                  <SidebarMenuItem key={area.href}>
                    <SidebarMenuButton
                      tooltip={area.label}
                      render={<Link href={area.href} />}
                      className="h-9"
                    >
                      <area.icon />
                      <span>{area.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="mx-0" />
        <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
          <Avatar size="sm">
            <AvatarFallback>{initials(userName)}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{userName}</span>
            <span className="truncate text-xs text-muted-foreground">
              Administrador
            </span>
          </div>
          <LogoutButton />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
