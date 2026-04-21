import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, MapPin, Search, Video } from "lucide-react";
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

type UploadVideoResponse = {
  video?: {
    url: string;
    key: string;
    sizeBytes: number;
    contentType: string;
    durationSeconds: number;
  };
  error?: string;
};

type CreateListingResponse = {
  id?: string;
  error?: string;
};

type AddressItem = {
  id: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  createdAt: string;
  updatedAt: string;
};

type AddressListResponse = {
  addresses?: AddressItem[];
  error?: string;
};

const MAX_CATEGORY_SELECTION = 2;
const MAX_PHOTO_UPLOADS = 3;
const MAX_SINGLE_UPLOAD_PAYLOAD_BYTES = 4 * 1024 * 1024;
const MAX_SOURCE_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_OPTIMIZED_VIDEO_UPLOAD_BYTES = 23 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 60;
const MIN_VIDEO_CLIP_SECONDS = 0.5;
const VIDEO_TRIM_STEP_SECONDS = 0.1;
const TARGET_VIDEO_BITRATE = 900_000;
const TARGET_AUDIO_BITRATE = 96_000;

type StreamCapableVideoElement = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};
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
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const VIDEO_TYPE_ALIASES: Record<string, string> = {
  "video/x-m4v": "video/mp4",
  "application/mp4": "video/mp4",
  "video/mp4v-es": "video/mp4",
};
const VIDEO_EXTENSION_TO_TYPE: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};
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
const LOCATION_PINCODE_PATTERN = /^\d{6}$/;
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

type IndiaStateOption = {
  name: string;
  isoCode: string;
};

type IndiaStatesResponse = {
  states?: IndiaStateOption[];
  error?: string;
};

type IndiaCitiesResponse = {
  cities?: string[];
  error?: string;
};

type ReverseGeocodeResponse = {
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  error?: string;
};

function toJpegFileName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, "");
  return `${baseName || "image"}.jpg`;
}

function normalizeLocationToken(value: string) {
  const asciiValue = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  return asciiValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizePincodeInput(value: string) {
  return value.replace(/\D+/g, "").slice(0, 6);
}

function findMatchingStateOption(options: IndiaStateOption[], stateName: string) {
  const normalizedTarget = normalizeLocationToken(stateName);
  if (!normalizedTarget) {
    return null;
  }

  for (const option of options) {
    const normalizedOption = normalizeLocationToken(option.name);
    if (!normalizedOption) {
      continue;
    }

    if (
      normalizedOption === normalizedTarget ||
      normalizedOption.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedOption)
    ) {
      return option;
    }
  }

  return null;
}

function findMatchingCity(cities: string[], cityName: string) {
  const normalizedTarget = normalizeLocationToken(cityName);
  if (!normalizedTarget) {
    return null;
  }

  for (const city of cities) {
    const normalizedCity = normalizeLocationToken(city);
    if (!normalizedCity) {
      continue;
    }

    if (
      normalizedCity === normalizedTarget ||
      normalizedCity.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedCity)
    ) {
      return city;
    }
  }

  return null;
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

function loadVideoDurationSeconds(file: File) {
  return new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const videoElement = document.createElement("video");

    videoElement.preload = "metadata";

    videoElement.onloadedmetadata = () => {
      const duration = videoElement.duration;
      URL.revokeObjectURL(objectUrl);

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Unable to read video duration."));
        return;
      }

      resolve(duration);
    };

    videoElement.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read selected video."));
    };

    videoElement.src = objectUrl;
  });
}

function toOptimizedVideoFileName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, "");
  return `${baseName || "clip"}-optimized.webm`;
}

function formatDurationPreciseLabel(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds - minutes * 60;
  return `${minutes}:${remainingSeconds.toFixed(1).padStart(4, "0")}`;
}

