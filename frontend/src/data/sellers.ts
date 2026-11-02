import { IMAGES } from "../assets/images";
import type { Seller } from "../types";

export const sellers: Seller[] = [
  {
    id: "vault",
    name: "SneakerVault",
    handle: "@sneakervault",
    avatar: IMAGES.sellers_vault,
    followers: "12.8K",
    rating: 4.9,
    sold: 842,
    bio: "Good sneakers. Better people. Curated grails, authenticated finds, and a community that gets it.",
  },
  {
    id: "studio",
    name: "Studio Archive",
    handle: "@studioarchive",
    avatar: IMAGES.sellers_studio,
    followers: "8.2K",
    rating: 4.9,
    sold: 615,
    bio: "A second life for exceptional pieces. Vintage, streetwear, and a few unexpected finds.",
  },
  {
    id: "tech",
    name: "TechWithJay",
    handle: "@techwithjay",
    avatar: IMAGES.sellers_tech,
    followers: "6.4K",
    rating: 4.8,
    sold: 392,
    bio: "Your next favorite gadget, found live. Thoughtfully tested tech and collectibles.",
  },
];
