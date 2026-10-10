import { CategoryManager } from "@/components/admin/catalog/category-manager";
import { PageHeader } from "@/components/ui/page-header";
import { loadAdminCategories } from "@/lib/api/admin-catalog";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await loadAdminCategories();
  return (
    <>
      <PageHeader title="Categories" description="How the store is organised: the menu, category pages and search filters. Each product sits in one category and one of its subcategories." />
      <CategoryManager categories={categories} />
    </>
  );
}
