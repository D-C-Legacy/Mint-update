import * as tokens from "../../theme";
import React, { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { AppText, Badge, Button, Chips, Field, Icon, Screen } from "../../components";
import { listCategories, CONDITION_LABELS, type Category, type ProductCondition } from "../../api/catalog";
import {
  createProduct,
  getMyProduct,
  updateProduct,
  archiveProduct,
  publishProduct,
  unpublishProduct,
  requestProductImageUpload,
  attachProductImage,
  listProductImages,
  detachProductImage,
  type ProductImage,
  type ProductStatus,
} from "../../api/seller-products";
import { describeApiError } from "../../api/describe-error";
import { useApp } from "../../hooks";
import { colors as c } from "../../theme";

const CONDITIONS: ProductCondition[] = ["NEW", "LIKE_NEW", "USED", "FOR_PARTS"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// The app's own create/edit listing form (mobile). The web build has its own 2-column layout
// (`Listing.web.tsx`); this file is the single source of truth for the mobile form, reused by the
// web narrow-width path.
export function Listing({ id }: { id?: string }) {
  const app = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(!id);
  const [archived, setArchived] = useState(false);
  const [productStatus, setProductStatus] = useState<ProductStatus | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState<ProductCondition>("NEW");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [weight, setWeight] = useState("");
  const [working, setWorking] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    listCategories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id) return;
    getMyProduct(id)
      .then((p) => {
        setTitle(p.title);
        setCategoryId(p.categoryId);
        setCondition(p.condition);
        setDescription(p.description ?? "");
        setQuantity(String(p.quantity));
        setWeight(p.weightGrams ? String(p.weightGrams) : "");
        setArchived(p.status === "ARCHIVED");
        setProductStatus(p.status);
        setLoaded(true);
      })
      .catch((err) => {
        app.toast(describeApiError(err));
        app.back();
      });
    listProductImages(id)
      .then((page) => setImages(page.items))
      .catch(() => undefined);
  }, [id]);

  const save = async () => {
    const qty = Number(quantity);
    if (!title.trim() || !categoryId) {
      app.toast("Add a title and choose a category.");
      return;
    }
    if (!Number.isInteger(qty) || qty < (id ? 0 : 1)) {
      app.toast("Quantity must be a whole number.");
      return;
    }
    const weightGrams = weight.trim() ? Number(weight) : undefined;
    if (weightGrams !== undefined && (!Number.isInteger(weightGrams) || weightGrams <= 0)) {
      app.toast("Weight must be a positive whole number of grams.");
      return;
    }
    setWorking(true);
    try {
      if (id) {
        await updateProduct(id, {
          title: title.trim(),
          categoryId,
          condition,
          description: description.trim(),
          quantity: qty,
          ...(weightGrams !== undefined ? { weightGrams } : {}),
        });
        app.toast("Listing updated.");
      } else {
        await createProduct({
          title: title.trim(),
          categoryId,
          condition,
          quantity: qty,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(weightGrams !== undefined ? { weightGrams } : {}),
        });
        app.toast("Listing added to inventory.");
      }
      app.back();
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  const runArchive = async () => {
    if (!id) return;
    setWorking(true);
    try {
      await archiveProduct(id);
      app.toast("Listing archived.");
      app.back();
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setWorking(false);
    }
  };

  const runPublish = async () => {
    if (!id) return;
    setStatusBusy(true);
    try {
      const result = await publishProduct(id);
      setProductStatus(result.status);
      app.toast("Listing is live. Buyers can find it now.");
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setStatusBusy(false);
    }
  };

  const runUnpublish = async () => {
    if (!id) return;
    setStatusBusy(true);
    try {
      const result = await unpublishProduct(id);
      setProductStatus(result.status);
      app.toast("Listing pulled back to draft.");
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setStatusBusy(false);
    }
  };

  // Mirrors EditProfileScreenMobile's pickAvatar: presigned S3 PUT, then attach the resulting key.
  // Needs a saved product id — a brand-new listing has nowhere to scope the storage key to yet.
  async function pickImage() {
    if (!id) return;
    setImageError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setImageError("Allow photo access in Settings to add listing photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    setImageBusy(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const mimeType = asset.mimeType || blob.type || "image/jpeg";
      const sizeBytes = asset.fileSize ?? blob.size;

      if (!IMAGE_MIME_TYPES.includes(mimeType)) {
        setImageError("Choose a JPEG, PNG, WebP, or HEIC photo.");
        return;
      }
      if (sizeBytes > MAX_IMAGE_BYTES) {
        setImageError("That photo is over the 10 MB limit.");
        return;
      }

      const fileName = asset.fileName || `listing.${EXTENSION_BY_MIME[mimeType] ?? "jpg"}`;
      const slot = await requestProductImageUpload(id, { fileName, mimeType, sizeBytes });

      const put = await fetch(slot.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });
      if (!put.ok) {
        setImageError("Upload failed. Check your connection and try again.");
        return;
      }

      await attachProductImage(id, {
        storageKey: slot.storageKey,
        ...(asset.width ? { width: asset.width } : {}),
        ...(asset.height ? { height: asset.height } : {}),
      });
      const page = await listProductImages(id);
      setImages(page.items);
    } catch (err) {
      setImageError(describeApiError(err));
    } finally {
      setImageBusy(false);
    }
  }

  async function removeImage(imageId: string) {
    if (!id) return;
    setImageError("");
    setImageBusy(true);
    try {
      await detachProductImage(id, imageId);
      const page = await listProductImages(id);
      setImages(page.items);
    } catch (err) {
      setImageError(describeApiError(err));
    } finally {
      setImageBusy(false);
    }
  }

  if (!loaded) {
    return (
      <Screen title="Listing" onBack={app.back}>
        <AppText muted>Loading…</AppText>
      </Screen>
    );
  }

  return (
    <Screen title={id ? "Edit listing" : "Create listing"} onBack={app.back}>
      {productStatus ? <Badge label={productStatus} /> : null}
      <Field label="Title" value={title} onChange={setTitle} placeholder="What's the find?" />
      <AppText bold size={13}>Category</AppText>
      <Chips
        items={categories.map((c) => c.name)}
        value={categories.find((c) => c.id === categoryId)?.name ?? ""}
        onChange={(name) => {
          const match = categories.find((c) => c.name === name);
          if (match) setCategoryId(match.id);
        }}
      />
      <Field
        label="Description"
        value={description}
        onChange={setDescription}
        placeholder="Tell the story. Include the details."
        multiline
      />
      <AppText bold size={13}>Condition</AppText>
      <Chips
        items={CONDITIONS.map((c) => CONDITION_LABELS[c])}
        value={CONDITION_LABELS[condition]}
        onChange={(label) => {
          const match = CONDITIONS.find((c) => CONDITION_LABELS[c] === label);
          if (match) setCondition(match);
        }}
      />
      <Field label="Quantity" value={quantity} onChange={setQuantity} keyboardType="numeric" />
      <Field label="Weight in grams (optional)" value={weight} onChange={setWeight} keyboardType="numeric" />
      <AppText muted size={12} style={{ marginTop: tokens.spacing.sm }}>
        Pricing and auction/buy-now setup happen when you put this up in a live show.
      </AppText>

      {id ? (
        <>
          <AppText bold size={13} style={{ marginTop: tokens.spacing.lg }}>
            Photos
          </AppText>
          <AppText muted size={12}>
            At least one photo is required before a listing can go live.
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm, marginTop: tokens.spacing.sm }}>
            {images.map((img) => (
              <View key={img.id} style={{ width: 72, height: 72 }}>
                <Image source={{ uri: img.url }} style={{ width: 72, height: 72, borderRadius: tokens.radii.image }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  onPress={() => removeImage(img.id)}
                  disabled={imageBusy}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: c.canvas,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: c.line,
                  }}
                >
                  <Icon name="close" size={14} />
                </Pressable>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              onPress={pickImage}
              disabled={imageBusy}
              style={{
                width: 72,
                height: 72,
                borderRadius: tokens.radii.image,
                borderWidth: 1,
                borderColor: c.line,
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
                opacity: imageBusy ? 0.6 : 1,
              }}
            >
              <Icon name="add" />
            </Pressable>
          </View>
          {imageError ? (
            <AppText size={13} style={{ color: c.live }}>
              {imageError}
            </AppText>
          ) : null}
        </>
      ) : null}

      <Button label={id ? "Save changes" : "Add to inventory"} loading={working} onPress={save} />
      {id && !archived && productStatus === "DRAFT" ? (
        <Button label="Activate listing" loading={statusBusy} onPress={runPublish} />
      ) : null}
      {id && !archived && productStatus === "ACTIVE" ? (
        <Button secondary label="Deactivate listing" loading={statusBusy} onPress={runUnpublish} />
      ) : null}
      {id && !archived ? (
        <Button secondary label="Archive listing" loading={working} onPress={runArchive} />
      ) : null}
    </Screen>
  );
}
