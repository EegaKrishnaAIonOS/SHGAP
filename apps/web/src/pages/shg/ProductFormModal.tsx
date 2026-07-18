import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { ProductImageCapture } from "../../components/ProductImageCapture";
import { suggestCategories } from "../../lib/api/categorization";
import { createProduct, updateProduct } from "../../lib/api/products";
import { ApiError } from "../../lib/api/httpClient";
import type { Category, CategorySuggestion, Product } from "../../lib/api/types";

// Wait for the SHG member to stop typing before asking ml-services for
// category suggestions (T08) — avoids firing a request on every keystroke.
const CATEGORY_SUGGESTION_DEBOUNCE_MS = 600;
const CATEGORY_SUGGESTION_MIN_NAME_LENGTH = 3;

export interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  shgId: string;
  categories: Category[];
  /** Pass a product to edit it; omit/null to create a new one. */
  product: Product | null;
  onSaved: (product: Product) => void;
}

interface FieldErrors {
  parentCategoryId?: string;
  categoryId?: string;
  name?: string;
  unit?: string;
  price?: string;
  moq?: string;
  stock?: string;
}

function findParentCategoryId(categories: Category[], categoryId: string | undefined): string {
  if (!categoryId) return "";
  const parent = categories.find((c) => c.children?.some((child) => child.id === categoryId));
  return parent?.id ?? "";
}

