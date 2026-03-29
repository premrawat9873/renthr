import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Search } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@/data/mockData";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { selectLocation } from "@/store/slices/marketplaceSlice";

type PostStep = "category" | "details" | "photos" | "purpose";
type AgeUnit = "days" | "months" | "years";
type ListingPurpose = "sell" | "rent";
type RentDurationOption = "hourly" | "daily" | "weekly" | "monthly";

interface PostListingFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadImagesResponse = {
  images?: string[];
  error?: string;
};

type CreateListingResponse = {
  id?: string;
  error?: string;
};

const MAX_CATEGORY_SELECTION = 2;
const MAX_PHOTO_UPLOADS = 3;
const AGE_UNITS: Array<{ value: AgeUnit; label: string }> = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];
const PURPOSE_OPTIONS: Array<{ value: ListingPurpose; label: string; description: string }> = [
  {
    value: "rent",
    label: "Rent",
    description: "List for hourly, daily, weekly, or monthly rental",
  },
  {
    value: "sell",
    label: "Sell",
    description: "List for one-time purchase",
  },
];
const RENT_DURATION_OPTIONS: Array<{ value: RentDurationOption; label: string }> = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const INITIAL_RENT_PRICES: Record<RentDurationOption, string> = {
  hourly: "",
  daily: "",
  weekly: "",
  monthly: "",
};
const FIELD_BORDER_CLASS =
  "border-primary/40 focus-visible:border-primary/70 focus-visible:ring-primary/20";
const ACTION_BUTTON_BORDER_CLASS =
  "border border-primary/45 disabled:opacity-100 disabled:border-primary/45";

