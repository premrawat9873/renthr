import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, MapPin, Search } from "lucide-react";
import Image from "next/image";

import LocationMapPicker, {
  type MapCoordinates,
} from "@/components/marketplace/LocationMapPicker";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@/data/mockData";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import {
  selectLocation,
  selectUserCoords,
} from "@/store/slices/marketplaceSlice";

type PostStep = "category" | "details" | "photos" | "location" | "purpose";
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
const MAX_SINGLE_UPLOAD_PAYLOAD_BYTES = 4 * 1024 * 1024;
const TARGET_CLIENT_IMAGE_SIZE_BYTES = 1.5 * 1024 * 1024;
const CLIENT_MAX_IMAGE_DIMENSION = 1600;
const CLIENT_INITIAL_JPEG_QUALITY = 0.84;
const CLIENT_MIN_JPEG_QUALITY = 0.5;
const CLIENT_JPEG_QUALITY_STEP = 0.08;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
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
const LOCATION_PINCODE_PATTERN = /^[A-Za-z0-9 -]{4,12}$/;
const FIELD_BORDER_CLASS =
  "border-primary/40 focus-visible:border-primary/70 focus-visible:ring-primary/20";
const ACTION_BUTTON_BORDER_CLASS =
  "border border-primary/45 disabled:opacity-100 disabled:border-primary/45";
const DEFAULT_MAP_CENTER: MapCoordinates = {
  latitude: 20.5937,
  longitude: 78.9629,
};

type ReverseGeocodeAddress = {
  line1: string;
  city: string;
  state: string;
  pincode: string;
};

function toJpegFileName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, "");
  return `${baseName || "image"}.jpg`;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to process image."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read selected image."));
    };

    image.src = objectUrl;
  });
}