export function ProductFormModal({
  open,
  onClose,
  shgId,
  categories,
  product,
  onSaved,
}: ProductFormModalProps) {
  const { t } = useTranslation();

  const [savedProduct, setSavedProduct] = useState<Product | null>(product);
  const [images, setImages] = useState(product?.images ?? []);
  const [parentCategoryId, setParentCategoryId] = useState(() =>
    findParentCategoryId(categories, product?.categoryId),
  );
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [moq, setMoq] = useState(product ? String(product.moq) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  // Reset the form whenever the modal is (re)opened for a different product (or a fresh "add").
  useEffect(() => {
    if (!open) return;
    setSavedProduct(product);
    setImages(product?.images ?? []);
    setParentCategoryId(findParentCategoryId(categories, product?.categoryId));
    setCategoryId(product?.categoryId ?? "");
    setName(product?.name ?? "");
    setDescription(product?.description ?? "");
    setUnit(product?.unit ?? "");
    setPrice(product ? String(product.price) : "");
    setMoq(product ? String(product.moq) : "");
    setStock(product ? String(product.stock) : "");
    setIsAvailable(product?.isAvailable ?? true);
    setErrors({});
    setNotice(null);
    setSubmitError(null);
    setCategorySuggestions([]);
    setSuggestionsDismissed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  // Best-effort category suggestions (T08) — only while the SHG member
  // hasn't chosen a category yet, so this never fights with a human
  // decision (theirs or a suggestion they've already applied/dismissed).
  useEffect(() => {
    if (!open || categoryId || suggestionsDismissed) {
      setCategorySuggestions([]);
      return;
    }
    if (name.trim().length < CATEGORY_SUGGESTION_MIN_NAME_LENGTH) {
      setCategorySuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setSuggestionsLoading(true);
      suggestCategories(name.trim(), description.trim() || undefined)
        .then((result) => {
          if (!cancelled) setCategorySuggestions(result);
        })
        .catch(() => {
          if (!cancelled) setCategorySuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSuggestionsLoading(false);
        });
    }, CATEGORY_SUGGESTION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, name, description, categoryId, suggestionsDismissed]);

  function applySuggestion(suggestion: CategorySuggestion) {
    setParentCategoryId(findParentCategoryId(categories, suggestion.categoryId));
    setCategoryId(suggestion.categoryId);
    setCategorySuggestions([]);
  }

  const parentOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );
  const childOptions = useMemo(() => {
    const parent = categories.find((c) => c.id === parentCategoryId);
    return (parent?.children ?? []).map((c) => ({ value: c.id, label: c.name }));
  }, [categories, parentCategoryId]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!parentCategoryId) next.parentCategoryId = t("catalogue.form.errors.categoryRequired");
    if (!categoryId) next.categoryId = t("catalogue.form.errors.categoryRequired");
    if (!name.trim()) next.name = t("catalogue.form.errors.nameRequired");
    if (!unit.trim()) next.unit = t("catalogue.form.errors.unitRequired");
    const priceNum = Number(price);
    if (!price || Number.isNaN(priceNum) || priceNum <= 0) {
      next.price = t("catalogue.form.errors.priceInvalid");
    }
    if (moq) {
      const moqNum = Number(moq);
      if (!Number.isInteger(moqNum) || moqNum < 1) next.moq = t("catalogue.form.errors.moqInvalid");
    }
    if (stock) {
      const stockNum = Number(stock);
      if (!Number.isInteger(stockNum) || stockNum < 0)
        next.stock = t("catalogue.form.errors.stockInvalid");
    }
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    setNotice(null);

    const payload = {
      categoryId,
      name: name.trim(),
      description: description.trim() || undefined,
      unit: unit.trim(),
      price: Number(price),
      moq: moq ? Number(moq) : undefined,
      stock: stock ? Number(stock) : undefined,
      isAvailable,
    };

    try {
      if (savedProduct) {
        const result = await updateProduct(savedProduct.id, payload);
        if (result.status === "ok") {
          setSavedProduct(result.data);
          setImages(result.data.images);
          onSaved(result.data);
        } else {
          setNotice(t("catalogue.form.queuedOffline"));
        }
      } else {
        const result = await createProduct({ shgId, ...payload });
        if (result.status === "ok") {
          setSavedProduct(result.data);
          setImages(result.data.images);
          onSaved(result.data);
        } else {
          setNotice(t("catalogue.form.queuedOfflineNoPhotos"));
        }
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : t("catalogue.form.errors.submitFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={savedProduct ? t("catalogue.form.editTitle") : t("catalogue.form.addTitle")}
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <Select
          label={t("catalogue.form.categoryGroup")}
          options={parentOptions}
          placeholder={t("catalogue.form.categoryGroupPlaceholder")}
          fieldSize="touch"
          value={parentCategoryId}
          onChange={(e) => {
            setParentCategoryId(e.target.value);
            setCategoryId("");
          }}
          error={errors.parentCategoryId}
          required
        />
        <Select
          label={t("catalogue.form.category")}
          options={childOptions}
          placeholder={
            parentCategoryId
              ? t("catalogue.form.categoryPlaceholder")
              : t("catalogue.form.categoryGroupFirst")
          }
          fieldSize="touch"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          error={errors.categoryId}
          disabled={!parentCategoryId}
          required
        />
        {(suggestionsLoading || categorySuggestions.length > 0) && (
          <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
            <p className="mb-2">{t("catalogue.form.categorySuggestion")}</p>
            {suggestionsLoading ? (
              <p className="text-neutral-500">{t("common.loading")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {categorySuggestions.map((suggestion) => (
                    <Button
                      key={suggestion.categoryId}
                      type="button"
                      size="sm"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      {suggestion.parentCategoryName
                        ? `${suggestion.categoryName} (${suggestion.parentCategoryName})`
                        : suggestion.categoryName}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSuggestionsDismissed(true)}
                >
                  {t("catalogue.form.categorySuggestionDismiss")}
                </Button>
              </div>
            )}
          </div>
        )}
        <Input
          label={t("catalogue.form.name")}
          fieldSize="touch"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          label={t("catalogue.form.description")}
          fieldSize="touch"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("catalogue.form.unit")}
            hint={t("catalogue.form.unitHint")}
            fieldSize="touch"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            error={errors.unit}
            required
          />
          <Input
            label={t("catalogue.price")}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            fieldSize="touch"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.price}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("catalogue.form.moq")}
            type="number"
            min={1}
            inputMode="numeric"
            fieldSize="touch"
            value={moq}
            onChange={(e) => setMoq(e.target.value)}
            error={errors.moq}
          />
          <Input
            label={t("catalogue.form.stock")}
            type="number"
            min={0}
            inputMode="numeric"
            fieldSize="touch"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            error={errors.stock}
          />
        </div>
        <label className="flex min-h-touch items-center gap-3 text-base font-medium text-neutral-800">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
            className="h-5 w-5 rounded border-neutral-300"
          />
          {t("catalogue.form.isAvailable")}
        </label>

        {submitError && (
          <p role="alert" className="text-sm text-danger-500">
            {submitError}
          </p>
        )}
        {notice && <p className="text-sm text-warning-700">{notice}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="outline" size="touch" fullWidth onClick={onClose}>
            {savedProduct ? t("common.close") : t("common.cancel")}
          </Button>
          <Button type="submit" size="touch" fullWidth isLoading={submitting}>
            {t("common.save")}
          </Button>
        </div>
      </form>

      {savedProduct && (
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <ProductImageCapture
            productId={savedProduct.id}
            images={images}
            onImagesChange={(imgs) => {
              setImages(imgs);
              onSaved({ ...savedProduct, images: imgs });
            }}
          />
        </div>
      )}
    </Modal>
  );
}