function roundTrimSeconds(value: number) {
  return Math.round(value / VIDEO_TRIM_STEP_SECONDS) * VIDEO_TRIM_STEP_SECONDS;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveSupportedVideoType(file: File) {
  const normalizedType = file.type.trim().toLowerCase();
  const canonicalType = VIDEO_TYPE_ALIASES[normalizedType] ?? normalizedType;

  if (canonicalType && ALLOWED_VIDEO_TYPES.has(canonicalType)) {
    return canonicalType;
  }

  const extension = file.name.split(".").pop()?.trim().toLowerCase() ?? "";
  const fromExtension = VIDEO_EXTENSION_TO_TYPE[extension];

  if (fromExtension && ALLOWED_VIDEO_TYPES.has(fromExtension)) {
    return fromExtension;
  }

  return null;
}

async function createOptimizedVideoClip(
  file: File,
  startSeconds: number,
  endSeconds: number,
) {
  const clipDuration = endSeconds - startSeconds;
  if (clipDuration <= 0) {
    throw new Error("Selected clip duration is invalid.");
  }

  if (clipDuration > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error(`Selected clip must be ${MAX_VIDEO_DURATION_SECONDS} seconds or shorter.`);
  }

  const objectUrl = URL.createObjectURL(file);
  const videoElement = document.createElement("video");
  videoElement.src = objectUrl;
  videoElement.preload = "auto";
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    videoElement.onloadedmetadata = () => resolve();
    videoElement.onerror = () => reject(new Error("Unable to prepare video for trimming."));
  });

  const streamSource = videoElement as StreamCapableVideoElement;
  const stream =
    typeof streamSource.captureStream === "function"
      ? streamSource.captureStream()
      : typeof streamSource.mozCaptureStream === "function"
        ? streamSource.mozCaptureStream()
        : null;

  if (!stream) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Video trimming is not supported in this browser.");
  }

  const preferredMimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const supportedMimeType = preferredMimeTypes.find((mime) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime),
  );

  if (!supportedMimeType) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Video encoding is not supported in this browser.");
  }

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: supportedMimeType,
    videoBitsPerSecond: TARGET_VIDEO_BITRATE,
    audioBitsPerSecond: TARGET_AUDIO_BITRATE,
  });

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const stopPromise = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  videoElement.currentTime = startSeconds;
  await new Promise<void>((resolve) => {
    videoElement.onseeked = () => resolve();
  });

  recorder.start(250);
  await videoElement.play().catch(() => {
    // Playback may require user gesture in some browsers.
  });

  await new Promise<void>((resolve) => {
    const poll = () => {
      if (videoElement.currentTime >= endSeconds || videoElement.ended) {
        resolve();
        return;
      }
      requestAnimationFrame(poll);
    };
    poll();
  });

  videoElement.pause();
  if (recorder.state !== "inactive") {
    recorder.stop();
  }
  await stopPromise;

  URL.revokeObjectURL(objectUrl);

  const outputType = recorder.mimeType || "video/webm";
  const outputBlob = new Blob(chunks, { type: outputType });

  if (outputBlob.size <= 0) {
    throw new Error("Unable to generate optimized clip. Try another video.");
  }

  if (outputBlob.size > MAX_OPTIMIZED_VIDEO_UPLOAD_BYTES) {
    throw new Error("Optimized clip is still larger than 23MB. Select a shorter range.");
  }

  return {
    file: new File([outputBlob], toOptimizedVideoFileName(file.name), {
      type: outputType,
      lastModified: Date.now(),
    }),
    durationSeconds: Math.ceil(clipDuration),
  };
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
      `/api/locations/reverse?lat=${coordinates.latitude}&lon=${coordinates.longitude}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ReverseGeocodeResponse;
    const city = typeof payload.city === "string" ? payload.city.trim() : "";
    const state = typeof payload.state === "string" ? payload.state.trim() : "";
    const line1 = typeof payload.line1 === "string" ? payload.line1.trim() : "";
    const pincode =
      typeof payload.pincode === "string"
        ? normalizePincodeInput(payload.pincode.trim())
        : "";

    if (!city || !state) {
      return null;
    }

    return {
      line1: line1 || `${city}, ${state}`,
      city,
      state,
      pincode,
    };
  } catch {
    return null;
  }
}

export default function PostListingFlowDialog({ open, onOpenChange }: PostListingFlowDialogProps) {
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
  const [savedAddresses, setSavedAddresses] = useState<AddressItem[]>([]);
  const [isLoadingSavedAddresses, setIsLoadingSavedAddresses] = useState(false);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [saveAddressForFuture, setSaveAddressForFuture] = useState(false);
  const [locationCoordinates, setLocationCoordinates] = useState<MapCoordinates | null>(null);
  const [isResolvingPinAddress, setIsResolvingPinAddress] = useState(false);
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);
  const [stateOptions, setStateOptions] = useState<IndiaStateOption[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [isStatesLoading, setIsStatesLoading] = useState(false);
  const [isCitiesLoading, setIsCitiesLoading] = useState(false);
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<File[]>([]);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedVideoDurationSeconds, setSelectedVideoDurationSeconds] = useState<number | null>(null);
  const [videoTrimStartSeconds, setVideoTrimStartSeconds] = useState(0);
  const [videoTrimEndSeconds, setVideoTrimEndSeconds] = useState(0);
  const [isPreparingPhotos, setIsPreparingPhotos] = useState(false);
  const [isPreparingVideo, setIsPreparingVideo] = useState(false);
  const [videoPreviewCurrentSeconds, setVideoPreviewCurrentSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pinResolveRequestIdRef = useRef(0);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

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
  const selectedVideoPreviewUrl = useMemo(
    () => (selectedVideoFile ? URL.createObjectURL(selectedVideoFile) : null),
    [selectedVideoFile],
  );
  const selectedClipDurationSeconds = useMemo(() => {
    if (!selectedVideoFile || !selectedVideoDurationSeconds) {
      return 0;
    }

    return Math.max(0, videoTrimEndSeconds - videoTrimStartSeconds);
  }, [selectedVideoDurationSeconds, selectedVideoFile, videoTrimEndSeconds, videoTrimStartSeconds]);
  const videoTrimSliderMax = Math.max(VIDEO_TRIM_STEP_SECONDS, selectedVideoDurationSeconds ?? 1);
  const videoTrimStartPercent = (videoTrimStartSeconds / videoTrimSliderMax) * 100;
  const videoTrimEndPercent = (videoTrimEndSeconds / videoTrimSliderMax) * 100;

  const selectedCityOption = useMemo(
    () => findMatchingCity(cityOptions, locationCity),
    [cityOptions, locationCity],
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => {
        URL.revokeObjectURL(preview.previewUrl);
      });
    };
  }, [photoPreviews]);

  useEffect(() => {
    return () => {
      if (selectedVideoPreviewUrl) {
        URL.revokeObjectURL(selectedVideoPreviewUrl);
      }
    };
  }, [selectedVideoPreviewUrl]);

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
  const hasValidPincode =
    normalizedLocationPincode.length === 0 ||
    LOCATION_PINCODE_PATTERN.test(normalizedLocationPincode);
  const hasValidLocation =
    normalizedLocationCity.length >= 2 &&
    normalizedLocationState.length >= 2 &&
    hasValidPincode;
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
    setSelectedSavedAddressId(null);
    setSaveAddressForFuture(false);
    setLocationCoordinates(null);
    setSelectedStateCode("");
    setCityOptions([]);
    setIsResolvingPinAddress(false);
    setIsUsingCurrentLocation(false);
    setSelectedPhotoFiles([]);
    setSelectedVideoFile(null);
    setSelectedVideoDurationSeconds(null);
    setVideoTrimStartSeconds(0);
    setVideoTrimEndSeconds(0);
    setIsPreparingVideo(false);
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
    if (!hasPhotoSelection || isPreparingPhotos || isPreparingVideo) return;
    setStep("location");
  };

  const goToPurpose = () => {
    if (!hasValidLocation) return;
    setStep("purpose");
  };

  const canNavigateToStep = (targetStep: PostStep) => {
    if (targetStep === "category") return true;
    if (targetStep === "details") return selectedCategoryIds.length > 0;
    if (targetStep === "photos") return hasValidDetails;
    if (targetStep === "location") {
      return hasPhotoSelection && !isPreparingPhotos && !isPreparingVideo;
    }
    if (targetStep === "purpose") return hasValidLocation;
    return false;
  };

  const handleStepNavigation = (targetStep: PostStep) => {
    if (isSubmitting) {
      return;
    }

    if (canNavigateToStep(targetStep)) {
      setStep(targetStep);
    }
  };

  const fetchIndiaStates = useCallback(async (): Promise<IndiaStateOption[]> => {
    try {
      setIsStatesLoading(true);

      const response = await fetch("/api/locations/india", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as IndiaStatesResponse | null;

      if (!response.ok || !payload || !Array.isArray(payload.states)) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "State list is unavailable right now.",
        );
      }

      const normalizedStates = payload.states
        .map((entry) => ({
          name: typeof entry.name === "string" ? entry.name.trim() : "",
          isoCode: typeof entry.isoCode === "string" ? entry.isoCode.trim().toUpperCase() : "",
        }))
        .filter((entry) => entry.name.length > 0 && entry.isoCode.length > 0);

      setStateOptions(normalizedStates);
      return normalizedStates;
    } catch (error) {
      toast({
        title: "Could not load states",
        description:
          error instanceof Error
            ? error.message
            : "Unable to fetch states right now. Please try again.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsStatesLoading(false);
    }
  }, []);

  const fetchIndiaCities = useCallback(async (stateCode: string): Promise<string[]> => {
    if (!stateCode) {
      setCityOptions([]);
      return [];
    }

    try {
      setIsCitiesLoading(true);

      const response = await fetch(`/api/locations/india?state=${encodeURIComponent(stateCode)}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as IndiaCitiesResponse | null;

      if (!response.ok || !payload || !Array.isArray(payload.cities)) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "City list is unavailable right now.",
        );
      }

      const normalizedCities = Array.from(
        new Set(
          payload.cities
            .map((city) => (typeof city === "string" ? city.trim() : ""))
            .filter((city) => city.length > 0),
        ),
      );

      setCityOptions(normalizedCities);
      return normalizedCities;
    } catch (error) {
      toast({
        title: "Could not load cities",
        description:
          error instanceof Error
            ? error.message
            : "Unable to fetch cities for this state right now. Please try again.",
        variant: "destructive",
      });
      setCityOptions([]);
      return [];
    } finally {
      setIsCitiesLoading(false);
    }
  }, []);

  const loadSavedAddresses = useCallback(async () => {
    try {
      setIsLoadingSavedAddresses(true);
      const response = await fetch("/api/addresses", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AddressListResponse | null;

      if (!response.ok || !Array.isArray(payload?.addresses)) {
        throw new Error(payload?.error || "Unable to load saved addresses right now.");
      }

      setSavedAddresses(payload.addresses);
    } catch {
      setSavedAddresses([]);
    } finally {
      setIsLoadingSavedAddresses(false);
    }
  }, []);

  useEffect(() => {
    if (!open || step !== "location" || stateOptions.length > 0) {
      return;
    }

    void fetchIndiaStates();
  }, [fetchIndiaStates, open, stateOptions.length, step]);

  useEffect(() => {
    if (!open || step !== "location") {
      return;
    }

    void loadSavedAddresses();
  }, [loadSavedAddresses, open, step]);

  const applySavedAddress = useCallback((address: AddressItem) => {
    setSelectedSavedAddressId(address.id);
    setSaveAddressForFuture(false);
    setLocationLine1(address.address.trim());
    setLocationCity(address.city.trim());
    setLocationState(address.state.trim());
    setLocationPincode(normalizePincodeInput(address.pincode));
    setSelectedStateCode("");
    setCityOptions([]);
    pinResolveRequestIdRef.current += 1;
    setIsResolvingPinAddress(false);
    setLocationCoordinates(null);
  }, []);

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

  const handleVideoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    event.currentTarget.value = "";

    if (!selectedFile) {
      return;
    }

    const supportedType = resolveSupportedVideoType(selectedFile);

    if (!supportedType) {
      toast({
        title: "Unsupported video format",
        description: "Use MP4, WEBM, or MOV format.",
        variant: "destructive",
      });
      return;
    }

    const normalizedFile =
      selectedFile.type === supportedType
        ? selectedFile
        : new File([selectedFile], selectedFile.name, {
            type: supportedType,
            lastModified: selectedFile.lastModified,
          });

    if (selectedFile.size > MAX_SOURCE_VIDEO_UPLOAD_BYTES) {
      toast({
        title: "Video too large",
        description: "Source video must be 100MB or smaller.",
        variant: "destructive",
      });
      return;
    }

    setIsPreparingVideo(true);

    try {
      const duration = await loadVideoDurationSeconds(normalizedFile);

      setSelectedVideoFile(normalizedFile);
      const roundedDuration = roundTrimSeconds(duration);
      const initialClipEnd = Math.max(
        MIN_VIDEO_CLIP_SECONDS,
        Math.min(MAX_VIDEO_DURATION_SECONDS, roundedDuration),
      );

      setSelectedVideoDurationSeconds(roundedDuration);
      setVideoTrimStartSeconds(0);
      setVideoTrimEndSeconds(initialClipEnd);
      setVideoPreviewCurrentSeconds(0);

      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        toast({
          title: "Select clip range",
          description: `This video is longer than ${MAX_VIDEO_DURATION_SECONDS}s. Choose the part you want to upload.`,
        });
      }
    } catch (error) {
      setSelectedVideoFile(null);
      setSelectedVideoDurationSeconds(null);
      setVideoTrimStartSeconds(0);
      setVideoTrimEndSeconds(0);
      toast({
        title: "Video validation failed",
        description:
          error instanceof Error
            ? error.message
            : "Please choose another video.",
        variant: "destructive",
      });
    } finally {
      setIsPreparingVideo(false);
    }
  };

  const removeVideo = () => {
    setSelectedVideoFile(null);
    setSelectedVideoDurationSeconds(null);
    setVideoTrimStartSeconds(0);
    setVideoTrimEndSeconds(0);
    setVideoPreviewCurrentSeconds(0);
  };

  const seekVideoPreviewTo = useCallback((seconds: number) => {
    const preview = videoPreviewRef.current;
    if (!preview || !Number.isFinite(seconds)) {
      return;
    }

    const maxSecond = Math.max(0, (selectedVideoDurationSeconds ?? 0) - 0.05);
    const safeSecond = clampNumber(seconds, 0, maxSecond);

    try {
      preview.currentTime = safeSecond;
    } catch {
      // Ignore seek failures when metadata is still loading.
    }
  }, [selectedVideoDurationSeconds]);

  const handleVideoTrimStartChange = (value: number) => {
    const maxValue = Math.max(0, videoTrimEndSeconds - MIN_VIDEO_CLIP_SECONDS);
    const nextStart = roundTrimSeconds(clampNumber(value, 0, maxValue));
    let nextEnd = videoTrimEndSeconds;

    if (nextEnd - nextStart > MAX_VIDEO_DURATION_SECONDS) {
      nextEnd = roundTrimSeconds(nextStart + MAX_VIDEO_DURATION_SECONDS);
      setVideoTrimEndSeconds(nextEnd);
    }

    setVideoTrimStartSeconds(nextStart);
    seekVideoPreviewTo(nextStart);
  };

  const handleVideoTrimEndChange = (value: number) => {
    const maxDurationBound = selectedVideoDurationSeconds ?? 0;
    const minValue = videoTrimStartSeconds + MIN_VIDEO_CLIP_SECONDS;
    let nextEnd = roundTrimSeconds(clampNumber(value, minValue, maxDurationBound));

    if (nextEnd - videoTrimStartSeconds > MAX_VIDEO_DURATION_SECONDS) {
      nextEnd = roundTrimSeconds(videoTrimStartSeconds + MAX_VIDEO_DURATION_SECONDS);
    }

    setVideoTrimEndSeconds(nextEnd);
    seekVideoPreviewTo(nextEnd);
  };

  useEffect(() => {
    const preview = videoPreviewRef.current;
    if (!preview || !selectedVideoFile) {
      return;
    }

    const clipStart = videoTrimStartSeconds;
    const clipEnd = Math.max(videoTrimEndSeconds, clipStart + 0.1);

    const resetToClipStart = () => {
      if (preview.currentTime < clipStart || preview.currentTime >= clipEnd) {
        preview.currentTime = clipStart;
      }
    };

    const handlePlay = () => {
      resetToClipStart();
    };

    const handleTimeUpdate = () => {
      setVideoPreviewCurrentSeconds(preview.currentTime);
      if (preview.currentTime >= clipEnd) {
        preview.currentTime = clipStart;
      }
    };

    preview.addEventListener("play", handlePlay);
    preview.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      preview.removeEventListener("play", handlePlay);
      preview.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [selectedVideoFile, videoTrimEndSeconds, videoTrimStartSeconds]);

  const previewTrimmedClip = () => {
    const preview = videoPreviewRef.current;
    if (!preview) {
      return;
    }

    const clipStart = videoTrimStartSeconds;
    preview.currentTime = clipStart;
    setVideoPreviewCurrentSeconds(clipStart);
    void preview.play().catch(() => {
      // Ignore autoplay restrictions; user can press play from controls.
    });
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

  const handleStateSelection = useCallback(
    async (nextStateCode: string) => {
      setSelectedSavedAddressId(null);
      if (!nextStateCode) {
        setSelectedStateCode("");
        setLocationState("");
        setLocationCity("");
        setCityOptions([]);
        return;
      }

      const matchedState = stateOptions.find((state) => state.isoCode === nextStateCode);
      setSelectedStateCode(nextStateCode);
      setLocationState(matchedState?.name ?? "");
      setLocationCity("");
      await fetchIndiaCities(nextStateCode);
    },
    [fetchIndiaCities, stateOptions],
  );

  const handleCitySelection = useCallback((nextCity: string) => {
    setSelectedSavedAddressId(null);
    setLocationCity(nextCity);
  }, []);

  const resolveAndApplyAddressFromCoordinates = useCallback(
    async (coordinates: MapCoordinates, trigger: "auto" | "manual") => {
      const requestId = ++pinResolveRequestIdRef.current;
      setIsResolvingPinAddress(true);
      setSelectedSavedAddressId(null);

      try {
        const resolvedAddress = await reverseGeocodeCoordinates(coordinates);
        if (requestId !== pinResolveRequestIdRef.current) {
          return;
        }

        if (!resolvedAddress) {
          if (trigger === "manual") {
            toast({
              title: "Could not fetch address",
              description: "Pin was saved, but address details could not be fetched. You can enter them manually.",
              variant: "destructive",
            });
          }
          return;
        }

        setLocationLine1(resolvedAddress.line1);
        setLocationPincode(normalizePincodeInput(resolvedAddress.pincode));

        let availableStates = stateOptions;
        if (availableStates.length === 0) {
          availableStates = await fetchIndiaStates();
          if (requestId !== pinResolveRequestIdRef.current) {
            return;
          }
        }

        const matchedState = findMatchingStateOption(availableStates, resolvedAddress.state);

        if (!matchedState) {
          setSelectedStateCode("");
          setCityOptions([]);
          setLocationState(resolvedAddress.state);
          setLocationCity(resolvedAddress.city);
        } else {
          setSelectedStateCode(matchedState.isoCode);
          setLocationState(matchedState.name);

          const availableCities = await fetchIndiaCities(matchedState.isoCode);
          if (requestId !== pinResolveRequestIdRef.current) {
            return;
          }

          const matchedCity = findMatchingCity(availableCities, resolvedAddress.city);
          setLocationCity(matchedCity ?? resolvedAddress.city);
        }

        if (trigger === "manual") {
          toast({
            title: "Address updated from pin",
            description: `${resolvedAddress.city}, ${resolvedAddress.state} selected from the map pin.`,
          });
        }
      } finally {
        if (requestId === pinResolveRequestIdRef.current) {
          setIsResolvingPinAddress(false);
        }
      }
    },
    [fetchIndiaCities, fetchIndiaStates, stateOptions],
  );

  const handlePinLocationChange = useCallback(
    (nextCoordinates: MapCoordinates) => {
      setLocationCoordinates(nextCoordinates);
      void resolveAndApplyAddressFromCoordinates(nextCoordinates, "auto");
    },
    [resolveAndApplyAddressFromCoordinates],
  );

  const clearPinnedLocation = () => {
    pinResolveRequestIdRef.current += 1;
    setIsResolvingPinAddress(false);
    setLocationCoordinates(null);
  };

  const autoFillAddressFromPin = useCallback(async () => {
    if (!locationCoordinates || isResolvingPinAddress) {
      return;
    }

    await resolveAndApplyAddressFromCoordinates(locationCoordinates, "manual");
  }, [isResolvingPinAddress, locationCoordinates, resolveAndApplyAddressFromCoordinates]);

  const useCurrentLocationOnMap = useCallback(() => {
    if (isUsingCurrentLocation || isResolvingPinAddress) {
      return;
    }

    if (!("geolocation" in navigator)) {
      toast({
        title: "Current location unavailable",
        description: "Your browser does not support geolocation.",
        variant: "destructive",
      });
      return;
    }

    setIsUsingCurrentLocation(true);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const nextCoordinates: MapCoordinates = {
          latitude: Number(coords.latitude.toFixed(7)),
          longitude: Number(coords.longitude.toFixed(7)),
        };

        setLocationCoordinates(nextCoordinates);

        await resolveAndApplyAddressFromCoordinates(nextCoordinates, "manual");
        setIsUsingCurrentLocation(false);
      },
      () => {
        setIsUsingCurrentLocation(false);
        toast({
          title: "Could not access current location",
          description:
            "Please allow location access in your browser, or place a pin on the map manually.",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  }, [isResolvingPinAddress, isUsingCurrentLocation, resolveAndApplyAddressFromCoordinates]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const uploadedImageUrls: string[] = [];
      let uploadedVideo: UploadVideoResponse["video"] | null = null;

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

      if (selectedVideoFile) {
        if (!selectedVideoDurationSeconds) {
          throw new Error("Unable to verify video duration. Please reselect your video.");
        }

        if (
          selectedClipDurationSeconds <= 0 ||
          selectedClipDurationSeconds > MAX_VIDEO_DURATION_SECONDS
        ) {
          throw new Error(`Selected clip must be between 1 and ${MAX_VIDEO_DURATION_SECONDS} seconds.`);
        }

        setIsPreparingVideo(true);
        const optimizedClip = await createOptimizedVideoClip(
          selectedVideoFile,
          videoTrimStartSeconds,
          videoTrimEndSeconds,
        );
        setIsPreparingVideo(false);

        const videoUploadFormData = new FormData();
        videoUploadFormData.append("video", optimizedClip.file);
        videoUploadFormData.append(
          "durationSeconds",
          String(optimizedClip.durationSeconds)
        );

        const videoUploadResponse = await fetch("/api/videos/upload", {
          method: "POST",
          body: videoUploadFormData,
        });

        const videoUploadPayload = (await videoUploadResponse
          .json()
          .catch(() => null)) as UploadVideoResponse | null;

        if (!videoUploadResponse.ok || !videoUploadPayload?.video) {
          throw new Error(
            typeof videoUploadPayload?.error === "string"
              ? videoUploadPayload.error
              : "Video upload failed. Please try again."
          );
        }

        uploadedVideo = videoUploadPayload.video;
      }

      const selectedRentPricePayload = selectedRentDurations.reduce(
        (accumulator, duration) => {
          accumulator[duration] = rentPrices[duration];
          return accumulator;
        },
        {} as Partial<Record<RentDurationOption, string>>
      );
      const locationPayload = {
        line1:
          normalizedLocationLine1 ||
          [normalizedLocationCity, normalizedLocationState]
            .filter((value) => value.length > 0)
            .join(", "),
        city: normalizedLocationCity,
        state: normalizedLocationState,
        pincode: normalizedLocationPincode,
        country: "IN",
        ...(locationCoordinates
          ? {
              latitude: locationCoordinates.latitude,
              longitude: locationCoordinates.longitude,
            }
          : {}),
      };

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
          video: uploadedVideo
            ? {
                url: uploadedVideo.url,
                key: uploadedVideo.key,
                sizeBytes: uploadedVideo.sizeBytes,
                contentType: uploadedVideo.contentType,
                durationSeconds: uploadedVideo.durationSeconds,
              }
            : null,
          saveAddress: saveAddressForFuture && !selectedSavedAddressId,
          location: locationPayload,
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
        : "Not specified";

      toast({
        title: "Listing saved",
        description:
          `${name.trim()} in ${selectedLabels}. Purpose: ${selectedPurposeLabels}. ` +
          `${isSellSelected ? `Sell price INR ${sellPrice}. ` : ""}` +
          `${isRentSelected ? `Rent: ${selectedRentSummary}. ` : ""}` +
          `Condition age: ${ageValue} ${ageUnit} old. Location: ${listingLocationSummary}. Uploaded ${uploadedImageUrls.length} photo${uploadedImageUrls.length > 1 ? "s" : ""}${uploadedVideo ? " and 1 video" : ""} to Cloudflare R2. Listing ID: ${saveListingPayload.id}.`,
      });

      handleOpenChange(false);
    } catch (error) {
      setIsPreparingVideo(false);
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
      <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden border-primary/20 p-0 sm:h-[min(92dvh,860px)] sm:w-[calc(100vw-2rem)] sm:rounded-2xl">
        <div className="border-b border-primary/10 bg-gradient-to-br from-accent via-background to-accent/60 p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="font-heading text-xl text-foreground">
              Post a new listing
            </DialogTitle>
            <DialogDescription>
              Visual flow: select categories, add product details, upload photos and an optional short video, add location, then choose rent/sell purpose.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center md:overflow-visible md:pb-0">
            <FlowStepCard
              active={step === "category"}
              complete={step !== "category"}
              stepNumber={1}
              title="Categories"
              subtitle="Search + choose up to 2 categories"
              onClick={() => handleStepNavigation("category")}
              disabled={isSubmitting}
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "details"}
              complete={step === "photos" || step === "location" || step === "purpose"}
              stepNumber={2}
              title="Details"
              subtitle="Product name, description, and age"
              onClick={() => handleStepNavigation("details")}
              disabled={!canNavigateToStep("details") || isSubmitting}
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "photos"}
              complete={step === "location" || step === "purpose"}
              stepNumber={3}
              title="Photos"
              subtitle="Upload up to 3 photos + 1 video"
              onClick={() => handleStepNavigation("photos")}
              disabled={!canNavigateToStep("photos") || isSubmitting}
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "location"}
              complete={step === "purpose"}
              stepNumber={4}
              title="Location"
              subtitle="Add product pickup location"
              onClick={() => handleStepNavigation("location")}
              disabled={!canNavigateToStep("location") || isSubmitting}
            />

            <div className="hidden md:flex items-center justify-center text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <FlowStepCard
              active={step === "purpose"}
              complete={false}
              stepNumber={5}
              title="Purpose"
              subtitle="Review, pricing, and publish"
              onClick={() => handleStepNavigation("purpose")}
              disabled={!canNavigateToStep("purpose") || isSubmitting}
            />
          </div>
        </div>

        {step === "category" ? (
          <section key="post-step-category" className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
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

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
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
          <section key="post-step-details" className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
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

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
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
          <section key="post-step-photos" className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <h3 className="font-heading text-lg">Step 3: Upload media</h3>

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
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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

              <div className="space-y-2 rounded-xl border border-primary/25 bg-accent/15 p-3">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" />
                  <Label htmlFor="post-listing-video" className="text-sm font-semibold">
                    Optional: upload one video
                  </Label>
                </div>
                <Input
                  id="post-listing-video"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoSelected}
                  disabled={isPreparingVideo || isSubmitting}
                  className={cn(FIELD_BORDER_CLASS, "cursor-pointer")}
                />
                <p className="text-xs text-muted-foreground">
                  Max 1 video. Source up to 100MB; selected clip up to {MAX_VIDEO_DURATION_SECONDS} seconds and compressed before upload.
                </p>

                {isPreparingVideo ? (
                  <p className="text-xs text-muted-foreground">Validating video...</p>
                ) : null}

                {selectedVideoFile && selectedVideoPreviewUrl ? (
                  <div className="space-y-2 rounded-lg border border-primary/30 bg-background p-3">
                    <video
                      ref={videoPreviewRef}
                      src={selectedVideoPreviewUrl}
                      controls
                      preload="metadata"
                      onLoadedMetadata={() => {
                        seekVideoPreviewTo(videoTrimStartSeconds);
                      }}
                      className="aspect-video w-full rounded-lg bg-black"
                    />
                    <div className="space-y-2 rounded-md border border-primary/20 bg-accent/10 p-2.5">
                      <p className="text-xs font-medium text-foreground">Trim clip before upload</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Start: {formatDurationPreciseLabel(videoTrimStartSeconds)}</span>
                          <span>End: {formatDurationPreciseLabel(videoTrimEndSeconds)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Start (seconds)</Label>
                            <Input
                              type="number"
                              min={0}
                              max={Math.max(0, videoTrimEndSeconds - MIN_VIDEO_CLIP_SECONDS)}
                              step={VIDEO_TRIM_STEP_SECONDS}
                              value={videoTrimStartSeconds}
                              onChange={(event) =>
                                handleVideoTrimStartChange(Number(event.target.value || 0))
                              }
                              className={cn("h-8 text-xs", FIELD_BORDER_CLASS)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">End (seconds)</Label>
                            <Input
                              type="number"
                              min={videoTrimStartSeconds + MIN_VIDEO_CLIP_SECONDS}
                              max={videoTrimSliderMax}
                              step={VIDEO_TRIM_STEP_SECONDS}
                              value={videoTrimEndSeconds}
                              onChange={(event) =>
                                handleVideoTrimEndChange(Number(event.target.value || 0))
                              }
                              className={cn("h-8 text-xs", FIELD_BORDER_CLASS)}
                            />
                          </div>
                        </div>
                        <div className="relative h-7">
                          <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary/20" />
                          <div
                            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
                            style={{
                              left: `${videoTrimStartPercent}%`,
                              width: `${Math.max(0, videoTrimEndPercent - videoTrimStartPercent)}%`,
                            }}
                          />
                          <input
                            type="range"
                            min={0}
                            max={Math.max(VIDEO_TRIM_STEP_SECONDS, videoTrimSliderMax - MIN_VIDEO_CLIP_SECONDS)}
                            step={VIDEO_TRIM_STEP_SECONDS}
                            value={videoTrimStartSeconds}
                            onChange={(event) =>
                              handleVideoTrimStartChange(Number(event.target.value))
                            }
                            aria-label="Trim start"
                            className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-primary"
                          />
                          <input
                            type="range"
                            min={MIN_VIDEO_CLIP_SECONDS}
                            max={videoTrimSliderMax}
                            step={VIDEO_TRIM_STEP_SECONDS}
                            value={videoTrimEndSeconds}
                            onChange={(event) =>
                              handleVideoTrimEndChange(Number(event.target.value))
                            }
                            aria-label="Trim end"
                            className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-primary/85 [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-primary/85"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 border-primary/45 px-2 text-xs"
                          onClick={previewTrimmedClip}
                        >
                          Preview edited clip
                        </Button>
                        <span className="text-[11px] text-muted-foreground">
                          Current: {formatDurationPreciseLabel(videoPreviewCurrentSeconds)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Selected clip: {formatDurationPreciseLabel(selectedClipDurationSeconds)}
                        {selectedClipDurationSeconds > MAX_VIDEO_DURATION_SECONDS
                          ? ` (must be <= ${MAX_VIDEO_DURATION_SECONDS}s)`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted-foreground" title={selectedVideoFile.name}>
                        {selectedVideoFile.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {selectedVideoDurationSeconds ?? 0}s source
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 border-primary/45 px-2 text-xs"
                          onClick={removeVideo}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No video selected.</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
              <Button type="button" variant="outline" onClick={() => setStep("details")} className="border-primary/45">
                Back to details
              </Button>
              <Button
                type="button"
                variant="highlight"
                onClick={goToLocation}
                disabled={!hasPhotoSelection || isPreparingPhotos || isPreparingVideo}
                className={cn("gap-2", ACTION_BUTTON_BORDER_CLASS)}
              >
                Continue to next window
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : step === "location" ? (
          <section key="post-step-location" className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <h3 className="font-heading text-lg">Step 4: Product location</h3>

              <p className="text-xs text-muted-foreground">
                City and state are required so buyers can get accurate distance from your listing.
              </p>

              <div className="space-y-2 rounded-xl border border-primary/25 bg-accent/15 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Saved addresses</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadSavedAddresses()}
                    disabled={isLoadingSavedAddresses}
                    className="h-8 border-primary/45 text-xs"
                  >
                    {isLoadingSavedAddresses ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>

                {isLoadingSavedAddresses ? (
                  <p className="text-xs text-muted-foreground">Loading saved addresses...</p>
                ) : savedAddresses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No saved addresses yet.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {savedAddresses.map((address) => {
                      const selected = selectedSavedAddressId === address.id;
                      return (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => applySavedAddress(address)}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-primary/30 bg-background hover:border-primary/55 hover:bg-accent/40",
                          )}
                        >
                          <p className="truncate text-xs font-semibold text-foreground">{address.address}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {address.city}, {address.state} {address.pincode}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Pin exact location on map</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={useCurrentLocationOnMap}
                      disabled={isUsingCurrentLocation || isResolvingPinAddress}
                      className="h-8 border-primary/45 text-xs"
                    >
                      {isUsingCurrentLocation ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Locating...
                        </>
                      ) : (
                        "Use current location"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={autoFillAddressFromPin}
                      disabled={!locationCoordinates || isResolvingPinAddress || isUsingCurrentLocation}
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
                      disabled={!locationCoordinates || isUsingCurrentLocation}
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
                  onChange={(event) => {
                    setSelectedSavedAddressId(null);
                    setLocationLine1(event.target.value);
                  }}
                  placeholder="Street, area, or landmark"
                  maxLength={120}
                  className={FIELD_BORDER_CLASS}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="post-listing-location-state">State</Label>
                  <select
                    id="post-listing-location-state"
                    value={selectedStateCode}
                    onChange={(event) => {
                      void handleStateSelection(event.target.value);
                    }}
                    disabled={isSubmitting || isStatesLoading}
                    className={cn(
                      "h-10 w-full rounded-md border bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
                      FIELD_BORDER_CLASS,
                    )}
                  >
                    <option value="">
                      {isStatesLoading ? "Loading states..." : "Select a state"}
                    </option>
                    {stateOptions.map((stateOption) => (
                      <option key={stateOption.isoCode} value={stateOption.isoCode}>
                        {stateOption.name}
                      </option>
                    ))}
                  </select>
                  {locationState && !selectedStateCode && !isStatesLoading && (
                    <p className="text-xs text-muted-foreground">
                      Detected from map: {locationState}. Pick the closest state from the dropdown.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="post-listing-location-city">City</Label>
                  <select
                    id="post-listing-location-city"
                    value={selectedCityOption ?? (locationCity || "")}
                    onChange={(event) => handleCitySelection(event.target.value)}
                    disabled={isSubmitting || !selectedStateCode || isCitiesLoading}
                    className={cn(
                      "h-10 w-full rounded-md border bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
                      FIELD_BORDER_CLASS,
                    )}
                  >
                    <option value="">
                      {!selectedStateCode
                        ? "Select state first"
                        : isCitiesLoading
                          ? "Loading cities..."
                          : "Select a city"}
                    </option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                    {locationCity && !selectedCityOption && (
                      <option value={locationCity}>{locationCity} (from map)</option>
                    )}
                  </select>
                  {selectedStateCode && !isCitiesLoading && cityOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No city list found for this state. Try choosing a different state.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-listing-location-pincode">Pincode (optional)</Label>
                <Input
                  id="post-listing-location-pincode"
                  value={locationPincode}
                  onChange={(event) => {
                    setSelectedSavedAddressId(null);
                    setLocationPincode(normalizePincodeInput(event.target.value));
                  }}
                  placeholder="e.g. 560001"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  className={FIELD_BORDER_CLASS}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a 6-digit pincode.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-accent/20 px-3 py-2.5">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">Save this address for next time</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSavedAddressId
                      ? "Using an existing saved address."
                      : "Address will be saved to your profile only when enabled."}
                  </p>
                </div>
                <Switch
                  checked={saveAddressForFuture && !selectedSavedAddressId}
                  onCheckedChange={setSaveAddressForFuture}
                  disabled={Boolean(selectedSavedAddressId) || isSubmitting}
                />
              </div>

              {!hasValidLocation && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  Select both city and state before continuing. Pincode is optional but must be exactly 6 digits when provided.
                </p>
              )}

              {locationCoordinates && (
                <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent/30 px-2.5 py-1 text-xs text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Exact pin selected
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
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
          <form key="post-step-purpose" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <h3 className="font-heading text-lg">Step 5: Review, purpose, and publish</h3>

              <div className="space-y-2 rounded-xl border border-primary/30 bg-accent/20 p-3">
                <p className="text-xs font-medium text-foreground">
                  Edit anything before publishing
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-primary/45 text-xs"
                    onClick={() => setStep("category")}
                    disabled={isSubmitting}
                  >
                    Edit categories
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-primary/45 text-xs"
                    onClick={() => setStep("details")}
                    disabled={isSubmitting}
                  >
                    Edit details
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-primary/45 text-xs"
                    onClick={() => setStep("photos")}
                    disabled={isSubmitting}
                  >
                    Edit photos/video
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-primary/45 text-xs"
                    onClick={() => setStep("location")}
                    disabled={isSubmitting}
                  >
                    Edit location
                  </Button>
                </div>
              </div>

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

            <div className="flex flex-col gap-3 border-t border-primary/10 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
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
                disabled={!canSubmit || isSubmitting || isPreparingPhotos || isPreparingVideo}
                className={cn("gap-2", ACTION_BUTTON_BORDER_CLASS)}
              >
                {isPreparingPhotos || isPreparingVideo
                  ? "Preparing media..."
                  : isSubmitting
                    ? "Publishing post..."
                    : "Publish post"}
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
  onClick?: () => void;
  disabled?: boolean;
}

function FlowStepCard({ active, complete, stepNumber, title, subtitle, onClick, disabled = false }: FlowStepCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-w-[210px] shrink-0 rounded-xl border px-3 py-2 text-left transition-colors md:min-w-0",
        onClick && !disabled ? "cursor-pointer hover:border-primary/45" : "cursor-default",
        disabled && "opacity-55",
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
          <p className="text-sm font-medium leading-snug text-foreground">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}