export default function PostListingFlowDialog({ open, onOpenChange }: PostListingFlowDialogProps) {
  const selectedLocation = useAppSelector(selectLocation);
  const [step, setStep] = useState<PostStep>("category");
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ageValue, setAgeValue] = useState("");
  const [ageUnit, setAgeUnit] = useState<AgeUnit>("months");
  const [selectedPurposes, setSelectedPurposes] = useState<ListingPurpose[]>([]);
  const [selectedRentDurations, setSelectedRentDurations] = useState<RentDurationOption[]>([]);
  const [rentPrices, setRentPrices] = useState<Record<RentDurationOption, string>>(INITIAL_RENT_PRICES);
  const [sellPrice, setSellPrice] = useState("");
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCategories = useMemo(
    () => CATEGORIES.filter((category) => selectedCategoryIds.includes(category.id)),
    [selectedCategoryIds],
  );

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return CATEGORIES;

    return CATEGORIES.filter((category) => category.label.toLowerCase().includes(query));
  }, [categorySearch]);

  const selectedRentDurationOptions = useMemo(
    () => RENT_DURATION_OPTIONS.filter((option) => selectedRentDurations.includes(option.value)),
    [selectedRentDurations],
  );

  const photoPreviews = useMemo(
    () => selectedPhotoFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    [selectedPhotoFiles],
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => {
        URL.revokeObjectURL(preview.previewUrl);
      });
    };
  }, [photoPreviews]);

  const reachedCategoryLimit = selectedCategoryIds.length >= MAX_CATEGORY_SELECTION;
  const normalizedAge = Number(ageValue);
  const hasValidAge = ageValue.trim() !== "" && Number.isFinite(normalizedAge) && normalizedAge >= 0;
  const hasValidDetails =
    name.trim().length >= 3 &&
    description.trim().length >= 10 &&
    hasValidAge;
  const isSellSelected = selectedPurposes.includes("sell");
  const isRentSelected = selectedPurposes.includes("rent");
  const hasPurposeSelection = selectedPurposes.length > 0;
  const normalizedSellPrice = Number(sellPrice);
  const hasValidSellPrice =
    !isSellSelected ||
    (sellPrice.trim() !== "" && Number.isFinite(normalizedSellPrice) && normalizedSellPrice >= 0);
  const hasRentDurationSelection = !isRentSelected || selectedRentDurations.length > 0;
  const hasValidRentPrices =
    !isRentSelected ||
    selectedRentDurations.every((duration) => {
      const rawValue = rentPrices[duration];
      const parsedValue = Number(rawValue);
      return rawValue.trim() !== "" && Number.isFinite(parsedValue) && parsedValue >= 0;
    });
  const hasPhotoSelection = selectedPhotoFiles.length > 0;
  const canSubmit =
    selectedCategoryIds.length > 0 &&
    hasValidDetails &&
    hasPhotoSelection &&
    hasPurposeSelection &&
    hasValidSellPrice &&
    hasRentDurationSelection &&
    hasValidRentPrices;

  const resetFlow = () => {
    setStep("category");
    setCategorySearch("");
    setSelectedCategoryIds([]);
    setName("");
    setDescription("");
    setAgeValue("");
    setAgeUnit("months");
    setSelectedPurposes([]);
    setSelectedRentDurations([]);
    setRentPrices(INITIAL_RENT_PRICES);
    setSellPrice("");
    setSelectedPhotoFiles([]);
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) {
      return;
    }

    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetFlow();
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((current) => {
      if (current.includes(categoryId)) {
        return current.filter((id) => id !== categoryId);
      }

      if (current.length >= MAX_CATEGORY_SELECTION) {
        return current;
      }

      return [...current, categoryId];
    });
  };

  const goToDetails = () => {
    if (selectedCategoryIds.length === 0) return;
    setStep("details");
  };

  const goToPhotos = () => {
    if (!hasValidDetails) return;
    setStep("photos");
  };

  const goToPurpose = () => {
    if (!hasPhotoSelection) return;
    setStep("purpose");
  };

  const handlePhotosSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files ?? []);
    if (incomingFiles.length === 0) {
      event.currentTarget.value = "";
      return;
    }

    setSelectedPhotoFiles((current) => {
      const slotsRemaining = MAX_PHOTO_UPLOADS - current.length;
      if (slotsRemaining <= 0) {
        toast({
          title: "Upload limit reached",
          description: `You can upload at most ${MAX_PHOTO_UPLOADS} photos.`,
          variant: "destructive",
        });
        return current;
      }

      if (incomingFiles.length > slotsRemaining) {
        toast({
          title: "Only 3 photos allowed",
          description: `Added ${slotsRemaining} photo${slotsRemaining > 1 ? "s" : ""}. Remove one to add more.`,
          variant: "destructive",
        });
      }

      return [...current, ...incomingFiles.slice(0, slotsRemaining)];
    });

    event.currentTarget.value = "";
  };

  const removePhoto = (indexToRemove: number) => {
    setSelectedPhotoFiles((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const togglePurpose = (purpose: ListingPurpose) => {
    setSelectedPurposes((current) => {
      if (current.includes(purpose)) {
        if (purpose === "rent") {
          setSelectedRentDurations([]);
          setRentPrices(INITIAL_RENT_PRICES);
        }

        if (purpose === "sell") {
          setSellPrice("");
        }

        return current.filter((value) => value !== purpose);
      }

      return [...current, purpose];
    });
  };

  const toggleRentDuration = (duration: RentDurationOption) => {
    setSelectedRentDurations((current) => {
      if (current.includes(duration)) {
        setRentPrices((prices) => ({
          ...prices,
          [duration]: "",
        }));
        return current.filter((value) => value !== duration);
      }

      return [...current, duration];
    });
  };

  const updateRentPrice = (duration: RentDurationOption, value: string) => {
    setRentPrices((current) => ({
      ...current,
      [duration]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const uploadFormData = new FormData();
      selectedPhotoFiles.forEach((file) => {
        uploadFormData.append("images", file);
      });

      const uploadResponse = await fetch("/api/images/upload", {
        method: "POST",
        body: uploadFormData,
      });

      const uploadPayload = (await uploadResponse.json().catch(() => null)) as UploadImagesResponse | null;
      if (!uploadResponse.ok || !uploadPayload || !Array.isArray(uploadPayload.images)) {
        throw new Error(
          typeof uploadPayload?.error === "string"
            ? uploadPayload.error
            : "Image upload failed. Please try again."
        );
      }

      const selectedRentPricePayload = selectedRentDurations.reduce(
        (accumulator, duration) => {
          accumulator[duration] = rentPrices[duration];
          return accumulator;
        },
        {} as Partial<Record<RentDurationOption, string>>
      );

      const saveListingResponse = await fetch("/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: name.trim(),
          description: description.trim(),
          categoryIds: selectedCategoryIds,
          ageValue,
          ageUnit,
          purposes: selectedPurposes,
          sellPrice,
          rentPrices: selectedRentPricePayload,
          imageUrls: uploadPayload.images,
          location: selectedLocation ?? "Bangalore",
        }),
      });

      const saveListingPayload = (await saveListingResponse
        .json()
        .catch(() => null)) as CreateListingResponse | null;
      if (!saveListingResponse.ok || !saveListingPayload?.id) {
        throw new Error(
          typeof saveListingPayload?.error === "string"
            ? saveListingPayload.error
            : "Listing could not be saved."
        );
      }

      const selectedLabels = selectedCategories.map((category) => category.label).join(", ");
      const selectedPurposeLabels = PURPOSE_OPTIONS
        .filter((option) => selectedPurposes.includes(option.value))
        .map((option) => option.label)
        .join(" + ");
      const selectedRentSummary = selectedRentDurationOptions
        .map((option) => `${option.label}: INR ${rentPrices[option.value]}`)
        .join(", ");

      toast({
        title: "Listing saved",
        description:
          `${name.trim()} in ${selectedLabels}. Purpose: ${selectedPurposeLabels}. ` +
          `${isSellSelected ? `Sell price INR ${sellPrice}. ` : ""}` +
          `${isRentSelected ? `Rent: ${selectedRentSummary}. ` : ""}` +
          `Condition age: ${ageValue} ${ageUnit} old. Uploaded ${uploadPayload.images.length} photo${uploadPayload.images.length > 1 ? "s" : ""} to Cloudflare R2. Listing ID: ${saveListingPayload.id}.`,
      });

      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Listing save failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to save this listing right now. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden border-primary/20 p-0 sm:rounded-2xl">
        <div className="border-b border-primary/10 bg-gradient-to-br from-accent via-background to-accent/60 p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="font-heading text-xl text-foreground">
              Post a new listing
            </DialogTitle>
            <DialogDescription>
              Visual flow: select categories, add product details, upload photos, then choose rent/sell purpose.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
            <FlowStepCard
              active={step === "category"}
              complete={step !== "category"}
              stepNumber={1}
              title="Window 1"
              subtitle="Search + choose up to 2 categories"
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "details"}
              complete={step === "photos" || step === "purpose"}
              stepNumber={2}
              title="Window 2"
              subtitle="Product name, description, and age"
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "photos"}
              complete={step === "purpose"}
              stepNumber={3}
              title="Window 3"
              subtitle="Upload up to 3 photos"
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "purpose"}
              complete={false}
              stepNumber={4}
              title="Window 4"
              subtitle="Purpose, durations, and pricing"
            />
          </div>
        </div>

        {step === "category" ? (
          <section className="flex max-h-[62vh] flex-col">
            <div className="space-y-4 overflow-y-auto p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-heading text-lg">Step 1: Select categories</h3>
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {selectedCategoryIds.length}/{MAX_CATEGORY_SELECTION} selected
                </span>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Search categories..."
                  className={cn("h-10 pl-9", FIELD_BORDER_CLASS)}
                />
              </div>

              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/55"
                    >
                      <span aria-hidden>{category.icon}</span>
                      <span>{category.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCategories.map((category) => {
                  const isSelected = selectedCategoryIds.includes(category.id);
                  const isDisabled = reachedCategoryLimit && !isSelected;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => toggleCategory(category.id)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all",
                        isSelected
                          ? "border-2 border-primary bg-primary/10 text-foreground shadow-sm"
                          : "border-primary/30 bg-card hover:border-primary/55 hover:bg-accent/50",
                        isDisabled && "cursor-not-allowed opacity-45",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden>{category.icon}</span>
                        <span className="text-sm font-medium">{category.label}</span>
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>

              {filteredCategories.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  No category found for that search.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Pick at least 1 category and at most {MAX_CATEGORY_SELECTION}.
              </p>
              <Button
                type="button"
                variant="highlight"
                onClick={goToDetails}
                disabled={selectedCategoryIds.length === 0}
                className={cn("gap-2", ACTION_BUTTON_BORDER_CLASS)}
              >
                Continue to next window
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : step === "details" ? (
          <section className="flex max-h-[62vh] flex-col">
            <div className="space-y-4 overflow-y-auto p-6">
              <h3 className="font-heading text-lg">Step 2: Product details</h3>

              <div className="space-y-2">
                <Label htmlFor="post-listing-name">Product name</Label>
                <Input
                  id="post-listing-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Canon EOS R5 with 24-105mm lens"
                  maxLength={100}
                  className={FIELD_BORDER_CLASS}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-listing-description">Description</Label>
                <Textarea
                  id="post-listing-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe condition, accessories, and anything buyers should know."
                  className={cn("min-h-32", FIELD_BORDER_CLASS)}
                  maxLength={1500}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-listing-age">How old is this product?</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr]">
                  <Input
                    id="post-listing-age"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={ageValue}
                    onChange={(event) => setAgeValue(event.target.value)}
                    placeholder="0"
                    className={FIELD_BORDER_CLASS}
                    required
                  />
                  <select
                    value={ageUnit}
                    onChange={(event) => setAgeUnit(event.target.value as AgeUnit)}
                    className="flex h-10 w-full rounded-md border border-primary/40 bg-background px-3 py-2 text-sm ring-offset-background focus-visible:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
                    aria-label="Age unit"
                  >
                    {AGE_UNITS.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Example: 8 months old, 2 years old.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep("category")} className="border-primary/45">
                Back to categories
              </Button>
              <Button
                type="button"
                variant="highlight"
                onClick={goToPhotos}
                disabled={!hasValidDetails}
                className={cn("gap-2", ACTION_BUTTON_BORDER_CLASS)}
              >
                Continue to next window
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : step === "photos" ? (
          <section className="flex max-h-[62vh] flex-col">
            <div className="space-y-4 overflow-y-auto p-6">
              <h3 className="font-heading text-lg">Step 3: Upload photos</h3>

              <div className="space-y-2">
                <Label htmlFor="post-listing-photos">Upload product photos</Label>
                <Input
                  id="post-listing-photos"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotosSelected}
                  className={cn(FIELD_BORDER_CLASS, "cursor-pointer")}
                />
                <p className="text-xs text-muted-foreground">
                  Upload at least 1 photo. Maximum {MAX_PHOTO_UPLOADS} photos.
                </p>
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedPhotoFiles.length}/{MAX_PHOTO_UPLOADS}
                </p>
              </div>

              {photoPreviews.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {photoPreviews.map((preview, index) => (
                    <div key={`${preview.file.name}-${index}`} className="overflow-hidden rounded-xl border border-primary/30 bg-card">
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/40">
                        <Image
                          src={preview.previewUrl}
                          alt={`Uploaded preview ${index + 1}`}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                        <p className="truncate text-xs text-muted-foreground" title={preview.file.name}>
                          {preview.file.name}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 border-primary/45 px-2 text-xs"
                          onClick={() => removePhoto(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-primary/35 bg-background p-5 text-sm text-muted-foreground">
                  No photo uploaded yet.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep("details")} className="border-primary/45">
                Back to details
              </Button>
              <Button
                type="button"
                variant="highlight"
                onClick={goToPurpose}
                disabled={!hasPhotoSelection}
                className={cn("gap-2", ACTION_BUTTON_BORDER_CLASS)}
              >
                Continue to next window
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="flex max-h-[62vh] flex-col">
            <div className="space-y-4 overflow-y-auto p-6">
              <h3 className="font-heading text-lg">Step 4: Purpose and pricing</h3>

              <div className="space-y-2">
                <Label>Purpose of listing</Label>
                <p className="text-xs text-muted-foreground">You can choose both Rent and Sell.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PURPOSE_OPTIONS.map((option) => {
                    const selected = selectedPurposes.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => togglePurpose(option.value)}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-left transition-all",
                          selected
                            ? "border-2 border-primary bg-primary/10 shadow-sm"
                            : "border-primary/35 bg-card hover:border-primary/55 hover:bg-accent/40",
                        )}
                      >
                        <p className="text-sm font-semibold text-foreground">{option.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
                {selectedPurposes.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {PURPOSE_OPTIONS.filter((option) => selectedPurposes.includes(option.value)).map((option) => option.label).join(", ")}
                  </p>
                )}
              </div>

              {isSellSelected && (
                <div className="space-y-2 rounded-xl border border-primary/35 bg-accent/30 p-3">
                  <Label htmlFor="post-listing-sell-price">Selling price</Label>
                  <Input
                    id="post-listing-sell-price"
                    type="number"
                    min={0}
                    step="1"
                    inputMode="numeric"
                    value={sellPrice}
                    onChange={(event) => setSellPrice(event.target.value)}
                    placeholder="Enter selling price"
                    className={FIELD_BORDER_CLASS}
                  />
                </div>
              )}

              {isRentSelected && (
                <div className="space-y-3 rounded-xl border border-primary/35 bg-accent/30 p-3">
                  <div className="space-y-1">
                    <Label>Rent duration choices</Label>
                    <p className="text-xs text-muted-foreground">
                      Select one or more options: hourly, daily, weekly, monthly.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {RENT_DURATION_OPTIONS.map((option) => {
                      const selected = selectedRentDurations.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleRentDuration(option.value)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                            selected
                              ? "border-2 border-primary bg-primary text-primary-foreground"
                              : "border-primary/35 bg-background text-foreground hover:border-primary/55 hover:bg-accent",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedRentDurationOptions.length > 0 ? (
                    <div className="space-y-3 rounded-lg border border-primary/30 bg-background p-3">
                      <p className="text-xs text-muted-foreground">
                        Selected durations: {selectedRentDurationOptions.map((option) => option.label).join(", ")}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selectedRentDurationOptions.map((option) => (
                          <div key={option.value} className="space-y-1">
                            <Label htmlFor={`post-listing-${option.value}-price`}>
                              {option.label} price
                            </Label>
                            <Input
                              id={`post-listing-${option.value}-price`}
                              type="number"
                              min={0}
                              step="1"
                              inputMode="numeric"
                              value={rentPrices[option.value]}
                              onChange={(event) => updateRentPrice(option.value, event.target.value)}
                              placeholder={`Enter ${option.label.toLowerCase()} price`}
                              className={FIELD_BORDER_CLASS}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Select at least one duration when Rent is chosen.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("photos")}
                className="border-primary/45"
                disabled={isSubmitting}
              >
                Back to photos
              </Button>
              <Button
                type="submit"
                variant="highlight"
                disabled={!canSubmit || isSubmitting}
                className={cn("gap-2", ACTION_BUTTON_BORDER_CLASS)}
              >
                {isSubmitting ? "Uploading photos..." : "Save listing draft"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FlowStepCardProps {
  active: boolean;
  complete: boolean;
  stepNumber: number;
  title: string;
  subtitle: string;
}

function FlowStepCard({ active, complete, stepNumber, title, subtitle }: FlowStepCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 transition-colors",
        active
          ? "border-primary/40 bg-primary/10"
          : "border-border/70 bg-background/90",
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
            complete
              ? "border-primary bg-primary text-primary-foreground"
              : active
                ? "border-primary/50 bg-background text-primary"
                : "border-border text-muted-foreground",
          )}
        >
          {complete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-sm font-medium text-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
