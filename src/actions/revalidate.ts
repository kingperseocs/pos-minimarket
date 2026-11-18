import { revalidatePath } from "next/cache";

// Categories, products and suppliers feed almost every screen: admin lists,
// product/supplier forms, inventory, the dashboard's setup
// steps, the warehouse and the POS sidebar. Revalidating whole layouts keeps
// all of them in sync instead of listing (and forgetting) single pages.
export function revalidateCatalogViews() {
  revalidatePath("/admin", "layout");
  revalidatePath("/almacen", "layout");
  revalidatePath("/pos");
}