async function prepareImageForUpload(file: File) {
  if (file.size <= MAX_SINGLE_UPLOAD_PAYLOAD_BYTES) {
    return file;
  }

  const image = await loadImageElement(file);
  const maxOriginalDimension = Math.max(image.width, image.height);
  const scale =
    maxOriginalDimension > CLIENT_MAX_IMAGE_DIMENSION
      ? CLIENT_MAX_IMAGE_DIMENSION / maxOriginalDimension
      : 1;

  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image for upload.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  let quality = CLIENT_INITIAL_JPEG_QUALITY;
  let output = await canvasToBlob(canvas, quality);

  while (output.size > TARGET_CLIENT_IMAGE_SIZE_BYTES && quality > CLIENT_MIN_JPEG_QUALITY) {
    quality = Math.max(CLIENT_MIN_JPEG_QUALITY, quality - CLIENT_JPEG_QUALITY_STEP);
    output = await canvasToBlob(canvas, quality);

    if (quality === CLIENT_MIN_JPEG_QUALITY) {
      break;
    }
  }

  if (output.size > MAX_SINGLE_UPLOAD_PAYLOAD_BYTES) {
    throw new Error(`\"${file.name}\" is still too large after optimization. Please choose another image.`);
  }

  return new File([output], toJpegFileName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function reverseGeocodeCoordinates(
  coordinates: MapCoordinates,
): Promise<ReverseGeocodeAddress | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${coordinates.latitude}&lon=${coordinates.longitude}&format=json`,
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      display_name?: string;
      address?: {
        house_number?: string;
        road?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        postcode?: string;
      };
    };

    const address = payload.address ?? {};
    const city =
      address.city ??
      address.town ??
      address.village ??
      address.county ??
      "Unknown";
    const state = address.state ?? "Unknown";
    const pincode = address.postcode ?? "";
    const lineParts = [
      address.house_number,
      address.road,
      address.neighbourhood,
      address.suburb,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
    const line1 =
      lineParts.join(", ") ||
      (typeof payload.display_name === "string" && payload.display_name.trim().length > 0
        ? payload.display_name.trim().split(",").slice(0, 2).join(", ")
        : `${city}, ${state}`);

    return {
      line1,
      city,
      state,
      pincode,
    };
  } catch {
    return null;
  }
}

export default function PostListingFlowDialog({ open, onOpenChange }: PostListingFlowDialogProps) {
  const selectedLocation = useAppSelector(selectLocation);
  const selectedUserCoords = useAppSelector(selectUserCoords);
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
  const [isFeatured, setIsFeatured] = useState(false);
  const [locationLine1, setLocationLine1] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [locationPincode, setLocationPincode] = useState("");
  const [locationCoordinates, setLocationCoordinates] = useState<MapCoordinates | null>(null);
  const [isResolvingPinAddress, setIsResolvingPinAddress] = useState(false);
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<File[]>([]);
  const [isPreparingPhotos, setIsPreparingPhotos] = useState(false);
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

  const mapDefaultCenter = useMemo<MapCoordinates>(() => {
    if (
      selectedUserCoords &&
      Number.isFinite(selectedUserCoords.latitude) &&
      Number.isFinite(selectedUserCoords.longitude)
    ) {
      return {
        latitude: selectedUserCoords.latitude,
        longitude: selectedUserCoords.longitude,
      };
    }

    return DEFAULT_MAP_CENTER;
  }, [selectedUserCoords]);

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
  const normalizedLocationLine1 = locationLine1.trim();
  const normalizedLocationCity = locationCity.trim();
  const normalizedLocationState = locationState.trim();
  const normalizedLocationPincode = locationPincode.trim();
  const hasPinnedCoordinates = locationCoordinates != null;
  const hasManualLocationInput =
    normalizedLocationLine1.length > 0 ||
    normalizedLocationCity.length > 0 ||
    normalizedLocationState.length > 0 ||
    normalizedLocationPincode.length > 0;
  const hasLocationInput = hasManualLocationInput || hasPinnedCoordinates;
  const hasValidPincode =
    normalizedLocationPincode.length === 0 ||
    LOCATION_PINCODE_PATTERN.test(normalizedLocationPincode);
  const hasCompleteManualLocation =
    normalizedLocationLine1.length >= 3 &&
    normalizedLocationCity.length >= 2 &&
    normalizedLocationState.length >= 2;
  const hasValidLocation =
    !hasLocationInput ||
    ((hasCompleteManualLocation || hasPinnedCoordinates) && hasValidPincode);
  const canSubmit =
    selectedCategoryIds.length > 0 &&
    hasValidDetails &&
    hasPhotoSelection &&
    hasPurposeSelection &&
    hasValidSellPrice &&
    hasRentDurationSelection &&
    hasValidRentPrices &&
    hasValidLocation;

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
    setIsFeatured(false);
    setLocationLine1("");
    setLocationCity("");
    setLocationState("");
    setLocationPincode("");
    setLocationCoordinates(null);
    setIsResolvingPinAddress(false);
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

  const goToLocation = () => {
    if (!hasPhotoSelection || isPreparingPhotos) return;
    setStep("location");
  };

  const goToPurpose = () => {
    if (!hasValidLocation) return;
    setStep("purpose");
  };

  const handlePhotosSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";

    if (incomingFiles.length === 0) {
      return;
    }

    const slotsRemaining = MAX_PHOTO_UPLOADS - selectedPhotoFiles.length;
    if (slotsRemaining <= 0) {
      toast({
        title: "Upload limit reached",
        description: `You can upload at most ${MAX_PHOTO_UPLOADS} photos.`,
        variant: "destructive",
      });
      return;
    }

    if (incomingFiles.length > slotsRemaining) {
      toast({
        title: "Only 3 photos allowed",
        description: `Added ${slotsRemaining} photo${slotsRemaining > 1 ? "s" : ""}. Remove one to add more.`,
        variant: "destructive",
      });
    }

    const candidateFiles = incomingFiles.slice(0, slotsRemaining);
    setIsPreparingPhotos(true);

    try {
      const preparedFiles: File[] = [];
      const skippedNames: string[] = [];

      for (const file of candidateFiles) {
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
          skippedNames.push(file.name);
          continue;
        }

        try {
          const preparedFile = await prepareImageForUpload(file);
          preparedFiles.push(preparedFile);
        } catch {
          skippedNames.push(file.name);
        }
      }

      if (preparedFiles.length > 0) {
        setSelectedPhotoFiles((current) => {
          const allowedSlots = MAX_PHOTO_UPLOADS - current.length;
          if (allowedSlots <= 0) {
            return current;
          }

          return [...current, ...preparedFiles.slice(0, allowedSlots)];
        });
      }

      if (skippedNames.length > 0) {
        toast({
          title: "Some files were skipped",
          description: `${skippedNames.length} file${skippedNames.length > 1 ? "s were" : " was"} too large or unsupported after optimization.`,
          variant: "destructive",
        });
      }
    } finally {
      setIsPreparingPhotos(false);
    }
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

  const handlePinLocationChange = useCallback((nextCoordinates: MapCoordinates) => {
    setLocationCoordinates(nextCoordinates);
  }, []);

  const clearPinnedLocation = () => {
    setLocationCoordinates(null);
  };

  const autoFillAddressFromPin = useCallback(async () => {
    if (!locationCoordinates || isResolvingPinAddress) {
      return;
    }

    setIsResolvingPinAddress(true);
    try {
      const resolvedAddress = await reverseGeocodeCoordinates(locationCoordinates);
      if (!resolvedAddress) {
        toast({
          title: "Could not fetch address",
          description: "Pin was saved, but address details could not be fetched. You can enter them manually.",
          variant: "destructive",
        });
        return;
      }

      setLocationLine1((current) => current.trim() || resolvedAddress.line1);
      setLocationCity((current) => current.trim() || resolvedAddress.city);
      setLocationState((current) => current.trim() || resolvedAddress.state);
      setLocationPincode((current) => current.trim() || resolvedAddress.pincode);

      toast({
        title: "Location pinned",
        description: `${resolvedAddress.city}, ${resolvedAddress.state} captured from map pin.`,
      });
    } finally {
      setIsResolvingPinAddress(false);
    }
  }, [isResolvingPinAddress, locationCoordinates]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const uploadedImageUrls: string[] = [];

      for (const file of selectedPhotoFiles) {
        const uploadFormData = new FormData();
        uploadFormData.append("images", file);

        const uploadResponse = await fetch("/api/images/upload", {
          method: "POST",
          body: uploadFormData,
        });

        if (uploadResponse.status === 413) {
          throw new Error(
            `\"${file.name}\" is too large for deployment upload limits. Choose a smaller image and try again.`
          );
        }

        const uploadPayload = (await uploadResponse
          .json()
          .catch(() => null)) as UploadImagesResponse | null;

        if (!uploadResponse.ok || !uploadPayload || !Array.isArray(uploadPayload.images)) {
          throw new Error(
            typeof uploadPayload?.error === "string"
              ? uploadPayload.error
              : "Image upload failed. Please try again."
          );
        }

        uploadedImageUrls.push(...uploadPayload.images);
      }

      const selectedRentPricePayload = selectedRentDurations.reduce(
        (accumulator, duration) => {
          accumulator[duration] = rentPrices[duration];
          return accumulator;
        },
        {} as Partial<Record<RentDurationOption, string>>
      );
      const fallbackLocation = selectedLocation?.trim();
      const locationPayload = hasLocationInput
        ? {
            line1:
              normalizedLocationLine1 ||
              [normalizedLocationCity, normalizedLocationState]
                .filter((value) => value.length > 0)
                .join(", ") ||
              "Pinned location",
            city: normalizedLocationCity || "Unknown",
            state: normalizedLocationState || "Unknown",
            pincode: normalizedLocationPincode || "000000",
            country: "IN",
            ...(locationCoordinates
              ? {
                  latitude: locationCoordinates.latitude,
                  longitude: locationCoordinates.longitude,
                }
              : {}),
          }
        : null;

      const saveListingResponse = await fetch("/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: name.trim(),
          description: description.trim(),
          categoryIds: selectedCategoryIds,
          featured: isFeatured,
          ageValue,
          ageUnit,
          purposes: selectedPurposes,
          sellPrice,
          rentPrices: selectedRentPricePayload,
          imageUrls: uploadedImageUrls,
          location: locationPayload ?? (fallbackLocation ? fallbackLocation : undefined),
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
      const listingLocationSummary = locationPayload
        ? locationCoordinates
          ? `${locationPayload.city}, ${locationPayload.state} (${locationCoordinates.latitude.toFixed(5)}, ${locationCoordinates.longitude.toFixed(5)})`
          : `${locationPayload.city}, ${locationPayload.state}`
        : fallbackLocation || "Not specified";

      toast({
        title: "Listing saved",
        description:
          `${name.trim()} in ${selectedLabels}. Purpose: ${selectedPurposeLabels}. ` +
          `${isSellSelected ? `Sell price INR ${sellPrice}. ` : ""}` +
          `${isRentSelected ? `Rent: ${selectedRentSummary}. ` : ""}` +
          `Condition age: ${ageValue} ${ageUnit} old. Location: ${listingLocationSummary}. Uploaded ${uploadedImageUrls.length} photo${uploadedImageUrls.length > 1 ? "s" : ""} to Cloudflare R2. Listing ID: ${saveListingPayload.id}.`,
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
              Visual flow: select categories, add product details, upload photos, add location, then choose rent/sell purpose.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
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
              complete={step === "photos" || step === "location" || step === "purpose"}
              stepNumber={2}
              title="Window 2"
              subtitle="Product name, description, and age"
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "photos"}
              complete={step === "location" || step === "purpose"}
              stepNumber={3}
              title="Window 3"
              subtitle="Upload up to 3 photos"
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "location"}
              complete={step === "purpose"}
              stepNumber={4}
              title="Window 4"
              subtitle="Add product pickup location"
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "purpose"}
              complete={false}
              stepNumber={5}
              title="Window 5"
              subtitle="Purpose, durations, and pricing"
            />
          </div>
        </div>

        {step === "category" ? (
          <section key="post-step-category" className="flex max-h-[62vh] flex-col">
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
          <section key="post-step-details" className="flex max-h-[62vh] flex-col">
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
          <section key="post-step-photos" className="flex max-h-[62vh] flex-col">
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
                  disabled={isPreparingPhotos || isSubmitting}
                  className={cn(FIELD_BORDER_CLASS, "cursor-pointer")}
                />
                <p className="text-xs text-muted-foreground">
                  Upload at least 1 photo. Maximum {MAX_PHOTO_UPLOADS} photos.
                </p>
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedPhotoFiles.length}/{MAX_PHOTO_UPLOADS}
                </p>
                {isPreparingPhotos && (
                  <p className="text-xs text-muted-foreground">Optimizing selected photos for upload...</p>
                )}
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
                onClick={goToLocation}
                disabled={!hasPhotoSelection || isPreparingPhotos}
                className={cn("gap-2", ACTION_BUTTON_BORDER_CLASS)}
              >
                Continue to next window
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : step === "location" ? (
          <section key="post-step-location" className="flex max-h-[62vh] flex-col">
            <div className="space-y-4 overflow-y-auto p-6">
              <h3 className="font-heading text-lg">Step 4: Product location (optional)</h3>

              <p className="text-xs text-muted-foreground">
                Add pickup location details so buyers can see where this product is available.
              </p>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Pin exact location on map</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={autoFillAddressFromPin}
                      disabled={!locationCoordinates || isResolvingPinAddress}
                      className="h-8 border-primary/45 text-xs"
                    >
                      {isResolvingPinAddress ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Resolving...
                        </>
                      ) : (
                        "Auto-fill address"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearPinnedLocation}
                      disabled={!locationCoordinates}
                      className="h-8 border-primary/45 text-xs"
                    >
                      Clear pin
                    </Button>
                  </div>
                </div>

                <LocationMapPicker
                  value={locationCoordinates}
                  onChange={handlePinLocationChange}
                  defaultCenter={mapDefaultCenter}
                  disabled={isSubmitting}
                />

                {!locationCoordinates && (
                  <p className="text-xs text-muted-foreground">
                    Optional: click the map to pinpoint your product pickup spot.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-listing-location-line1">Address line</Label>
                <Input
                  id="post-listing-location-line1"
                  value={locationLine1}
                  onChange={(event) => setLocationLine1(event.target.value)}
                  placeholder="Street, area, or landmark"
                  maxLength={120}
                  className={FIELD_BORDER_CLASS}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="post-listing-location-city">City</Label>
                  <Input
                    id="post-listing-location-city"
                    value={locationCity}
                    onChange={(event) => setLocationCity(event.target.value)}
                    placeholder={selectedLocation?.trim() || "e.g. Bengaluru"}
                    maxLength={80}
                    className={FIELD_BORDER_CLASS}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="post-listing-location-state">State</Label>
                  <Input
                    id="post-listing-location-state"
                    value={locationState}
                    onChange={(event) => setLocationState(event.target.value)}
                    placeholder="e.g. Karnataka"
                    maxLength={80}
                    className={FIELD_BORDER_CLASS}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-listing-location-pincode">Pincode (optional)</Label>
                <Input
                  id="post-listing-location-pincode"
                  value={locationPincode}
                  onChange={(event) => setLocationPincode(event.target.value)}
                  placeholder="e.g. 560001"
                  maxLength={12}
                  className={FIELD_BORDER_CLASS}
                />
                <p className="text-xs text-muted-foreground">
                  Use 4-12 letters, numbers, spaces, or hyphens.
                </p>
              </div>

              {!hasValidLocation && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  Add full address fields or pin on map. Pincode is optional but must be valid when provided.
                </p>
              )}

              {locationCoordinates && (
                <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent/30 px-2.5 py-1 text-xs text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Exact pin selected
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep("photos")} className="border-primary/45">
                Back to photos
              </Button>
              <Button
                type="button"
                variant="highlight"
                onClick={goToPurpose}
                disabled={!hasValidLocation}
                className={cn("gap-2", ACTION_BUTTON_BORDER_CLASS)}
              >
                Continue to next window
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : (
          <form key="post-step-purpose" onSubmit={handleSubmit} className="flex max-h-[62vh] flex-col">
            <div className="space-y-4 overflow-y-auto p-6">
              <h3 className="font-heading text-lg">Step 5: Purpose and pricing</h3>

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

              <div className="flex items-center justify-between rounded-xl border border-primary/35 bg-accent/20 p-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Feature this post</p>
                  <p className="text-xs text-muted-foreground">
                    Featured posts get a highlighted badge in marketplace cards.
                  </p>
                </div>
                <Switch
                  checked={isFeatured}
                  onCheckedChange={setIsFeatured}
                  disabled={isSubmitting}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("location")}
                className="border-primary/45"
                disabled={isSubmitting}
              >
                Back to location
              </Button>
              <Button
                type="submit"
                variant="highlight"
                disabled={!canSubmit || isSubmitting || isPreparingPhotos}
                className={cn("gap-2", ACTION_BUTTON_BORDER_CLASS)}
              >
                {isPreparingPhotos ? "Preparing photos..." : isSubmitting ? "Uploading photos..." : "Save listing draft"}
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
